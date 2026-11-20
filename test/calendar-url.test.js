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
