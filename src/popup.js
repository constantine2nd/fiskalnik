// Scan page: image → QR → receipt URL → fetch → parse → prefilled Google Calendar form.
//
// The same page runs in two modes:
//   popup — "scan this tab" and paste; the file picker opens the tab mode,
//           because a popup closes as soon as it loses focus.
//   tab   — file picker, drag and drop, paste.

const IN_TAB = new URLSearchParams(location.search).has('tab');
const RECEIPT_HOST = 'suf.purs.gov.rs';

const $ = id => document.getElementById(id);
const statusEl = $('status');

const receiptEl = $('receipt');
const MAX_CARD_ITEMS = 6;

// kind: 'busy' (spinner) | 'error' | '' (plain)
function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.className = kind;
}

function setBusy(busy) {
  for (const id of ['scan-tab', 'pick-file']) $(id).disabled = busy;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// The fiscal journal exactly as the portal prints it: 40-column monospace text with the
// QR image between the last "====" line and the "КРАЈ ФИСКАЛНОГ РАЧУНА" footer.
// preHtml is untrusted page markup, so it is parsed in an inert document and rebuilt
// from text nodes and data-URL images only — never inserted as HTML.
function renderJournal(preHtml) {
  const src = new DOMParser().parseFromString(`<pre>${preHtml}</pre>`, 'text/html').querySelector('pre');
  const paper = el('pre', 'paper');
  for (const node of src?.childNodes || []) {
    if (node.nodeName === 'IMG') {
      const imgSrc = node.getAttribute('src') || '';
      if (!/^data:image\/(png|gif|jpeg);base64,/.test(imgSrc)) continue;
      const img = el('img');
      img.src = imgSrc;
      img.alt = 'QR код рачуна';
      paper.append(img);
    } else if (node.nodeName === 'BR') {
      paper.append('\n');
    } else {
      paper.append(node.textContent);
    }
  }
  return paper;
}

// Fallback when the page has no journal block: a short summary built from parsed fields.
function renderSummary(receipt) {
  const box = el('div', 'summary');
  box.append(
    el('p', 'merchant', receipt.merchantName || 'Рачун'),
    el('p', 'meta', [receipt.dateTimeStr, receipt.address].filter(Boolean).join(' · ')),
  );
  if (receipt.items.length) {
    const list = el('ul');
    for (const it of receipt.items.slice(0, MAX_CARD_ITEMS)) {
      const row = el('li');
      row.append(el('span', '', it.qty === '1' ? it.name : `${it.name} ×${it.qty}`), el('span', '', it.total));
      list.append(row);
    }
    const hidden = receipt.items.length - MAX_CARD_ITEMS;
    if (hidden > 0) list.append(el('li', 'more', `… још ${hidden}`));
    box.append(list);
  }
  const total = el('div', 'total');
  total.append(el('span', '', 'Укупно'), el('span', '', `${receipt.total} RSD`));
  box.append(total);
  return box;
}

// Shows the receipt for review; the calendar form opens only when the user presses the button.
function showReceipt(receipt, calendarUrl) {
  const add = el('button', 'primary', 'Додај у календар');
  add.addEventListener('click', () => chrome.tabs.create({ url: calendarUrl }));

  receiptEl.replaceChildren(add, receipt.preHtml ? renderJournal(receipt.preHtml) : renderSummary(receipt));
  receiptEl.classList.remove('hidden');
  add.focus();
}

// Load the bundled .wasm from the extension package instead of the library's default CDN.
ZXingWASM.prepareZXingModule({
  overrides: { locateFile: path => chrome.runtime.getURL('vendor/' + path) },
});

function isReceiptUrl(text) {
  try {
    const u = new URL(text);
    return u.protocol === 'https:' && u.hostname === RECEIPT_HOST;
  } catch { return false; }
}

const MAX_SCAN_EDGE = 2400; // px; larger images are first scanned scaled down to this
const READER_OPTIONS = {
  formats: ['QRCode'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  maxNumberOfSymbols: 4,
};

function bitmapPixels(bitmap, scale) {
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const ctx = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

// The browser decodes the image (the QR library's own decoder only knows PNG/JPEG/GIF/BMP;
// this adds WebP and AVIF) and the library gets raw pixels. A big photo is scanned scaled
// down first, which is several times cheaper, and at full size only if that finds nothing.
async function decodeQr(blob) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new Error('Слика не може да се отвори. Користи PNG, JPEG или WebP.');
  }

  let texts = [];
  try {
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const scales = longEdge > MAX_SCAN_EDGE ? [MAX_SCAN_EDGE / longEdge, 1] : [1];
    for (const scale of scales) {
      const results = await ZXingWASM.readBarcodes(bitmapPixels(bitmap, scale), READER_OPTIONS);
      texts = results.map(r => (r.text || '').trim()).filter(Boolean);
      if (texts.length) break;
    }
  } finally {
    bitmap.close();
  }

  if (!texts.length) throw new Error('QR код није пронађен на слици.');
  const receiptUrl = texts.find(isReceiptUrl);
  if (!receiptUrl) throw new Error('QR код није фискални рачун: ' + texts[0].slice(0, 80));
  return receiptUrl;
}

// Only the newest scan may touch the UI. Starting a scan aborts the previous one; an
// aborted run stops at its next checkpoint and leaves the status and buttons alone.
let currentRun = null;

// source: an image Blob, or an async function that produces one (the tab screenshot).
async function handleImage(source) {
  currentRun?.abort();
  currentRun = new AbortController();
  const { signal } = currentRun;

  setBusy(true);
  receiptEl.classList.add('hidden');
  try {
    const blob = typeof source === 'function' ? await source() : source;
    signal.throwIfAborted();

    setStatus('Читам QR код…', 'busy');
    const url = await decodeQr(blob);
    signal.throwIfAborted();

    setStatus('Преузимам рачун…', 'busy');
    const res = await fetch(url, { signal }).catch(() => {
      signal.throwIfAborted();
      throw new Error(`Портал ${RECEIPT_HOST} није доступан. Провери везу и покушај поново.`);
    });
    if (!res.ok) throw new Error('Портал је вратио HTTP ' + res.status);
    const html = await res.text();
    signal.throwIfAborted();

    const receipt = parseReceiptHtml(html, url);
    const calendarUrl = buildCalendarUrl(receipt);
    setStatus('');
    showReceipt(receipt, calendarUrl);
  } catch (err) {
    if (!signal.aborted) setStatus(err.message, 'error');
  } finally {
    if (!signal.aborted) setBusy(false);
  }
}

// ── Scan the visible tab (popup mode only) ────────────────────
$('scan-tab').addEventListener('click', () => handleImage(async () => {
  setStatus('Снимам картицу…', 'busy');
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
    return await (await fetch(dataUrl)).blob();
  } catch (err) {
    throw new Error('Ова картица не може да се сними: ' + err.message);
  }
}));

// ── File picker ───────────────────────────────────────────────
$('pick-file').addEventListener('click', () => {
  if (IN_TAB) $('file').click();
  else chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?tab') });
});
$('file').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) handleImage(file);
});

// ── Paste ─────────────────────────────────────────────────────
document.addEventListener('paste', e => {
  const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
  if (item) { e.preventDefault(); handleImage(item.getAsFile()); }
  else setStatus('У клипборду нема слике.', 'error');
});

// ── Drag and drop (tab mode only) ─────────────────────────────
if (IN_TAB) {
  document.body.classList.add('in-tab');
  $('scan-tab').classList.add('hidden');
  $('drop-hint').classList.remove('hidden');
  const drop = $('drop');
  document.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  document.addEventListener('dragleave', () => drop.classList.remove('over'));
  document.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('over');
    const file = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/'));
    if (file) handleImage(file);
    else setStatus('Превуци фајл слике.', 'error');
  });
}
