// Builds a prefilled Google Calendar "new event" URL from a parsed receipt.
// No API and no OAuth: the user's signed-in browser session opens the form
// and they press Save. The description uses the same emoji-prefixed format
// as the Receipt Scanner PWA, so the PWA can read these events back.

const MAX_CALENDAR_URL_LENGTH = 6000; // stay well under Google's request-size limit

// Requires parser.js (parseSerbianDateParts, transactionKind) to be loaded first.

// "7.11.2026. 13:25:06" → the receipt's wall-clock time (Belgrade), held in a UTC timestamp
// purely as a timezone-free container, so the machine's own timezone never shifts it.
function receiptWallTime(dateTimeStr) {
  const p = parseSerbianDateParts(dateTimeStr);
  return p && Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

function formatCalendarStamp(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').slice(0, 15); // YYYYMMDDTHHMMSS
}

// Anything but an ordinary sale is labelled in the event, and refunds carry a negative
// amount so that the Receipt Scanner PWA's monthly report subtracts them instead of
// counting them as spending.
const TRANSACTION_MARK = { refund: '↩', other: '🏷' };

const WARRANTY_PRESETS = [6, 12, 24, 36];   // months offered in the popup
const DEFAULT_WARRANTY_MONTHS = 24;          // selected when the warranty is turned on
const MAX_WARRANTY_MONTHS = 120;             // custom periods above this are rejected
const WARRANTY_MARK = '\u{1F6E1}';           // 🛡 (no U+FE0F)

// Callers may hand over a number or text, so both are accepted, but only whole months in
// range: 24 → 24, ' 24 ' → 24, '1e2' → null, 121 → null.
function normalizeWarrantyMonths(value) {
  let n;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string' && /^\d{1,3}$/.test(value.trim())) n = Number(value.trim());
  else return null;
  return Number.isInteger(n) && n >= 1 && n <= MAX_WARRANTY_MONTHS ? n : null;
}

// Counted from the date printed on the receipt, never from today, in calendar months; a day
// the target month lacks is clamped to its last day: '31.8.2027. 10:00:00' + 6 → {2028, 2, 29}.
// Only UTC date arithmetic, so the machine's timezone and DST never shift the result.
function warrantyEndDate(dateTimeStr, months) {
  const parts = parseSerbianDateParts(dateTimeStr);
  const n = normalizeWarrantyMonths(months);
  if (parts === null || n === null) return null;
  const m0 = parts.month - 1 + n;
  const ty = parts.year + Math.floor(m0 / 12);
  const tm = m0 % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return { year: ty, month: tm + 1, day: Math.min(parts.day, last) };
}

// The receipts' own date style, without zero padding: {2028, 11, 7} → '7.11.2028.'
function formatWarrantyDate({ year, month, day }) {
  return `${day}.${month}.${year}.`;
}

// Compared with today's date in Belgrade, where the receipt was issued; the end day itself
// still counts as covered: end 7.11.2028., now 2028-11-07T23:00:00Z (8 Nov in Belgrade) → true.
// Today is read from the formatter's parts, never from the shape of a formatted string, which
// differs between browser releases.
function isWarrantyExpired({ year, month, day }, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Belgrade', calendar: 'gregory', numberingSystem: 'latn',
    year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now);
  const get = type => Number(parts.find(p => p.type === type).value);
  const today = { year: get('year'), month: get('month'), day: get('day') };
  return year * 10000 + month * 100 + day < today.year * 10000 + today.month * 100 + today.day;
}

// {2028, 11, 7} → '20281107', for all-day event dates.
function formatAllDayStamp({ year, month, day }) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10).replace(/-/g, '');
}

// Throws the error the popup shows for a period that is not whole months from 1 to 120:
// 24 → no throw; 0, '' or null → Error('Неисправан период гаранције: …').
function checkWarrantyMonths(warrantyMonths) {
  if (normalizeWarrantyMonths(warrantyMonths) === null) {
    throw new Error('Неисправан период гаранције: ' + warrantyMonths);
  }
}

function signedTotal(receipt) {
  const total = String(receipt.total || '').replace(/^-/, '');
  return transactionKind(receipt.transactionType) === 'refund' ? '-' + total : total;
}

// Shared by both descriptions, so their item lines and trimming are identical:
// 3 items, itemLimit 1 → '• Espresso ×1 = 220,00 RSD\n… +2'; no items → '(no items parsed)'.
function itemLinesText(items, itemLimit) {
  const shown = items.slice(0, itemLimit);
  const hidden = items.length - shown.length;
  return items.length
    ? shown.map(it => `• ${it.name} ×${it.qty} = ${it.total} RSD`)
        .concat(hidden > 0 ? [`… +${hidden}`] : [])
        .join('\n')
    : '(no items parsed)';
}

// The 🛡 line ('🛡 Гаранција до: 7.11.2028.') only for a sale with a valid warrantyMonths.
function warrantyLine(receipt, warrantyMonths) {
  const end = transactionKind(receipt.transactionType) === 'sale'
    ? warrantyEndDate(receipt.dateTimeStr, warrantyMonths) : null;
  return end ? `${WARRANTY_MARK} Гаранција до: ${formatWarrantyDate(end)}` : '';
}

function buildReceiptDescription(receipt, itemLimit, warrantyMonths) {
  const mark = TRANSACTION_MARK[transactionKind(receipt.transactionType)];
  const itemLines = itemLinesText(receipt.items, itemLimit);

  return [
    receipt.merchantName,
    receipt.address,
    receipt.pib ? `PIB: ${receipt.pib}` : '',
    `📋 ${receipt.receiptNumber}`,
    `🕐 ${receipt.dateTimeStr}`,
    receipt.cashier ? `👤 Касир: ${receipt.cashier}` : '',
    receipt.paymentMethod ? `💳 ${receipt.paymentMethod}` : '',
    mark ? `${mark} ${receipt.transactionType}` : '',
    '🛒 Артикли:',
    itemLines,
    `💰 Укупно: ${signedTotal(receipt)} RSD`,
    receipt.vatTotal ? `🧾 ПДВ: ${receipt.vatTotal} RSD` : '',
    warrantyLine(receipt, warrantyMonths),
    `🔗 ${receipt.sourceUrl}`,
  ].filter(Boolean).join('\n');
}

// The expiry event's description: what was bought and where the receipt is, but no money,
// payment or VAT line, so a copy saved to the Receipt Scanner's calendar adds no amount and no
// payment method there. SALE + 24 → '🛡 Гаранција до: 7.11.2028.\n📋 …\n🕐 …\n🛒 Артикли:\n• …\n🔗 …'.
function buildWarrantyDescription(receipt, itemLimit, warrantyMonths) {
  return [
    warrantyLine(receipt, warrantyMonths),
    `📋 ${receipt.receiptNumber}`,
    `🕐 ${receipt.dateTimeStr}`,
    '🛒 Артикли:',
    itemLinesText(receipt.items, itemLimit),
    `🔗 ${receipt.sourceUrl}`,
  ].filter(Boolean).join('\n');
}

// Long receipts: drop item lines from the end until the URL fits; the other lines are never
// dropped. make(itemLimit) → URL; 150 long items → a URL of at most 6000 characters with '… +N'.
function fitCalendarUrl(make, itemCount) {
  let limit = itemCount;
  let url = make(limit);
  while (url.length > MAX_CALENDAR_URL_LENGTH && limit > 0) url = make(--limit);
  return url;
}

// warrantyMonths is optional: without it (undefined or null) the URL is exactly as before the
// warranty existed. A non-sale receipt ignores it.
function buildCalendarUrl(receipt, warrantyMonths) {
  const start = receiptWallTime(receipt.dateTimeStr);
  if (start === null) throw new Error('Датум рачуна није препознат: ' + receipt.dateTimeStr);
  if (warrantyMonths != null) checkWarrantyMonths(warrantyMonths);
  const end = start + 15 * 60 * 1000;

  const make = itemLimit => 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
    action:   'TEMPLATE',
    text:     `${receipt.merchantName} — ${signedTotal(receipt)} RSD`,
    dates:    `${formatCalendarStamp(start)}/${formatCalendarStamp(end)}`,
    ctz:      'Europe/Belgrade',
    details:  buildReceiptDescription(receipt, itemLimit, warrantyMonths),
    location: receipt.address,
  });

  return fitCalendarUrl(make, receipt.items.length);
}

// A second, all-day event on the day the warranty ends: SALE (7.11.2026.) + 24 →
// text 'Гаранција истиче: KAFE PRIMER DOO', dates '20281107/20281108' (end date exclusive).
// The title never contains ' — ' (the merchant name is trimmed and its em dashes become '-'), so the
// Receipt Scanner PWA never reads an amount from it: 'ALFA — BETA DOO' → 'Гаранција истиче: ALFA - BETA DOO';
// '   ' → 'Гаранција истиче'.
function buildWarrantyCalendarUrl(receipt, warrantyMonths) {
  if (receiptWallTime(receipt.dateTimeStr) === null) {
    throw new Error('Датум рачуна није препознат: ' + receipt.dateTimeStr);
  }
  checkWarrantyMonths(warrantyMonths);
  if (transactionKind(receipt.transactionType) !== 'sale') {
    throw new Error('Гаранција се додаје само за рачун продаје.');
  }

  const end = warrantyEndDate(receipt.dateTimeStr, warrantyMonths);
  const dates = `${formatAllDayStamp(end)}/${formatAllDayStamp({ ...end, day: end.day + 1 })}`;
  const name = (receipt.merchantName || '').trim().replace(/\u2014/g, '-');
  const text = name ? 'Гаранција истиче: ' + name : 'Гаранција истиче';

  const make = itemLimit => 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
    action:   'TEMPLATE',
    text,
    dates,
    ctz:      'Europe/Belgrade',
    details:  buildWarrantyDescription(receipt, itemLimit, warrantyMonths),
    location: receipt.address,
  });

  return fitCalendarUrl(make, receipt.items.length);
}

// Node (tests): export the functions; in the browser they are plain globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildCalendarUrl, buildReceiptDescription, buildWarrantyCalendarUrl, buildWarrantyDescription,
    normalizeWarrantyMonths, warrantyEndDate, formatWarrantyDate, isWarrantyExpired,
    WARRANTY_PRESETS, DEFAULT_WARRANTY_MONTHS, MAX_WARRANTY_MONTHS,
  };
}
