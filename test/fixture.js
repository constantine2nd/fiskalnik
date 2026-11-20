// A made-up receipt in the tax portal's format, for the unit tests, the harness and the store screenshots.
// Works as a browser script (window.FIXTURE) and as a Node module.
(function (root) {
  const W = 40; // journal width in characters

  const center = s => (' '.repeat(Math.floor((W - s.length) / 2)) + s).padEnd(W);
  const lr = (left, right) => left + right.padStart(W - left.length);
  const title = (s, ch = '=') => {
    const pad = W - s.length - 2;
    return ch.repeat(Math.floor(pad / 2)) + ' ' + s + ' ' + ch.repeat(pad - Math.floor(pad / 2));
  };
  const price = (unit, qty, total) => unit.padStart(13) + qty.padStart(11) + total.padStart(16);
  const rule = ch => ch.repeat(W);

  // The link the sample QR code (test/sample-qr.png) contains. It is not a real receipt.
  const receiptUrl = 'https://suf.purs.gov.rs/v/?vl=' + 'FISKALNIK0SAMPLE0RECEIPT0NOT0REAL0'.repeat(9);

  const journalTop = [
    title('ФИСКАЛНИ РАЧУН'),
    center('100000008'),
    center('KAFE PRIMER DOO'),
    center('1000001-Kafe Primer'),
    center('ПРИМЕРНА 1'),
    center('Београд'),
    lr('Касир:', 'Ana'),
    lr('ЕСИР број:', '100/1.0'),
    '-------------ПРОМЕТ ПРОДАЈА-------------',
    'Артикли',
    rule('='),
    'Назив   Цена         Кол.         Укупно',
    'Espresso (Ђ)'.padEnd(W),
    price('220,00', '1', '220,00'),
    'Limunada 0.3 (Ђ)'.padEnd(W),
    price('295,00', '1', '295,00'),
    'Kroasan sa cokoladom/KOM/1000123 (Е)'.padEnd(W),
    price('180,00', '2', '360,00'),
    rule('-'),
    lr('Укупан износ:', '875,00'),
    lr('Готовина:', '1.000,00'),
    lr('Повраћај:', '125,00'),
    rule('='),
    'Ознака       Име      Стопа        Порез',
    'Ђ           О-ПДВ   20,00%         85,83',
    'Е           П-ПДВ   10,00%         32,73',
    rule('-'),
    lr('Укупан износ пореза:', '118,56'),
    rule('='),
    lr('ПФР време:', '15.10.2026. 10:15:30'),
    lr('ПФР број рачуна:', 'ABCD1234-ABCD1234-1001'),
    lr('Бројач рачуна:', '998/1001ПП'),
    rule('='),
  ].join('\n');
  const journalBottom = title('КРАЈ ФИСКАЛНОГ РАЧУНА');

  // The receipt page as the portal serves it: named fields plus the journal in a <pre>, QR image inside.
  const receiptPageHtml = qrDataUrl => `<!doctype html><html><head><meta charset="utf-8"><title>Sample receipt</title></head><body>
<span id="tinLabel">100000008</span>
<span id="addressLabel">ПРИМЕРНА 1</span>
<span id="cityLabel">Београд</span>
<span id="totalAmountLabel">875,00</span>
<span id="invoiceNumberLabel">ABCD1234-ABCD1234-1001</span>
<span id="sdcDateTimeLabel">15.10.2026. 10:15:30</span>
<pre>${journalTop}
<img src="${qrDataUrl}">
${journalBottom}</pre>
</body></html>`;

  const api = { receiptUrl, journal: journalTop + '\n\n' + journalBottom, receiptPageHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FIXTURE = api;
})(typeof window !== 'undefined' ? window : globalThis);
