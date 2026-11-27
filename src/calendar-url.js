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

// The popup hands over a number (preset) or the raw text of the custom field, so both are
// accepted, but only whole months in range: 24 → 24, ' 24 ' → 24, '1e2' → null, 121 → null.
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
function isWarrantyExpired({ year, month, day }, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now); // 'YYYY-MM-DD'
  const end = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return end < today;
}

// {2028, 11, 7} → '20281107', for all-day event dates.
function formatAllDayStamp({ year, month, day }) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10).replace(/-/g, '');
}

function checkWarrantyMonths(warrantyMonths) {
  if (normalizeWarrantyMonths(warrantyMonths) === null) {
    throw new Error('Неисправан период гаранције: ' + warrantyMonths);
  }
}

function signedTotal(receipt) {
  const total = String(receipt.total || '').replace(/^-/, '');
  return transactionKind(receipt.transactionType) === 'refund' ? '-' + total : total;
}

function buildReceiptDescription(receipt, itemLimit, warrantyMonths) {
  const kind = transactionKind(receipt.transactionType);
  const mark = TRANSACTION_MARK[kind];
  const warrantyEnd = kind === 'sale' ? warrantyEndDate(receipt.dateTimeStr, warrantyMonths) : null;
  const shown = receipt.items.slice(0, itemLimit);
  const hidden = receipt.items.length - shown.length;
  const itemLines = receipt.items.length
    ? shown.map(it => `• ${it.name} ×${it.qty} = ${it.total} RSD`)
        .concat(hidden > 0 ? [`… +${hidden}`] : [])
        .join('\n')
    : '(no items parsed)';

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
    warrantyEnd ? `${WARRANTY_MARK} Гаранција до: ${formatWarrantyDate(warrantyEnd)}` : '',
    `🔗 ${receipt.sourceUrl}`,
  ].filter(Boolean).join('\n');
}

// Long receipts: drop item lines from the end until the URL fits.
// make(itemLimit) → URL; the 💰, 🧾, 🛡 and 🔗 lines are never dropped.
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
// The title has no ' — ', so the Receipt Scanner PWA never reads an amount from it.
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

  const make = itemLimit => 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
    action:   'TEMPLATE',
    text:     receipt.merchantName ? `Гаранција истиче: ${receipt.merchantName}` : 'Гаранција истиче',
    dates,
    ctz:      'Europe/Belgrade',
    details:  buildReceiptDescription(receipt, itemLimit, warrantyMonths),
    location: receipt.address,
  });

  return fitCalendarUrl(make, receipt.items.length);
}

// Node (tests): export the functions; in the browser they are plain globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildCalendarUrl, buildReceiptDescription, buildWarrantyCalendarUrl,
    normalizeWarrantyMonths, warrantyEndDate, formatWarrantyDate, isWarrantyExpired,
    WARRANTY_PRESETS, DEFAULT_WARRANTY_MONTHS, MAX_WARRANTY_MONTHS,
  };
}
