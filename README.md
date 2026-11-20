# Fiskalnik

A browser extension for Chrome and Firefox (desktop and Android) that adds Serbian fiscal receipts to Google Calendar.
*Not affiliated with, endorsed or sponsored by the Tax Administration of Serbia or Google.*
Open a receipt on `suf.purs.gov.rs` and click **Додај у календар**, or scan the receipt's QR code from the toolbar
popup. A prefilled Google Calendar event opens; you press **Save**.
No account, no server: the extension reads the receipt from the tax portal and hands it to the calendar tab you are
signed in to.

## Install (developer mode)

**Chrome**

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. **Load unpacked** → choose this folder.
3. Open a receipt link, `https://suf.purs.gov.rs/v/?vl=…` (reload the tab if it was already open).

**Firefox** (140 or newer)

1. `python3 scripts/build.py`
2. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → `dist/firefox/manifest.json`.
   It stays until Firefox is closed.
3. If the button doesn't show on a receipt page: `about:addons` → Fiskalnik → **Permissions** → allow `suf.purs.gov.rs`.

**Firefox for Android** (142 or newer): phone connected with USB debugging and *Remote debugging via USB* on in
Firefox's settings, then
`npx web-ext run -t firefox-android -s dist/firefox --adb-device <id>`.

## Use

**On a receipt page.** Click **Додај у календар** (top right). Google Calendar opens in a new tab with the event
filled in: title `Merchant — total RSD`, the receipt's date and time (15 minutes long, Belgrade time), the address as
location, and the items, total, VAT and receipt link in the description. Pick the calendar and press **Save**.

**From a QR code.** Click the toolbar icon:

- **Скенирај QR на овој картици** reads a QR code visible in the current tab (an e-receipt in an email, a PDF, a
  photo). Zoom in if the code is small.
- **Налепи слику** (Ctrl+V) takes a screenshot or a copied image.
- **Изабери слику…** opens the same page in a full tab, where you can choose an image file or drag one in.

On a receipt page the scan button needs no QR code: it uses the page's own link.

In Firefox for Android the same page opens full screen (⋮ → Extensions → Fiskalnik) with **Сликај рачун** first,
which opens the camera; **Изабери слику…** opens your photos.

The popup shows the receipt as it is printed, with its QR code; **Додај у календар** above it opens the event.

Refund receipts get a negative amount in the title and total and a `↩` line; other non-sale receipts (advance,
training, …) get a `🏷` line.

The event description uses the same format as the [Receipt Scanner](https://github.com/constantine2nd/receipt) PWA,
so events saved to its **Receipts** calendar show up there too.

## Limitations

- You save the event yourself, and choose the calendar each time; the form opens on your default calendar.
- No duplicate check: adding the same receipt twice makes two events.
- The event travels in the link, so very long receipts are shortened: item lines are dropped from the end
  (`… +N`) to keep the link under 6000 characters. The total and the receipt link are always kept.
- Images: PNG, JPEG, WebP, AVIF, GIF, BMP. HEIC (iPhone photos) can't be opened by Chrome.
- Chrome's own pages (settings, new tab, the Web Store) can't be scanned.
- Journals are read in Cyrillic. Latin-script journals and item lines with negative amounts (some refunds and
  discounts) haven't been tested on real receipts.
- If the tax portal changes its page, fields may come out empty.

## Publishing

One codebase, one package per store. `manifest.json` is the Chrome manifest; the Firefox one is the same with
`manifest.firefox.json` merged over it (add-on ID, minimum versions, data-collection declaration).

```bash
python3 scripts/build.py      # → dist/fiskalnik-chrome-<version>.zip, dist/fiskalnik-firefox-<version>.zip, dist/firefox/
scripts/screenshots.sh        # → store/chrome/screenshots/*.png, store/chrome/promo-440x280.png, docs/og-image.png
```

- Chrome Web Store: [`store/chrome/CHECKLIST.md`](store/chrome/CHECKLIST.md)
- addons.mozilla.org (Firefox, desktop and Android): [`store/firefox/CHECKLIST.md`](store/firefox/CHECKLIST.md)

Privacy policy: [docs/privacy.html](docs/privacy.html) (published with GitHub Pages from `docs/`).

## Project layout

```
manifest.json        Manifest V3 (Chrome); permissions: activeTab, host https://suf.purs.gov.rs/*
manifest.firefox.json  what the Firefox manifest adds (merged in by scripts/build.py)
popup.html           the scan page (toolbar popup; the same page in a tab for file / drag and drop)
src/parser.js        receipt page HTML → receipt object (pure, tested in Node; shared with the Receipt Scanner PWA)
src/calendar-url.js  receipt object → prefilled Google Calendar link (pure, tested in Node)
src/content.js       the "Додај у календар" button on receipt pages (content script)
src/content.css
src/popup.js         image → QR → fetch receipt → show journal → open calendar
src/popup.css
vendor/              zxing-wasm 3.1.7 reader (QR decoding), bundled so nothing loads from a CDN
icons/               icon.svg (48 px and up), icon-small.svg (16/32 px), render.py → icon16/32/48/128.png
scripts/build.py     store upload packages, one per browser (dist/)
scripts/screenshots.sh  store images with headless Chromium
store/chrome/        Chrome Web Store: listing.md (what goes where), fields/ (one text file per field), CHECKLIST.md, images
store/firefox/       addons.mozilla.org: the same three
docs/                GitHub Pages: landing page and privacy policy
test/parser.test.js        unit tests for src/parser.js
test/calendar-url.test.js  unit tests for src/calendar-url.js
test/harness.html    the real popup.html with a made-up receipt and stand-ins for chrome.* and the tax portal
test/fixture.js      that made-up receipt;  test/sample-qr.png  its QR code
```

## Development

```bash
node --test test/*.test.js           # unit tests (Node 18+)
python3 -m http.server 8766          # then open:
# http://127.0.0.1:8766/test/harness.html            the toolbar popup
# http://127.0.0.1:8766/test/harness.html?scan       popup after scanning the sample receipt
# http://127.0.0.1:8766/test/harness.html?tab&scan   full-tab page with the sample receipt
```

In the harness "Додај у календар" opens nothing; the links it would open are collected in `window.__opened`.

Icons: edit `icons/icon.svg` / `icons/icon-small.svg`, then `python3 icons/render.py` (needs `cairosvg`).

After changing the extension: ↻ on its card in `chrome://extensions`, then reload the receipt tab
(Firefox: rebuild, then **Reload** in `about:debugging`).

Browser differences belong in `src/` as feature checks (the popup hides *scan this tab* where the browser
can't take the picture), not in separate files.

`src/parser.js` is kept identical to `js/parser.js` in the Receipt Scanner PWA; change both together.

## License

[MIT](LICENSE). `vendor/` contains [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (MIT, see
`vendor/zxing-wasm-LICENSE`).
