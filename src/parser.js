// ============================================================
// RECEIPT PARSER — Serbian fiscal receipt (PFR/SUF)
//
// Strategy:
//   1. Parse named HTML elements for structured fields
//      (PIB, address, city, total, receipt number, date/time)
//   2. Parse the server-rendered <pre> journal block for
//      merchant name, cashier, items, payment method, VAT total
// ============================================================

function parseReceiptHtml(html, sourceUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // ── 1. Named HTML elements (server-rendered, stable) ──────
  const get = id => (doc.getElementById(id)?.textContent || '').replace(/\s+/g, ' ').trim();

  const pib           = get('tinLabel');
  const address       = get('addressLabel');
  const city          = get('cityLabel');
  const total         = get('totalAmountLabel').replace(/\s/g, ''); // strip internal whitespace
  const receiptNumber = get('invoiceNumberLabel').replace(/\s/g, '');
  const dateTimeStr   = get('sdcDateTimeLabel');

  if (!dateTimeStr) throw new Error('Рачун није пронађен: страница портала не садржи податке о рачуну.');

  // ── 2. <pre> journal text ──────────────────────────────────
  let preEl   = null;
  let preText = null;
  for (const el of doc.querySelectorAll('pre')) {
    if (el.textContent.includes('ФИСКАЛНИ РАЧУН')) {
      preEl   = el;
      preText = el.textContent;
      break;
    }
  }

  const pre = preText ? parsePreText(preText) : {};

  return {
    merchantName:    pre.merchantName    || '',
    address:         [address, city].filter(Boolean).join(', '),
    pib,
    receiptNumber,
    dateTimeStr,
    dateTime:        parseSerbianDate(dateTimeStr),
    cashier:         pre.cashier         || '',
    transactionType: pre.transactionType || '',
    items:           pre.items           || [],
    total,
    vatTotal:        pre.vatTotal        || '',
    paymentMethod:   pre.paymentMethod   || '',
    paymentAmount:   pre.paymentAmount   || '',
    preHtml:         preEl ? preEl.innerHTML : '',
    sourceUrl,
  };
}

// ── <pre> parser ───────────────────────────────────────────────
//
// Actual format observed in the wild:
//
//   ============ ФИСКАЛНИ РАЧУН ============
//                  106884584                    ← PIB (digits)
//                LIDL SRBIJA KD                 ← merchant name
//         1153143-Prodavnica br. 0174            ← shop (skip)
//              ИВА АНДРИЋА 16                    ← address (skip)
//                   Нови Сад                     ← city (skip)
//   Касир:                                  82
//   ЕСИР број:                   625/12.08.09.60
//   -------------ПРОМЕТ ПРОДАЈА-------------
//   Артикли
//   ========================================
//   Назив   Цена         Кол.         Укупно   ← header row (skip)
//   Sal. Vit-Fit op./KOM/7002750 (Е)           ← item name line
//          113,49          1          113,49    ← item price line (indented)
//   ----------------------------------------
//   Укупан износ:                   1.154,89
//   Платна картица:                 1.154,89
//   ========================================
//   Ознака  Име  Стопа  Порез                  ← tax header (skip)
//   Ђ  О-ПДВ  20,00%  156,16
//   Е  П-ПДВ  10,00%   19,81
//   ----------------------------------------
//   Укупан износ пореза:              175,97
//   ========================================
//   ПФР време:           14.03.2026. 8:04:44
//   ПФР број рачуна: ALYUFYVM-ALYUFYVM-47691
//   Бројач рачуна:             47255/47691ПП
//   ========================================

// VAT label that ends every item name: one letter in parentheses, e.g. "(Ђ)", "(Е)", "(A)".
const VAT_LABEL_RE = /\([А-ЯЂЖЉЊЋЏа-яђжљњћџA-Z]\)\s*$/;

// The payment types a fiscal receipt can carry (Cyrillic, Latin and English journals).
const PAYMENT_TYPE_RE = new RegExp('^(?:' + [
  'Готовина', 'Платна картица', 'Чек', 'Пренос на рачун', 'Ваучер', 'Инстант плаћање', 'Друго безготовинско плаћање',
  'Gotovina', 'Platna kartica', '[CČ]ek', 'Prenos na ra[cč]un', 'Vau[cč]er', 'Instant pla[cć]anje', 'Drugo bezgotovinsko pla[cć]anje',
  'Cash', 'Card', 'Check', 'Wire transfer', 'Voucher', 'Mobile money', 'Instant payment', 'Other',
].join('|') + ')$', 'i');

// "Sal. Vit-Fit op./KOM/7002750 (Е)" → "Sal. Vit-Fit op."   "Jogurt (1L)/KOM/7002750 (Е)" → "Jogurt (1L)"
// Removes the VAT label once, then an optional "/unit/barcode" suffix (unit may be Cyrillic).
function cleanItemName(name) {
  if (!VAT_LABEL_RE.test(name)) return name.trim();
  const cleaned = name
    .replace(VAT_LABEL_RE, '')
    .trim()
    .replace(/\/[\p{L}.]{1,8}\/[\p{L}\p{N}_.-]+$/u, '')
    .trim();
  return cleaned || name.trim();
}

function parsePreText(text) {
  const lines = text.split('\n').map(l => l.trimEnd());

  const isEqSep   = s => /^={8,}/.test(s.trim());
  const isDashSep = s => /^-{8,}/.test(s.trim());

  // Column width of the journal (40 on every receipt seen so far), taken from a "====" line.
  // A name line that fills the whole width was cut mid-word, so its continuation joins without a space.
  const journalWidth = lines.find(l => /^=+$/.test(l.trim()))?.trim().length || 40;

  let merchantName    = '';
  let cashier         = '';
  let transactionType = '';
  let vatTotal        = '';
  const payments      = [];   // { method, amount } — may be more than one
  const items         = [];
  let pendingName = null;  // raw item name collected so far (may span several lines)
  let pendingFull = false; // its last line filled the journal width (cut mid-word)

  // Phases: before_header → merchant → items_pre → items → totals → tax → done
  let phase = 'before_header';

  for (const raw of lines) {
    const trimmed = raw.trim();

    // ── Before fiscal receipt header ────────────────────────
    if (phase === 'before_header') {
      if (trimmed.includes('ФИСКАЛНИ РАЧУН') || trimmed.includes('FISKALNI RACUN')) {
        phase = 'merchant';
      }
      continue;
    }

    // ── Merchant block ───────────────────────────────────────
    if (phase === 'merchant') {
      // The "---ПРОМЕТ ПРОДАЈЕ---" / "---ПРОМЕТ РЕФУНДАЦИЈА---" separator marks the end of this block.
      // Capture the text between the dashes as the transaction type.
      if (isDashSep(trimmed)) {
        const inner = trimmed.replace(/^-+|-+$/g, '').trim();
        if (inner) transactionType = inner;
        phase = 'items_pre';
        continue;
      }
      if (!trimmed) continue;

      // Cashier line
      const cashierM = trimmed.match(/^Касир:\s*(.*)$/);
      if (cashierM) { cashier = cashierM[1].replace(/\s+/g, ' ').trim(); continue; }

      // Skip ЕСИР / ESIR info lines
      if (/^ЕСИР|^ESIR/i.test(trimmed)) continue;

      // Skip lines that are only digits (PIB) or only dashes/equals
      if (/^\d+$/.test(trimmed)) continue;

      // First remaining non-special line = merchant name
      if (!merchantName) merchantName = trimmed;

      continue;
    }

    // ── Skip until items start (after "Артикли" and "====") ──
    if (phase === 'items_pre') {
      if (isEqSep(trimmed)) { phase = 'items'; continue; }
      continue;
    }

    // ── Items block ──────────────────────────────────────────
    if (phase === 'items') {
      // Dash separator = end of items
      if (isDashSep(trimmed)) { phase = 'totals'; continue; }
      if (!trimmed) continue;

      // Skip column header row ("Назив Цена Кол. Укупно")
      if (/Назив|Naziv/i.test(trimmed)) continue;

      // Price line: indented 2+ spaces, then exactly three number groups separated by 2+ spaces
      // Format: "       113,49          1          113,49"
      const priceM = raw.match(/^\s{2,}([\d,\.]+)\s{2,}([\d,\.]+)\s{2,}([\d,\.]+)\s*$/);
      if (priceM) {
        if (pendingName) {
          items.push({
            name:      cleanItemName(pendingName),
            unitPrice: priceM[1].trim(),
            qty:       priceM[2].trim(),
            total:     priceM[3].trim(),
          });
        }
        pendingName = null;
        continue;
      }

      if (isEqSep(trimmed)) continue;

      // Name line. A name can wrap over any number of lines; the last one ends with the
      // "(X)" VAT label, e.g. "Sal. Vit-Fit op./KOM/7002750 (Е)". Wrapped parts are joined
      // without a space when the previous line was cut at the column edge, or when the cut
      // fell inside a parenthesis: "... (KOM" + ") (Е)", "... (KOM) (Ђ" + ")".
      // A pending name that already has its label is complete, so this line starts a new one.
      if (pendingName === null || VAT_LABEL_RE.test(pendingName)) {
        pendingName = trimmed;
      } else {
        const midParen = trimmed.startsWith(')') && /\([^\)]*$/.test(pendingName);
        pendingName += (pendingFull || midParen ? '' : ' ') + trimmed;
      }
      pendingFull = raw.length >= journalWidth;
      continue;
    }

    // ── Totals block ─────────────────────────────────────────
    if (phase === 'totals') {
      if (isEqSep(trimmed)) { phase = 'tax'; continue; }
      if (!trimmed) continue;

      // Skip the "Укупан износ:" line — we have the total from the HTML element
      if (/^Укупан износ:/.test(trimmed)) continue;

      // Payment method line: "Платна картица:   1.154,89"
      // Collect all — a single receipt can have multiple payment methods.
      // Other "label: amount" lines here are not payments (Повраћај = change,
      // Укупна рефундација, Плаћено авансом, Преостало за плаћање, …).
      const payM = trimmed.match(/^([^:]+):\s*([\d,\.]+)\s*$/);
      if (payM && PAYMENT_TYPE_RE.test(payM[1].trim())) {
        payments.push({ method: payM[1].trim(), amount: payM[2].trim() });
      }
      continue;
    }

    // ── Tax block ────────────────────────────────────────────
    if (phase === 'tax') {
      if (isEqSep(trimmed)) { phase = 'done'; continue; }

      // "Укупан износ пореза: 175,97"
      const vatM = trimmed.match(/^Укупан износ пореза:\s*([\d,\.]+)/);
      if (vatM) vatTotal = vatM[1];
      continue;
    }

    if (phase === 'done') break;
  }

  return {
    merchantName, cashier, transactionType,
    paymentMethod: payments.map(p => p.method).join(' + '),
    paymentAmount: payments.length === 1 ? payments[0].amount : '',
    vatTotal, items,
  };
}

// ── Date parsing ───────────────────────────────────────────────
// Handles both "14.3.2026. 08:04:44" and "14.03.2026. 8:04:44"
// Returns the wall-clock parts as printed on the receipt (Belgrade time), or null.
function parseSerbianDateParts(str) {
  const m = (str || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\.\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, day, month, year, hour, minute, second] = m.map(Number);
  return { year, month, day, hour, minute, second };
}

function parseSerbianDate(str) {
  const p = parseSerbianDateParts(str);
  return p && new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

// ── Transaction type ───────────────────────────────────────────
// Classifies the journal's transaction line ("ПРОМЕТ ПРОДАЈА", "ПРОМЕТ РЕФУНДАЦИЈА",
// "АВАНС ПРОДАЈА", "ОБУКА …"): 'sale' is the ordinary purchase, 'refund' any refund,
// 'other' everything else. A missing type counts as a sale.
function transactionKind(transactionType) {
  const type = (transactionType || '').trim();
  if (/РЕФУНДАЦИЈ|REFUNDACIJ|REFUND/i.test(type)) return 'refund';
  if (!type || /^(ПРОМЕТ\s+ПРОДАЈА|PROMET\s+PRODAJA|NORMAL\s+SALE)$/i.test(type)) return 'sale';
  return 'other';
}

// "1.154,89" → 1154.89
function parseAmount(str) {
  return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0;
}

// 1154.89 → "1.154,89"
function formatAmount(num) {
  return num.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Node (tests): export the functions; in the browser they are plain globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseReceiptHtml, parsePreText, cleanItemName,
    parseSerbianDateParts, parseSerbianDate, transactionKind, parseAmount, formatAmount,
  };
}
