# Chrome Web Store listing – Fiskalnik

Each text field has its own file in [`fields/`](fields/): open it, select all, copy, paste. The files contain only
the text for that field. Choices that are not text (drop-downs, checkboxes) are listed here.

## Store listing tab

| Field | Paste / choose |
|---|---|
| Name, Summary | come from `manifest.json` automatically (summary: 116 of 132 characters) |
| Description | [`fields/store-listing-description.txt`](fields/store-listing-description.txt) (Serbian, then English) |
| Category | Productivity → Workflow & Planning ("Tools" also fits) |
| Language | Serbian (the interface is Serbian; the description carries both languages) |
| Store icon (128×128) | `icons/icon128.png` |
| Screenshots (1280×800) | `store/screenshots/1-scan.png`, `2-receipt.png`, `3-event.png` |
| Small promo tile (440×280) | `store/promo-440x280.png` |
| Marquee (1400×560) | optional, not made |
| Official URL | **None** (only lists sites verified in Google Search Console) |
| Homepage URL | [`fields/store-listing-homepage-url.txt`](fields/store-listing-homepage-url.txt) |
| Support URL | [`fields/store-listing-support-url.txt`](fields/store-listing-support-url.txt) |

## Privacy practices tab

| Field | Paste / choose |
|---|---|
| Single purpose description | [`fields/privacy-single-purpose.txt`](fields/privacy-single-purpose.txt) |
| Justification: activeTab | [`fields/privacy-justification-activetab.txt`](fields/privacy-justification-activetab.txt) |
| Justification: host permission | [`fields/privacy-justification-host-permission.txt`](fields/privacy-justification-host-permission.txt) |
| Remote code | **No, I am not using remote code** (all JavaScript and the QR reader's WebAssembly file are in the package) |
| Data usage: types | tick **Financial and payment information** and **Website content**; leave the rest unticked |
| Data usage: certifications | tick all three (no selling/transfer, no unrelated use, no creditworthiness/lending) |
| Privacy policy URL | [`fields/privacy-policy-url.txt`](fields/privacy-policy-url.txt) |

Why those two data types: a receipt is a record of a purchase (what was bought, for how much, how it was paid), and the
extension reads it from a web page. It keeps nothing, and passes the receipt only to Google Calendar when the user
clicks "Додај у календар"; ticking what it handles is the safe choice, and the privacy policy explains where it goes.
This is our reading of the form, not something the store has confirmed.

If the reviewer asks about WebAssembly: `vendor/zxing_reader.wasm` is the unmodified reader build of the open-source
[zxing-wasm](https://github.com/Sec-ant/zxing-wasm) 3.1.7 (QR decoding); the manifest allows it with
`'wasm-unsafe-eval'`, which Manifest V3 permits for packaged WebAssembly.

## Distribution tab

| Field | Choose |
|---|---|
| Visibility | Public (or Unlisted to share only by link first) |
| Regions | All regions (or Serbia only) |
| Pricing | Free |

## Test instructions (optional, for the reviewer)

[`fields/test-instructions.txt`](fields/test-instructions.txt) — **put a real receipt link in it first** (see the
checklist). Without one the reviewer has nothing to try the extension on.

## Account (Settings page, once)

- Trader / non-trader (EEA): non-trader for a free personal open-source project; trader if published for a business or paid.
- Contact email: enter, save, and click the link in Google's verification email.
