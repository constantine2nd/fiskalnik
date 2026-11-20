// Run: node --test test/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePreText, cleanItemName, parseSerbianDateParts, transactionKind } = require('../src/parser.js');
const FIXTURE = require('./fixture.js');


// Builds a journal around the given item and totals lines.
function journal({ cashier = 'Касир:                                82', items, totals = CARD_TOTALS }) {
  return [
    '============ ФИСКАЛНИ РАЧУН ============',
    '               106884584                ',
    '             LIDL SRBIJA KD             ',
    cashier,
    '-------------ПРОМЕТ ПРОДАЈА-------------',
    'Артикли',
    '========================================',
    'Назив   Цена         Кол.         Укупно',
    ...items,
    '----------------------------------------',
    ...totals,
    '========================================',
    'Укупан износ пореза:              175,97',
    '========================================',
  ].join('\n');
}
const PRICE = '       113,49          1          113,49';
const TOTAL = 'Укупан износ:                   1.154,89';
const CARD_TOTALS = [TOTAL, 'Платна картица:                 1.154,89'];

test('sample receipt (test/fixture.js) parses completely', () => {
  const r = parsePreText(FIXTURE.journal);
  assert.equal(r.merchantName, 'KAFE PRIMER DOO');
  assert.equal(r.cashier, 'Ana');
  assert.equal(r.transactionType, 'ПРОМЕТ ПРОДАЈА');
  assert.deepEqual(r.items, [
    { name: 'Espresso', unitPrice: '220,00', qty: '1', total: '220,00' },
    { name: 'Limunada 0.3', unitPrice: '295,00', qty: '1', total: '295,00' },
    { name: 'Kroasan sa cokoladom', unitPrice: '180,00', qty: '2', total: '360,00' },
  ]);
  assert.equal(r.paymentMethod, 'Готовина');
  assert.equal(r.paymentAmount, '1.000,00');
  assert.equal(r.vatTotal, '118,56');
});

test('change and other non-payment lines are not payment methods', () => {
  const r = parsePreText(journal({
    items: ['Hleb/KOM/123 (Е)', PRICE],
    totals: [TOTAL, 'Готовина:                       2.000,00', 'Повраћај:                         845,11'],
  }));
  assert.equal(r.paymentMethod, 'Готовина');
  assert.equal(r.paymentAmount, '2.000,00');
});

test('two real payment methods are both kept', () => {
  const r = parsePreText(journal({
    items: ['Hleb/KOM/123 (Е)', PRICE],
    totals: [TOTAL, 'Готовина:                         154,89', 'Платна картица:                 1.000,00'],
  }));
  assert.equal(r.paymentMethod, 'Готовина + Платна картица');
  assert.equal(r.paymentAmount, '');
});

test('name wrapped over three full-width lines keeps its beginning, joined without spaces', () => {
  const r = parsePreText(journal({
    items: [
      'PARACETAMOL HEMOFARM TABLETE 500MG BLIST',
      'ER 2X10 FILM TABLETA ORIGINALNO PAKOVANJ',
      'E/KOM/8600097012345 (Е)',
      PRICE,
    ],
  }));
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].name, 'PARACETAMOL HEMOFARM TABLETE 500MG BLISTER 2X10 FILM TABLETA ORIGINALNO PAKOVANJE');
});

test('name wrapped at a word boundary (short first line) is joined with a space', () => {
  const r = parsePreText(journal({
    items: ['Cokolada mlecna sa lesnikom', '100g/KOM/7002750 (Ђ)', PRICE],
  }));
  assert.equal(r.items[0].name, 'Cokolada mlecna sa lesnikom 100g');
});

test('line cut inside a parenthesis is rejoined', () => {
  const r = parsePreText(journal({
    items: [
      'SLAG KREM (KOM) (Ђ', ')', PRICE,
      'MLEKO SVEZE (KOM', ') (Е)', PRICE,
    ],
  }));
  assert.deepEqual(r.items.map(i => i.name), ['SLAG KREM (KOM)', 'MLEKO SVEZE (KOM)']);
});

test('several items in a row do not bleed into each other', () => {
  const r = parsePreText(journal({
    items: ['Sal. Vit-Fit op./KOM/7002750 (Е)', PRICE, 'Jogurt (1L)/KOM/7002751 (Е)', PRICE],
  }));
  assert.deepEqual(r.items.map(i => i.name), ['Sal. Vit-Fit op.', 'Jogurt (1L)']);
});

test('cleanItemName', () => {
  assert.equal(cleanItemName('Jogurt (1L)/KOM/7002750 (Е)'), 'Jogurt (1L)');
  assert.equal(cleanItemName('Хлеб/КОМ/123 (Е)'), 'Хлеб');
  assert.equal(cleanItemName('Espresso (Ђ)'), 'Espresso');
  assert.equal(cleanItemName('SLAG KREM (KOM) (Ђ)'), 'SLAG KREM (KOM)');
  assert.equal(cleanItemName('Limunada 0.3 (Ђ)'), 'Limunada 0.3');
});

test('cashier name with several words is kept whole; numeric cashier still works', () => {
  const items = ['Hleb/KOM/123 (Е)', PRICE];
  assert.equal(parsePreText(journal({ cashier: 'Касир:                    Marko Petrović', items })).cashier, 'Marko Petrović');
  assert.equal(parsePreText(journal({ items })).cashier, '82');
  const empty = parsePreText(journal({ cashier: 'Касир:', items }));
  assert.equal(empty.cashier, '');
  assert.equal(empty.merchantName, 'LIDL SRBIJA KD');
});

test('an unlabelled name before a price line is kept as printed', () => {
  const r = parsePreText(journal({ items: ['Usluga dostave', PRICE] }));
  assert.equal(r.items[0].name, 'Usluga dostave');
});

test('parseSerbianDateParts', () => {
  assert.deepEqual(parseSerbianDateParts('7.11.2026. 13:25:06'), { year: 2026, month: 11, day: 7, hour: 13, minute: 25, second: 6 });
  assert.deepEqual(parseSerbianDateParts('14.03.2026. 8:04:44'), { year: 2026, month: 3, day: 14, hour: 8, minute: 4, second: 44 });
  assert.equal(parseSerbianDateParts('nonsense'), null);
  assert.equal(parseSerbianDateParts(''), null);
});

test('transactionKind', () => {
  assert.equal(transactionKind('ПРОМЕТ ПРОДАЈА'), 'sale');
  assert.equal(transactionKind(''), 'sale');
  assert.equal(transactionKind('ПРОМЕТ РЕФУНДАЦИЈА'), 'refund');
  assert.equal(transactionKind('АВАНС РЕФУНДАЦИЈА'), 'refund');
  assert.equal(transactionKind('АВАНС ПРОДАЈА'), 'other');
});
