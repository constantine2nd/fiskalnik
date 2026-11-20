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

function signedTotal(receipt) {
  const total = String(receipt.total || '').replace(/^-/, '');
  return transactionKind(receipt.transactionType) === 'refund' ? '-' + total : total;
}

function buildReceiptDescription(receipt, itemLimit) {
  const mark = TRANSACTION_MARK[transactionKind(receipt.transactionType)];
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
    `🔗 ${receipt.sourceUrl}`,
  ].filter(Boolean).join('\n');
}

function buildCalendarUrl(receipt) {
  const start = receiptWallTime(receipt.dateTimeStr);
  if (start === null) throw new Error('Датум рачуна није препознат: ' + receipt.dateTimeStr);
  const end = start + 15 * 60 * 1000;

  const make = itemLimit => 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
    action:   'TEMPLATE',
    text:     `${receipt.merchantName} — ${signedTotal(receipt)} RSD`,
    dates:    `${formatCalendarStamp(start)}/${formatCalendarStamp(end)}`,
    ctz:      'Europe/Belgrade',
    details:  buildReceiptDescription(receipt, itemLimit),
    location: receipt.address,
  });

  // Long receipts: drop item lines from the end until the URL fits.
  let limit = receipt.items.length;
  let url = make(limit);
  while (url.length > MAX_CALENDAR_URL_LENGTH && limit > 0) url = make(--limit);
  return url;
}

// Node (tests): export the functions; in the browser they are plain globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildCalendarUrl, buildReceiptDescription };
}
