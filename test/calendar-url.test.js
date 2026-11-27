// Run: node --test test/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

// calendar-url.js uses parser.js functions as globals, as it does in the browser.
Object.assign(globalThis, require('../src/parser.js'));
const ctx = require('../src/calendar-url.js');
const params = receipt => new URL(ctx.buildCalendarUrl(receipt)).searchParams;

const SALE = {
  merchantName: 'KAFE PRIMER DOO', address: 'ПРИМЕРНА 1, Београд', pib: '100000008',
  receiptNumber: 'ABCD1234-ABCD1234-1001', dateTimeStr: '7.11.2026. 13:25:06', cashier: 'Ana',
  transactionType: 'ПРОМЕТ ПРОДАЈА', paymentMethod: 'Готовина', total: '750,00', vatTotal: '125,00',
  sourceUrl: 'https://suf.purs.gov.rs/v/?vl=' + 'A'.repeat(760),
  items: [{ name: 'Espresso', qty: '1', total: '220,00' }, { name: 'Limunada 0.3', qty: '1', total: '295,00' }],
};

test('ordinary sale: title, times, and PWA-compatible description', () => {
  const p = params(SALE);
  assert.equal(p.get('text'), 'KAFE PRIMER DOO — 750,00 RSD');
  assert.equal(p.get('dates'), '20261107T132506/20261107T134006');
  assert.equal(p.get('ctz'), 'Europe/Belgrade');
  const lines = p.get('details').split('\n');
  assert.equal(lines[0], 'KAFE PRIMER DOO');
  assert.ok(lines.includes('🛒 Артикли:'));
  assert.ok(lines.includes('• Espresso ×1 = 220,00 RSD'));
  assert.ok(lines.includes('💰 Укупно: 750,00 RSD'));
  assert.ok(!lines.some(l => l.startsWith('↩') || l.startsWith('🏷')));
  assert.ok(lines.at(-1).startsWith('🔗 https://suf.purs.gov.rs/'));
});

test('refund: negative amount in title and total, labelled in the description', () => {
  const p = params({ ...SALE, transactionType: 'ПРОМЕТ РЕФУНДАЦИЈА' });
  assert.equal(p.get('text'), 'KAFE PRIMER DOO — -750,00 RSD');
  const lines = p.get('details').split('\n');
  assert.ok(lines.includes('↩ ПРОМЕТ РЕФУНДАЦИЈА'));
  assert.ok(lines.includes('💰 Укупно: -750,00 RSD'));
  // an already-negative total is not negated twice
  assert.equal(params({ ...SALE, transactionType: 'ПРОМЕТ РЕФУНДАЦИЈА', total: '-750,00' }).get('text'), 'KAFE PRIMER DOO — -750,00 RSD');
});

test('other non-sale types are labelled but keep a positive amount', () => {
  const p = params({ ...SALE, transactionType: 'АВАНС ПРОДАЈА' });
  assert.equal(p.get('text'), 'KAFE PRIMER DOO — 750,00 RSD');
  assert.ok(p.get('details').split('\n').includes('🏷 АВАНС ПРОДАЈА'));
});

test('very long receipts are trimmed to fit the link, keeping total and source link', () => {
  const items = Array.from({ length: 150 }, (_, i) => ({ name: 'Артикал са дугим називом ' + i, qty: '1', total: '100,00' }));
  const url = ctx.buildCalendarUrl({ ...SALE, items });
  assert.ok(url.length <= 6000);
  const details = new URL(url).searchParams.get('details');
  assert.match(details, /… \+\d+/);
  assert.ok(details.includes('💰 Укупно: 750,00 RSD'));
  assert.ok(details.includes('🔗 https://suf.purs.gov.rs/'));
});

test('an unreadable date is rejected', () => {
  assert.throws(() => ctx.buildCalendarUrl({ ...SALE, dateTimeStr: 'nonsense' }), /Датум рачуна/);
});

// ── Warranty end date (docs/specs/warranty-end-date.md) ─────────────────────────────────────────
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const lines = url => new URL(url).searchParams.get('details').split('\n');
const keys = url => [...new URL(url).searchParams.keys()];
const REFUND = { ...SALE, transactionType: 'ПРОМЕТ РЕФУНДАЦИЈА' };
const OTHER = { ...SALE, transactionType: 'АВАНС ПРОДАЈА' };
const LONG = { ...SALE, items: Array.from({ length: 150 }, (_, i) => ({ name: 'Артикал са дугим називом ' + i, qty: '1', total: '100,00' })) };
const date = (year, month, day) => ({ year, month, day });
// Today's description of SALE, line by line (the format the Receipt Scanner PWA reads).
const SALE_LINES = [
  'KAFE PRIMER DOO',
  'ПРИМЕРНА 1, Београд',
  'PIB: 100000008',
  '📋 ABCD1234-ABCD1234-1001',
  '🕐 7.11.2026. 13:25:06',
  '👤 Касир: Ana',
  '💳 Готовина',
  '🛒 Артикли:',
  '• Espresso ×1 = 220,00 RSD',
  '• Limunada 0.3 ×1 = 295,00 RSD',
  '💰 Укупно: 750,00 RSD',
  '🧾 ПДВ: 125,00 RSD',
  '🔗 ' + SALE.sourceUrl,
];
const WARRANTY_LINE = '\u{1F6E1} Гаранција до: 7.11.2028.';

// Covers: R2, R8 (T1)
test('T1 without a warranty the URL is unchanged: no argument, undefined and null give the same string', () => {
  const url = ctx.buildCalendarUrl(SALE);
  assert.equal(ctx.buildCalendarUrl(SALE, undefined), url);
  assert.equal(ctx.buildCalendarUrl(SALE, null), url);
  assert.deepEqual(keys(url), ['action', 'text', 'dates', 'ctz', 'details', 'location']);
  assert.deepEqual(lines(url), SALE_LINES);
});

// Covers: R2 (T20). Byte-identical to the main branch's builder; skipped where git or main is not available.
test('T20 without a warranty the URL is byte-identical to the main branch', t => {
  let source;
  try {
    source = execFileSync('git', ['show', 'main:src/calendar-url.js'], { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    t.skip('git or the main branch is not available');
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiskalnik-main-'));
  try {
    const file = path.join(dir, 'calendar-url-main.js');
    fs.writeFileSync(file, source);
    const before = require(file);
    for (const r of [SALE, REFUND, OTHER, LONG, { ...SALE, vatTotal: '', merchantName: '' }]) {
      assert.equal(ctx.buildCalendarUrl(r), before.buildCalendarUrl(r), r.transactionType);
      assert.equal(ctx.buildCalendarUrl(r, null), before.buildCalendarUrl(r), r.transactionType);
      assert.equal(ctx.buildCalendarUrl(r, undefined), before.buildCalendarUrl(r), r.transactionType);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Covers: R4, E6 (T2)
test('T2 normalizeWarrantyMonths accepts whole months 1-120 as numbers or short digit strings', () => {
  const valid = [[1, 1], [24, 24], [120, 120], ['24', 24], [' 24 ', 24], ['\t24\n', 24], ['024', 24], ['120', 120],
    ['1', 1], [' 12 ', 12], ['6', 6]];
  for (const [input, expected] of valid) {
    assert.strictEqual(ctx.normalizeWarrantyMonths(input), expected, JSON.stringify(input));
  }
  const invalid = [0, -3, 2.5, NaN, Infinity, -Infinity, 121, 999999, '', '   ', '0', '000', '-3', '+24', '2.5', '1e2',
    'abc', '121', '999999', '0121', '24 months', '２４', true, false, null, undefined, {}, [24], () => 24];
  for (const input of invalid) {
    assert.strictEqual(ctx.normalizeWarrantyMonths(input), null, String(input));
  }
});

// Covers: R3, R5 (T3)
test('T3 warrantyEndDate adds the preset periods to the receipt date', () => {
  const d = '7.11.2026. 13:25:06';
  assert.deepEqual(ctx.warrantyEndDate(d, 6), date(2027, 5, 7));
  assert.deepEqual(ctx.warrantyEndDate(d, 12), date(2027, 11, 7));
  assert.deepEqual(ctx.warrantyEndDate(d, 24), date(2028, 11, 7));
  assert.deepEqual(ctx.warrantyEndDate(d, 36), date(2029, 11, 7));
  // a valid string period works too (R4), and zero-padded receipt dates parse the same
  assert.deepEqual(ctx.warrantyEndDate(d, '24'), date(2028, 11, 7));
  assert.deepEqual(ctx.warrantyEndDate('07.11.2026. 8:05:06', 24), date(2028, 11, 7));
});

// Covers: R5, E1 (T4)
test('T4 an end day missing from the target month is clamped to its last day', () => {
  const cases = [
    ['31.8.2026. 10:00:00', 6, date(2027, 2, 28)],
    ['31.8.2027. 10:00:00', 6, date(2028, 2, 29)],
    ['29.2.2028. 10:00:00', 12, date(2029, 2, 28)],
    ['29.2.2028. 10:00:00', 48, date(2032, 2, 29)],
    ['31.1.2026. 10:00:00', 1, date(2026, 2, 28)],
    ['31.10.2026. 10:00:00', 1, date(2026, 11, 30)],
  ];
  for (const [d, m, expected] of cases) assert.deepEqual(ctx.warrantyEndDate(d, m), expected, `${d} + ${m}`);
});

// Covers: R5, R9, E2 (T5)
test('T5 the period rolls over into later years', () => {
  assert.deepEqual(ctx.warrantyEndDate('15.11.2026. 10:00:00', 2), date(2027, 1, 15));
  assert.deepEqual(ctx.warrantyEndDate('31.3.2026. 10:00:00', 120), date(2036, 3, 31));
  assert.deepEqual(ctx.warrantyEndDate('31.12.2026. 10:00:00', 12), date(2027, 12, 31));
  const url = ctx.buildWarrantyCalendarUrl({ ...SALE, dateTimeStr: '31.12.2026. 10:00:00' }, 12);
  assert.equal(new URL(url).searchParams.get('dates'), '20271231/20280101');
});

// Covers: R5 (T6)
test('T6 warrantyEndDate returns null for an unreadable date or an invalid period', () => {
  assert.equal(ctx.warrantyEndDate('nonsense', 24), null);
  assert.equal(ctx.warrantyEndDate('', 24), null);
  assert.equal(ctx.warrantyEndDate(undefined, 24), null);
  for (const m of [0, 121, 'abc', null, undefined, 2.5, '1e2']) {
    assert.equal(ctx.warrantyEndDate('7.11.2026. 13:25:06', m), null, String(m));
  }
});

// Covers: R7 (T7)
test('T7 formatWarrantyDate writes D.M.YYYY. without zero padding', () => {
  assert.equal(ctx.formatWarrantyDate(date(2028, 11, 7)), '7.11.2028.');
  assert.equal(ctx.formatWarrantyDate(date(2027, 2, 1)), '1.2.2027.');
  assert.equal(ctx.formatWarrantyDate(date(2029, 12, 31)), '31.12.2029.');
});

// Covers: R7, R8, R13 (T8)
test('T8 with a warranty the description gets exactly one 🛡 line, right before the 🔗 line', () => {
  const plain = ctx.buildCalendarUrl(SALE);
  const url = ctx.buildCalendarUrl(SALE, 24);
  const l = lines(url);
  assert.equal(l.at(-2), WARRANTY_LINE);
  assert.ok(l.at(-1).startsWith('🔗'));
  assert.deepEqual(l.filter((_, i) => i !== l.length - 2), SALE_LINES);
  assert.equal(l.at(-2).codePointAt(0), 0x1F6E1);
  assert.equal([...l.at(-2)][1], ' '); // no U+FE0F variation selector between the mark and the space
  assert.equal(l.filter(x => x.startsWith('\u{1F6E1}')).length, 1);
  const p = new URL(url).searchParams, q = new URL(plain).searchParams;
  for (const k of ['action', 'text', 'dates', 'ctz', 'location']) assert.equal(p.get(k), q.get(k), k);
  assert.deepEqual(keys(url), keys(plain));
  // a valid period given as a string works the same (R4)
  assert.equal(ctx.buildCalendarUrl(SALE, '24'), url);
  assert.equal(ctx.buildCalendarUrl(SALE, ' 24 '), url);
  // the description builder takes the period as its third argument
  assert.deepEqual(ctx.buildReceiptDescription(SALE, SALE.items.length, 24).split('\n'), l);
  assert.deepEqual(ctx.buildReceiptDescription(SALE, SALE.items.length).split('\n'), SALE_LINES);
});

// Covers: R7 (T9)
test('T9 without a VAT line the 🛡 line follows the total directly', () => {
  const l = lines(ctx.buildCalendarUrl({ ...SALE, vatTotal: '' }, 24));
  assert.deepEqual(l.slice(-3), ['💰 Укупно: 750,00 RSD', WARRANTY_LINE, '🔗 ' + SALE.sourceUrl]);
});

// Covers: R7, R8, E4 (T10)
test('T10 refunds and other non-sale receipts get no warranty line', () => {
  for (const r of [REFUND, OTHER]) {
    assert.equal(ctx.buildCalendarUrl(r, 24), ctx.buildCalendarUrl(r), r.transactionType);
    assert.ok(!lines(ctx.buildCalendarUrl(r, 24)).some(x => x.startsWith('\u{1F6E1}')), r.transactionType);
    assert.equal(ctx.buildReceiptDescription(r, r.items.length, 24), ctx.buildReceiptDescription(r, r.items.length));
  }
});

// Covers: R8, E6 (T11)
test('T11 buildCalendarUrl rejects an invalid warranty period', () => {
  for (const v of [0, -1, 121, 2.5, 'abc', '', '1e2', '999999', NaN, true]) {
    assert.throws(() => ctx.buildCalendarUrl(SALE, v),
      err => err instanceof Error && err.message === 'Неисправан период гаранције: ' + v, String(v));
  }
});

// Covers: R8, R9, E3 (T12)
test('T12 an unreadable receipt date is reported first by both builders', () => {
  const bad = { ...SALE, dateTimeStr: 'nonsense' };
  assert.throws(() => ctx.buildCalendarUrl(bad, 24), { message: 'Датум рачуна није препознат: nonsense' });
  assert.throws(() => ctx.buildWarrantyCalendarUrl(bad, 24), { message: 'Датум рачуна није препознат: nonsense' });
  // checked before the period and the receipt type
  assert.throws(() => ctx.buildCalendarUrl(bad, 0), /Датум рачуна/);
  assert.throws(() => ctx.buildWarrantyCalendarUrl(bad, 0), /Датум рачуна/);
  assert.throws(() => ctx.buildWarrantyCalendarUrl({ ...bad, transactionType: 'ПРОМЕТ РЕФУНДАЦИЈА' }, null), /Датум рачуна/);
});

// Covers: R9, E14 (T13)
test('T13 buildWarrantyCalendarUrl: an all-day event on the end date with the purchase description', () => {
  const url = ctx.buildWarrantyCalendarUrl(SALE, 24);
  const base = u => { const x = new URL(u); return x.origin + x.pathname; };
  assert.equal(base(url), base(ctx.buildCalendarUrl(SALE)));
  assert.deepEqual(keys(url), ['action', 'text', 'dates', 'ctz', 'details', 'location']);
  const p = new URL(url).searchParams;
  assert.equal(p.get('action'), 'TEMPLATE');
  assert.equal(p.get('text'), 'Гаранција истиче: KAFE PRIMER DOO');
  assert.ok(!p.get('text').includes(' — ')); // the PWA reads the text after ' — ' as an amount (E14)
  assert.equal(p.get('dates'), '20281107/20281108');
  assert.equal(p.get('ctz'), 'Europe/Belgrade');
  assert.equal(p.get('location'), SALE.address);
  assert.equal(p.get('details'), ctx.buildReceiptDescription(SALE, SALE.items.length, 24));
  assert.ok(p.get('details').split('\n').includes(WARRANTY_LINE));
  // string periods are accepted as in R4
  assert.equal(ctx.buildWarrantyCalendarUrl(SALE, '24'), url);
});

// Covers: R9, E12 (T14)
test('T14 without a merchant name the warranty event is titled just "Гаранција истиче"', () => {
  const p = new URL(ctx.buildWarrantyCalendarUrl({ ...SALE, merchantName: '' }, 24)).searchParams;
  assert.equal(p.get('text'), 'Гаранција истиче');
});

// Covers: R9, E4 (T15)
test('T15 buildWarrantyCalendarUrl rejects a missing or invalid period, then a non-sale receipt', () => {
  for (const v of [null, undefined, 0, 121, 'abc', '', 2.5]) {
    assert.throws(() => ctx.buildWarrantyCalendarUrl(SALE, v),
      err => err instanceof Error && err.message === 'Неисправан период гаранције: ' + v, String(v));
  }
  assert.throws(() => ctx.buildWarrantyCalendarUrl(SALE), { message: 'Неисправан период гаранције: undefined' });
  for (const r of [REFUND, OTHER]) {
    assert.throws(() => ctx.buildWarrantyCalendarUrl(r, 24),
      err => err instanceof Error && err.message === 'Гаранција се додаје само за рачун продаје.', r.transactionType);
  }
  // the period is checked before the receipt type
  assert.throws(() => ctx.buildWarrantyCalendarUrl(REFUND, 0), /Неисправан период гаранције/);
});

// Covers: R10, E7 (T16)
test('T16 long receipts with a warranty: both URLs fit, only item lines are dropped', () => {
  for (const url of [ctx.buildCalendarUrl(LONG, 24), ctx.buildWarrantyCalendarUrl(LONG, 24)]) {
    assert.ok(url.length <= 6000, String(url.length));
    const details = new URL(url).searchParams.get('details');
    assert.match(details, /… \+\d+/);
    const l = details.split('\n');
    assert.ok(l.includes(WARRANTY_LINE));
    assert.ok(l.includes('💰 Укупно: 750,00 RSD'));
    assert.ok(l.at(-1).startsWith('🔗 https://suf.purs.gov.rs/'));
    // the item lines kept are the first ones, and every other line is still there
    const items = l.filter(x => x.startsWith('• '));
    assert.ok(items.length > 0 && items.length < LONG.items.length);
    assert.deepEqual(items, LONG.items.slice(0, items.length).map(it => `• ${it.name} ×${it.qty} = ${it.total} RSD`));
    assert.ok(l.includes(`… +${LONG.items.length - items.length}`));
    const rest = x => !x.startsWith('• ') && !/^… \+\d+$/.test(x);
    assert.deepEqual(l.filter(rest), ctx.buildReceiptDescription(LONG, 0, 24).split('\n').filter(rest));
  }
});

// Covers: R6, E11 (T17)
const E11 = [
  ['1.1.2026. 00:10:00', 6, date(2026, 7, 1), '20260701/20260702'],
  ['31.12.2026. 23:59:59', 1, date(2027, 1, 31), '20270131/20270201'],
  ['29.3.2026. 02:30:00', 6, date(2026, 9, 29), '20260929/20260930'],   // spring DST change
  ['25.10.2026. 02:30:00', 12, date(2027, 10, 25), '20271025/20271026'], // autumn DST change
];
test('T17 end dates around midnight and DST changes depend only on the printed date', () => {
  for (const [d, m, expected, dates] of E11) {
    assert.deepEqual(ctx.warrantyEndDate(d, m), expected, `${d} + ${m}`);
    const r = { ...SALE, dateTimeStr: d };
    assert.equal(new URL(ctx.buildWarrantyCalendarUrl(r, m)).searchParams.get('dates'), dates, `${d} + ${m}`);
    assert.ok(lines(ctx.buildCalendarUrl(r, m)).includes('\u{1F6E1} Гаранција до: ' + ctx.formatWarrantyDate(expected)));
  }
});

// Covers: R6, E11 (T17): the same results when the machine runs in other timezones.
test('T17 results do not change with the machine timezone', () => {
  const script = `
    Object.assign(globalThis, require(${JSON.stringify(path.join(__dirname, '..', 'src', 'parser.js'))}));
    const c = require(${JSON.stringify(path.join(__dirname, '..', 'src', 'calendar-url.js'))});
    const [sale, cases] = JSON.parse(process.argv[1]);
    process.stdout.write(JSON.stringify(cases.map(([d, m]) => {
      const r = { ...sale, dateTimeStr: d };
      return [c.warrantyEndDate(d, m), c.buildCalendarUrl(r, m), c.buildWarrantyCalendarUrl(r, m)];
    })));`;
  const arg = JSON.stringify([SALE, E11]);
  const expected = E11.map(([d, m, end]) => {
    const r = { ...SALE, dateTimeStr: d };
    return [end, ctx.buildCalendarUrl(r, m), ctx.buildWarrantyCalendarUrl(r, m)];
  });
  for (const TZ of ['America/Los_Angeles', 'Pacific/Kiritimati', 'Europe/Belgrade', 'UTC']) {
    const out = execFileSync(process.execPath, ['-e', script, arg], { env: { ...process.env, TZ }, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(out), expected, TZ);
  }
});

// Covers: R11, E5, E17 (T18)
test('T18 isWarrantyExpired compares with today\'s date in Belgrade; the end day itself is not expired', () => {
  assert.equal(ctx.isWarrantyExpired(date(2028, 11, 7), new Date('2028-11-07T22:59:59Z')), false);
  assert.equal(ctx.isWarrantyExpired(date(2028, 11, 7), new Date('2028-11-07T23:00:00Z')), true);
  assert.equal(ctx.isWarrantyExpired(date(2027, 7, 1), new Date('2027-07-01T21:59:59Z')), false);
  assert.equal(ctx.isWarrantyExpired(date(2027, 7, 1), new Date('2027-07-01T22:00:00Z')), true);
  assert.equal(ctx.isWarrantyExpired(date(2028, 11, 7), new Date('2026-01-01T12:00:00Z')), false);
  assert.equal(ctx.isWarrantyExpired(date(2021, 4, 15), new Date('2026-01-01T12:00:00Z')), true);
  // without a "now" it compares with the current date
  assert.equal(ctx.isWarrantyExpired(date(2000, 1, 1)), true);
  assert.equal(ctx.isWarrantyExpired(date(2999, 1, 1)), false);
});

// Covers: E5: an expired warranty is written into the event without any "expired" marker.
test('E5 an old receipt keeps the plain warranty line in the event', () => {
  const old = { ...SALE, dateTimeStr: '15.10.2020. 10:15:30' };
  assert.equal(lines(ctx.buildCalendarUrl(old, 6)).at(-2), '\u{1F6E1} Гаранција до: 15.4.2021.');
  assert.equal(new URL(ctx.buildWarrantyCalendarUrl(old, 6)).searchParams.get('dates'), '20210415/20210416');
});

// Covers: E8: each call depends only on its arguments, so turning the warranty off again gives today's URL.
test('E8 changing the period between calls leaves no state behind', () => {
  const plain = ctx.buildCalendarUrl(SALE);
  const with24 = ctx.buildCalendarUrl(SALE, 24);
  assert.ok(lines(ctx.buildCalendarUrl(SALE, 6)).includes('\u{1F6E1} Гаранција до: 7.5.2027.'));
  ctx.buildWarrantyCalendarUrl(SALE, 36);
  assert.equal(ctx.buildCalendarUrl(SALE), plain);
  assert.equal(ctx.buildCalendarUrl(SALE, null), plain);
  assert.equal(ctx.buildCalendarUrl(SALE, 24), with24);
});

// Covers: R3, R4 (T19)
test('T19 the warranty constants and functions are exported', () => {
  assert.deepEqual(ctx.WARRANTY_PRESETS, [6, 12, 24, 36]);
  assert.equal(ctx.DEFAULT_WARRANTY_MONTHS, 24);
  assert.equal(ctx.MAX_WARRANTY_MONTHS, 120);
  for (const name of ['buildCalendarUrl', 'buildReceiptDescription', 'buildWarrantyCalendarUrl', 'normalizeWarrantyMonths',
    'warrantyEndDate', 'formatWarrantyDate', 'isWarrantyExpired']) {
    assert.equal(typeof ctx[name], 'function', name);
  }
});
