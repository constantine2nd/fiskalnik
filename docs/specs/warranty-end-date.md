# Warranty end date for a receipt
Status: draft, amendment 5 (consolidated) · Author: sdlc-spec-writer · Date: 2026-11-27

**Amendment history.** Each amendment's earlier text is in the git history of this file.
- 048c683: first version.
- Amendment 1 (6c8f4d7):
  - the expiry event drops its money lines;
  - safe title;
  - Intl parts in `isWarrantyExpired`;
  - numeric custom field.
- Amendment 2 (7c41516):
  - paste into the field;
  - `#add-calendar` errors;
  - one expiry tab per choice;
  - trimmed title.
- Amendment 3 (1bce275): only text-entry fields keep paste and drag-and-drop.
- Amendment 4 (745f5aa):
  - the expiry form opens in front;
  - two scans for both events.
- **Amendment 5 (this version), a UI redesign the user asked for:**
  - one button with a choice, **Додај као: Рачун / Гаранција**;
  - the purchase event goes back to exactly `main`'s output, so there is no `🛡` line in it any more;
  - the second button `#add-warranty` is gone.

  IDs (R#, E#, T#, H#, S#, A#) are kept stable. Items removed in amendment 5 stay as one-line stubs saying why.

## Summary
In the popup's review step for a sale receipt, the user chooses what **Додај у календар** adds:
- **Рачун** (default): the purchase event, exactly as on `main`.
- **Гаранција**: an all-day event on the day the warranty ends. The period is 6, 12, 24 or 36 months or a custom
  number of months, counted from the receipt's own date.

The point is to know when a purchase's warranty runs out. Nothing is stored. In the toolbar popup one scan adds one
event, so getting both takes two scans; in the full-tab page the user switches the choice and clicks again.

## Context
Line numbers in this section refer to `main` (`31d7ab3`), before this feature.

- **Pure calendar module.** `src/calendar-url.js` builds the Google Calendar template URL from a parsed receipt.
  - `receiptWallTime()` (`src/calendar-url.js:12-15`) keeps the receipt's Belgrade wall-clock time in a UTC
    timestamp, used only as a timezone-free container. `formatCalendarStamp()` (`:17-19`) formats it.
  - `buildReceiptDescription(receipt, itemLimit)` (`:31-56`) writes the emoji-prefixed description that the
    Receipt Scanner PWA reads back (comment at `:1-4`).
  - `buildCalendarUrl(receipt)` (`:58-77`) throws `'Датум рачуна није препознат: ' + dateTimeStr` for an unreadable
    date (`:60`). It drops item lines from the end until the URL is at most `MAX_CALENDAR_URL_LENGTH = 6000`
    (`:6`, `:72-76`).
  - Exports for Node go through the `module.exports` guard (`:79-82`). In the browser the functions are plain
    globals.
- **Date parsing.** `parseSerbianDateParts()` (`src/parser.js:265-270`) turns `"7.11.2026. 13:25:06"` into
  `{year, month, day, hour, minute, second}` or `null`. `transactionKind()` (`src/parser.js:281-286`) returns
  `'sale' | 'refund' | 'other'`; an empty type counts as a sale. `src/parser.js` is kept identical to the PWA's
  copy (README "Development"), so **it must not change**.
- **Popup.** `src/popup.js`:
  - `handleImage()` (`:163-199`) builds the URL once, `const calendarUrl = buildCalendarUrl(receipt)` (`:191`), and
    then calls `showReceipt(receipt, calendarUrl)` (`:84-96`).
  - `showReceipt()` creates the "Додај у календар" button. On click it calls `chrome.tabs.create({url})` and, in
    popup mode, `window.close()` (`:90`). It then replaces `#receipt`'s children (`:93`) and focuses the button
    (`:95`).
  - Errors are thrown as `Error` objects with Serbian messages and shown through `setStatus(err.message, 'error')`
    (`:194-195`).
  - Only the newest scan may touch the UI (`currentRun`, `:158-170`). Phones get `body.mobile` (`:241-246`).
  - A document-wide `paste` listener (`:232-236`) treats every paste as a receipt image. With no image it shows
    `У клипборду нема слике.` as an error; with an image it starts a new scan. On `main` the popup has no text
    field. This feature adds one (`#warranty-custom`).
  - In tab mode, the document-wide `dragover` and `drop` handlers (`:252-264`) call `preventDefault()` on every
    drag. A drop without an image file shows `Превуци фајл слике.` as an error.
- **Receipt-page button.** `src/content.js:30-38` builds the URL with `buildCalendarUrl(receipt)` and opens it
  directly, with no review step. It stays unchanged.
- **Other callers of `buildCalendarUrl(receipt)`.** `store/chrome/shot.html:70` and
  `.claude/skills/demo-video/capture.js:40` call it with one argument. They must keep working unchanged.
- **Receipt Scanner PWA.** It is not in this repo. A local clone exists at
  `/home/marko/Tesons/GitHub/constantine2nd/receipt` (commit `fb02811`).
  - `eventToReceipt()` (`js/app.js:405-453`) reads description lines by prefix.
  - `parseSummary()` (`js/app.js:456`, used by the monthly report in `js/report.js:66-74`) splits the event title at
    the last `' — '` and reads the part after it as the amount.
  - `fetchReceiptEvents()` (`js/api.js:149-160`) lists only events from the past 2 years up to now.
  - The monthly report (`js/report.js:48-51`, `:60-90`) counts **every** event of the month in the Receipts
    calendar, without looking at its description:
    - the amount comes from the title, not from the `💰` line;
    - the payment bucket comes from the `💳` line, and an event without one goes to "unknown payment";
    - the count and the average use `events.length`.

    The receipt list (`js/app.js:356-380`) shows every event the same way. No description content can keep an
    event out of the report or the list; only saving it to another calendar can.
- **Permissions and privacy.** `manifest.json:20-21` has `activeTab` plus one host and no `storage`.
  `docs/privacy.html:18` and the "What it stores" section promise "stores nothing".

### Conventions to follow
| Convention | Example |
|---|---|
| Pure functions in `src/calendar-url.js`, exported for Node through the guard and plain globals in the browser | `src/calendar-url.js:79-82` |
| Constants in `UPPER_SNAKE_CASE` at the top of the module | `src/calendar-url.js:6`, `:24` |
| A short comment above each function says *why*, with an input → output example | `src/calendar-url.js:10-11`, `src/parser.js:101-102` |
| Errors are `throw new Error('<Serbian message>: ' + value)`; the UI shows `err.message` with `setStatus(..., 'error')` | `src/calendar-url.js:60`, `src/popup.js:194-195` |
| No logging (no `console.*` in `src/`) | `src/*.js` |
| DOM built with `el(tag, className, text)`; text only through `textContent` | `src/popup.js:28-33` |
| Element ids in kebab-case; visibility through the `hidden` class | `popup.html:20-43`, `src/popup.css:47` |
| UI text in Serbian Cyrillic, informal imperative ("Провери везу…", "Превуци фајл слике.") | `src/popup.js:184`, `:263` |
| Browser and phone differences are feature or `MOBILE` checks inside `src/`, not separate files | `src/popup.js:241-250`, README "Development" |
| Mobile tap targets: `body.mobile` overrides with a 16px font and larger padding | `src/popup.css:42-45` |
| Tests: `node:test` + `node:assert/strict`, one test file per `src` module, a `SALE` literal changed per case with `{...SALE, ...}` | `test/calendar-url.test.js:1-16`, `:32-40` |
| Browser check: `test/harness.html` loads the real `popup.html`; opened links go to `window.__opened` | `test/harness.html:29-37` |

## Goals / Non-goals
**Goals**
- For a sale receipt, the review step offers a choice, **Додај као: Рачун / Гаранција**. **Рачун** is the default
  and adds the purchase event exactly as on `main`. **Гаранција** adds an all-day event on the warranty end date.
- A period picker (presets and custom months) with an end-date preview, shown only for **Гаранција**.
- Correct date arithmetic (end of month, leap years, machine timezone) and a cap on the custom period.
- Paste and drag-and-drop keep working around the new controls.
- Docs, store texts and the privacy policy updated.

**Non-goals.** Do not build any of these:
- Any change to the purchase event. No `🛡` line, and no warranty parameter on `buildCalendarUrl` or
  `buildReceiptDescription`.
- Warranty on the receipt-page floating button (`src/content.js`). Users who want it there use the toolbar popup,
  whose scan button uses the page's own link.
- Adding both events with one click, a second button, popup windows, or closing calendar tabs automatically.
- A warranty per item, or several periods on one receipt.
- Automatic detection of warranty terms in the receipt text, or any legal or consumer-law wording or advice.
- Remembering the last choice, settings or history (no `storage` permission, no `localStorage` or `sessionStorage`).
- Notifications or reminders of our own (Google Calendar's own default notifications apply), or editing existing
  events.
- Changes to `src/parser.js`, `manifest*.json`, the Receipt Scanner PWA or `scripts/build.py`.
- A version bump, regenerated store screenshots, or a new demo video.

## Requirements
- **R1 (changed, A5).** For a receipt whose `transactionKind(receipt.transactionType)` is `'sale'`, the popup review
  step must show the warranty block `#warranty` above "Додај у календар" (`#add-calendar`). The block contains:
  - a radio group labelled `Додај као:`, with two options:
    - `Рачун` (`#add-as-receipt`, checked)
    - `Гаранција` (`#add-as-warranty`)
  - the hint (R23), in popup mode only;
  - the period picker `#warranty-options`, hidden.

  For refunds and other non-sale receipts there is no block, and the review step and the button behave exactly as
  on `main`.
- **R2 (changed, A5).** The purchase path must equal `main`:
  - `buildCalendarUrl(receipt)` and `buildReceiptDescription(receipt, itemLimit)` keep `main`'s signatures and
    return byte-identical output to `main` for every receipt.
  - With **Рачун** selected (and for every non-sale receipt), "Додај у календар" opens exactly that URL.
- **R3 (changed, A5).** While **Гаранција** is selected, the user must be able to choose:
  - a preset period with `#warranty-months`, offering 6, 12, 24 and 36 months, with 24 selected when the block
    first appears; or
  - "Друго…", which shows `#warranty-custom`, a number input for a whole number of months from 1 to
    `MAX_WARRANTY_MONTHS` (120).

  While **Рачун** is selected, `#warranty-options` (picker, preview and error) is hidden.
- **R4.** `normalizeWarrantyMonths(value)` must return the integer number of months when `value` is
  - an integer `Number` from 1 to 120, or
  - a string that, after trimming whitespace, is 1-3 ASCII digits with a value from 1 to 120.

  For anything else it must return `null`.
- **R5.** `warrantyEndDate(dateTimeStr, months)` must return the end date `{year, month, day}` (month 1-12):
  - It is the receipt's own date (from `dateTimeStr`, never "today") plus `months` calendar months.
  - When that day does not exist in the target month, it is clamped to the month's last day.
  - It returns `null` when the date cannot be parsed or `months` is not valid under R4.
- **R6.** The warranty end date, the `🛡` line and the all-day event dates must depend only on the date printed on
  the receipt. They must not change with the machine's timezone or daylight saving time.
- **R7 (changed, A5).** The warranty line has the format `🛡 Гаранција до: D.M.YYYY.`:
  - `🛡` is U+1F6E1 with no variation selector, followed by one space;
  - day and month have no leading zero, and the date ends with a dot. Example: `🛡 Гаранција до: 7.11.2028.`

  It appears **only** as the first line of the expiry description (R19). The purchase description never contains
  it.
- **R8 (changed, A5).** `buildCalendarUrl(receipt)` and `buildReceiptDescription(receipt, itemLimit)` take no
  warranty argument; their declared parameter counts (`.length`) are 1 and 2.
  - An extra argument passed by a caller is ignored, as for any JavaScript function: the output equals the call
    without it.
  - An unreadable receipt date throws `'Датум рачуна није препознат: ' + dateTimeStr`, as on `main`.
  - `'Неисправан период гаранције: …'` is thrown only by `buildWarrantyCalendarUrl` (R9).
- **R9.** `buildWarrantyCalendarUrl(receipt, warrantyMonths)` must return a Google Calendar template URL. Its query
  parameters, in this order:
  - `action=TEMPLATE`
  - `text=Гаранција истиче: <title merchant>`, or just `Гаранција истиче` when the title merchant is empty. To get
    the title merchant:
    1. Take `merchantName` (`''` when missing) and trim its leading and trailing whitespace.
    2. Replace every em dash (U+2014 `—`) with a hyphen-minus (U+002D `-`), so the title never contains `' — '`
       (E14).

    Examples: `ALFA — BETA DOO` → `Гаранција истиче: ALFA - BETA DOO`; `'   '` → `Гаранција истиче`.
  - `dates=YYYYMMDD/YYYYMMDD`: an all-day event on the end date; the second date is the next day (exclusive)
  - `ctz=Europe/Belgrade`
  - `details`: `buildWarrantyDescription(receipt, itemLimit, warrantyMonths)` (R19)
  - `location=<receipt.address>`

  It throws, in this order of checks:
  1. `'Датум рачуна није препознат: ' + dateTimeStr` when the date cannot be parsed.
  2. `'Неисправан период гаранције: ' + warrantyMonths` when the months are not valid under R4, including `null` and
     `undefined`.
  3. `'Гаранција се додаје само за рачун продаје.'` when the receipt is not a sale.
- **R10 (changed, A5).** The expiry URL must be at most 6000 characters. To fit, only item lines are dropped, from
  the end, with `… +N`. The `🛡`, `📋`, `🕐` and `🔗` lines are always kept. The purchase URL keeps `main`'s
  trimming (R2).
- **R11 (changed, A5).** While **Гаранција** is selected and the period is valid, `#warranty-end` must show
  `Гаранција до: D.M.YYYY.`. It is updated on every change of the choice, the preset or the custom value. When
  `isWarrantyExpired(end)` is true, the text ends with ` (истекла)`, and the button stays enabled.
- **R12 (changed, A5).** The popup reads the custom field (`type="number"`) as `custom.valueAsNumber`, accepts it
  only when it is a whole number, and passes it to `normalizeWarrantyMonths`. So `24.0` gives 24, and `+24` and
  `1e2` give 24 and 100 wherever the browser reports a number for them. While **Гаранција** is selected and that
  value is invalid:
  - `#warranty-error` shows `Унеси број месеци од 1 до 120.`;
  - `#warranty-end` is hidden;
  - `#add-calendar` is disabled.

  Selecting **Рачун** enables `#add-calendar` again at once, whatever the hidden custom value is.
- **R13 (changed, A5).** "Додај у календар" (`#add-calendar`), the only add button, builds its URL at click time
  from the current choice:
  - **Рачун**, or a non-sale receipt: `calendarUrl`, the URL `handleImage` built with `buildCalendarUrl(receipt)`
    (R2).
  - **Гаранција**: `buildWarrantyCalendarUrl(receipt, months)`.

  Both open with `chrome.tabs.create({ url })`, in front, as on `main`.
  - **Popup mode** (every mode except `?tab`: the desktop toolbar popup and Firefox for Android's full-screen page):
    the popup then closes (`window.close()`).
  - **Tab mode** (`?tab`): the page stays open, and the user can switch the choice and click again without
    rescanning.

  Errors follow R21.
- **R14 (removed, amendment 5).** `#add-warranty` no longer exists. Its job is done by **Гаранција** + "Додај у
  календар" (R13).
- **R15 (changed, A5).** Nothing may be persisted:
  - no use of `localStorage`, `sessionStorage`, `indexedDB`, `chrome.storage`/`browser.storage` or cookies in `src/`;
  - no change to `manifest.json` or `manifest.firefox.json`;
  - every newly shown receipt starts with **Рачун** selected, 24 months, and the custom field hidden.
- **R16 (changed, A5).** The warranty block must work and fit in:
  - the 340px desktop popup;
  - the full-tab page (`?tab`);
  - Firefox for Android (`body.mobile`): on a 360px-wide viewport the two radio options, the select, the custom
    input and `#add-calendar` are each at least 44px tall, with no horizontal scroll;
  - light and dark color schemes.

  All visible labels are in Serbian Cyrillic, with the exact texts in Design.
- **R17.** The receipt-page button (`src/content.js`) and the PWA-shared parser (`src/parser.js`) must stay
  unchanged.
- **R18 (changed, A5).** The README, the privacy policy (`docs/privacy.html`, `store/firefox/fields/privacy-policy.txt`),
  the landing page (`docs/index.html`) and both store descriptions must describe the feature with the texts in
  Design:
  - the choice, the expiry event and the two-scan flow;
  - no wording about a checkbox, a second button or a `🛡` line in the purchase event.

  The "stores nothing" statements stay and remain true.
- **R19.** `buildWarrantyDescription(receipt, itemLimit, warrantyMonths)` must return exactly these lines, in this
  order, joined by `\n`:
  1. `🛡 Гаранција до: D.M.YYYY.` (R7)
  2. `📋 <receiptNumber>`
  3. `🕐 <dateTimeStr>`
  4. `🛒 Артикли:`
  5. the item lines, exactly as in the purchase description (`• <name> ×<qty> = <total> RSD`, trimmed to
     `itemLimit` with `… +N`, or `(no items parsed)` when there are no items)
  6. `🔗 <sourceUrl>`

  It has no merchant, address, `PIB:`, `👤`, `💳`, `↩`/`🏷`, `💰` or `🧾` line. With a period that is not valid
  under R4, or for a non-sale receipt, line 1 is left out; callers validate first, as `buildWarrantyCalendarUrl`
  does.
- **R20 (changed, A5: examples only).** A `paste` event whose target is a **text-entry field** must be left to the
  browser: no `preventDefault`, no status message and no scan. Only these count as text-entry fields:
  - a `textarea`;
  - an element that `isContentEditable`;
  - an `input` whose `type` property is one of `text`, `number`, `search`, `email`, `url`, `tel` or `password`.

  Radio buttons, checkboxes, `select` elements and buttons are not text-entry fields; a paste while they have focus
  works as on `main`. In particular, a paste right after the user clicks `#add-as-receipt` or `#add-as-warranty`,
  or changes `#warranty-months`, scans the pasted image. Outside text-entry fields: an image starts a scan, and
  anything else shows `У клипборду нема слике.`
- **R21 (changed, A5).** "Додај у календар" handles its own errors. If `buildWarrantyCalendarUrl` or
  `chrome.tabs.create` throws:
  - the status line shows `err.message` as an error (`setStatus(err.message, 'error')`);
  - the popup is not closed.
- **R22 (changed, A5: examples only).** In tab mode, a `dragover` or `drop` event is left to the browser when both
  hold:
  - its target is a text-entry field (R20);
  - the drag carries no files (`e.dataTransfer.types` does not include `'Files'`).

  Then there is no `preventDefault`, no drop highlight and no status message. Every other drag works as on `main`:
  - an image file dropped anywhere, including on either radio option, on `#warranty-months` or on
    `#warranty-custom`, starts a scan;
  - a drop without an image file outside a text-entry field shows `Превуци фајл слике.`
- **R23 (changed, A5).** In popup mode, for a sale, the block must show this hint directly under the radio group,
  whichever option is selected: `За рачун и гаранцију скенирај рачун двапут.` It is `<p id="warranty-hint">`. In
  tab mode it is not created, and non-sale receipts have no block at all.

## Design

### Files
| File | Change |
|---|---|
| `src/calendar-url.js` | Constants and pure warranty functions; `buildWarrantyDescription` and `buildWarrantyCalendarUrl`. `buildCalendarUrl` and `buildReceiptDescription` lose the warranty parameter added on this branch (**amendment 5**). |
| `src/popup.js` | `renderWarranty()` (radio choice, picker, hint); `showReceipt()` (one button); paste and drag guards |
| `src/popup.css` | "Warranty" section |
| `test/calendar-url.test.js` | Unit tests (test-writer) |
| `test/harness.html` | `?refund` switch (exists) |
| `README.md`, `docs/privacy.html`, `docs/index.html`, `store/firefox/fields/privacy-policy.txt`, `store/chrome/fields/store-listing-description.txt`, `store/firefox/fields/description.txt` | Texts below |

No new files in `src/`, and no change to `popup.html`: the block is built in JS, as the rest of `#receipt` is.

### `src/calendar-url.js`
Constants (near `TRANSACTION_MARK`):
```js
const WARRANTY_PRESETS = [6, 12, 24, 36];   // months offered in the popup
const DEFAULT_WARRANTY_MONTHS = 24;          // selected when the block appears
const MAX_WARRANTY_MONTHS = 120;             // custom periods above this are rejected
const WARRANTY_MARK = '\u{1F6E1}';           // 🛡 (no U+FE0F), only in the expiry description
```

Exported functions after amendment 5. The list is the same eight names as before; only two signatures shrink.
```js
buildCalendarUrl(receipt) → string                                     // main's signature and output (R2, R8)
buildReceiptDescription(receipt, itemLimit) → string                   // main's signature and output (R2, R8)
buildWarrantyCalendarUrl(receipt, warrantyMonths) → string             // R9
buildWarrantyDescription(receipt, itemLimit, warrantyMonths) → string  // R19
normalizeWarrantyMonths(value) → number | null                         // R4
warrantyEndDate(dateTimeStr, months) → { year, month, day } | null     // R5
formatWarrantyDate({ year, month, day }) → string                      // {2028,11,7} → '7.11.2028.'
isWarrantyExpired({ year, month, day }, now = new Date()) → boolean
```
```js
module.exports = {
  buildCalendarUrl, buildReceiptDescription, buildWarrantyCalendarUrl, buildWarrantyDescription,
  normalizeWarrantyMonths, warrantyEndDate, formatWarrantyDate, isWarrantyExpired,
  WARRANTY_PRESETS, DEFAULT_WARRANTY_MONTHS, MAX_WARRANTY_MONTHS,
};
```

Behaviour:
- **`buildReceiptDescription(receipt, itemLimit)` and `buildCalendarUrl(receipt)` (amendment 5).**
  - Remove the `warrantyMonths` parameter, the `🛡` entry, and the `checkWarrantyMonths` call from both.
  - Their bodies may keep calling the shared internal helpers `itemLinesText(items, itemLimit)` and
    `fitCalendarUrl(make, itemCount)`.
  - The test is the output, which must equal `main`'s byte for byte (A30).
- **`normalizeWarrantyMonths`**:
  - A number must satisfy `Number.isInteger(v) && v >= 1 && v <= MAX_WARRANTY_MONTHS`.
  - A string must match `/^\d{1,3}$/` after `.trim()`, and its `Number()` must be from 1 to 120.
  - Any other type gives `null`.
  - Examples: `24`→24, `'24'`→24, `' 24 '`→24, `'024'`→24, `'120'`→120. These give `null`: `0`, `-3`, `2.5`, `NaN`,
    `Infinity`, `121`, `''`, `'0'`, `'-3'`, `'+24'`, `'2.5'`, `'1e2'`, `'abc'`, `'121'`, `'999999'`, `true`.
- **`warrantyEndDate`**:
  1. Read `parts = parseSerbianDateParts(dateTimeStr)` and `n = normalizeWarrantyMonths(months)`. If either is
     `null`, return `null`.
  2. Compute the target month: `m0 = parts.month - 1 + n`, `ty = parts.year + Math.floor(m0 / 12)`,
     `tm = m0 % 12` (0-based).
  3. Find the target month's last day: `last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()`.
  4. Return `{ year: ty, month: tm + 1, day: Math.min(parts.day, last) }`.

  Only `Date.UTC` and `getUTC*` are used (R6).
- **`formatWarrantyDate`**: `` `${day}.${month}.${year}.` ``, with no zero padding.
- **`isWarrantyExpired`**:
  - Get today's Belgrade date from `formatToParts`, never from a formatted string:
    ```js
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Belgrade', calendar: 'gregory', numberingSystem: 'latn',
      year: 'numeric', month: 'numeric', day: 'numeric',
    }).formatToParts(now);
    const get = type => Number(parts.find(p => p.type === type).value);
    ```
  - Compare `year * 10000 + month * 100 + day` for both dates; return `true` only if the end date is strictly
    earlier.
  - Do not call `.format()`.
- **`buildWarrantyDescription`** (R19):
  ```js
  const end = transactionKind(receipt.transactionType) === 'sale' ? warrantyEndDate(receipt.dateTimeStr, warrantyMonths) : null;
  return [
    end ? `${WARRANTY_MARK} Гаранција до: ${formatWarrantyDate(end)}` : '',
    `📋 ${receipt.receiptNumber}`,
    `🕐 ${receipt.dateTimeStr}`,
    '🛒 Артикли:',
    itemLinesText(receipt.items, itemLimit),
    `🔗 ${receipt.sourceUrl}`,
  ].filter(Boolean).join('\n');
  ```
  For `SALE` + 24:
  ```
  🛡 Гаранција до: 7.11.2028.
  📋 ABCD1234-ABCD1234-1001
  🕐 7.11.2026. 13:25:06
  🛒 Артикли:
  • Espresso ×1 = 220,00 RSD
  • Limunada 0.3 ×1 = 295,00 RSD
  🔗 https://suf.purs.gov.rs/v/?vl=AAAA…  (the full SALE.sourceUrl)
  ```
- **`buildWarrantyCalendarUrl`**:
  1. Check the date, then the months, then that the receipt is a sale (R9).
  2. Compute `end = warrantyEndDate(...)`, and the dates `YYYYMMDD/YYYYMMDD` (end, end + 1 day) via
     `Date.UTC(...).toISOString()`.
  3. Build the title:
     `const name = (receipt.merchantName || '').trim().replace(/—/g, '-'); const text = name ? 'Гаранција истиче: ' + name : 'Гаранција истиче';`
  4. Build the URL with `URLSearchParams({ action, text, dates, ctz, details, location })` through `fitCalendarUrl`.

  Example: `SALE` + 24 → `text=Гаранција истиче: KAFE PRIMER DOO`, `dates=20281107/20281108`.

### `src/popup.js`: the warranty block (amendment 5)
`renderWarranty(receipt, mainButton) → { box, isWarranty, months }`, above `showReceipt`. It builds this DOM with
`el()`. All state lives in the closure; there are no module-level variables (E10).
```html
<div id="warranty" class="warranty">
  <div class="add-as" role="radiogroup" aria-labelledby="add-as-label">
    <span id="add-as-label" class="add-as-label">Додај као:</span>
    <label><input type="radio" name="add-as" id="add-as-receipt" value="receipt" checked> Рачун</label>
    <label><input type="radio" name="add-as" id="add-as-warranty" value="warranty"> Гаранција</label>
  </div>
  <!-- popup mode only: not created when IN_TAB -->
  <p id="warranty-hint" class="warranty-hint">За рачун и гаранцију скенирај рачун двапут.</p>
  <div id="warranty-options" class="hidden">
    <select id="warranty-months" aria-label="Трајање гаранције">
      <option value="6">6 месеци</option>
      <option value="12">12 месеци</option>
      <option value="24" selected>24 месеца</option>
      <option value="36">36 месеци</option>
      <option value="custom">Друго…</option>
    </select>
    <input type="number" id="warranty-custom" class="hidden" min="1" max="120" step="1"
           inputmode="numeric" placeholder="месеци" aria-label="Број месеци">
    <p id="warranty-end" aria-live="polite"></p>
    <p id="warranty-error" class="hidden" role="alert">Унеси број месеци од 1 до 120.</p>
  </div>
</div>
<button id="add-calendar" class="primary">Додај у календар</button>
```
- **Ids removed in amendment 5:** `#warranty-on` and `#add-warranty`. The `.warranty-toggle` class is gone too.
- **Labels:** build the option labels with `const WARRANTY_OPTION_LABEL = { 6: '6 месеци', 12: '12 месеци', 24: '24 месеца', 36: '36 месеци' };`
  and the error text from `MAX_WARRANTY_MONTHS`.
- **`isWarranty()`** returns `warrantyRadio.checked`.
- **`months()`**:
  - returns `null` unless `isWarranty()`;
  - for `custom`: `const n = custom.valueAsNumber; return Number.isInteger(n) ? normalizeWarrantyMonths(n) : null;`;
  - otherwise `Number(select.value)`.
- **`update()`** runs on `change` of both radios and the select, and on `input` of the custom field:
  ```js
  const update = () => {
    if (!isWarranty()) {                         // Рачун: the purchase event, as on main
      options.classList.add('hidden');
      mainButton.disabled = false;
      return;
    }
    options.classList.remove('hidden');
    custom.classList.toggle('hidden', select.value !== 'custom');
    const n = months();
    const end = n === null ? null : warrantyEndDate(receipt.dateTimeStr, n);
    if (end) {
      endText.textContent = 'Гаранција до: ' + formatWarrantyDate(end) + (isWarrantyExpired(end) ? ' (истекла)' : '');
      endText.classList.remove('hidden');
      error.classList.add('hidden');
    } else {
      endText.classList.add('hidden');
      error.classList.remove('hidden');
    }
    mainButton.disabled = !end;
  };
  ```
- **Choosing "Друго…"**: prefill `#warranty-custom` with the preset selected just before (24 at first), then focus
  it (unchanged).
- **Switching back and forth.** Switching back to **Рачун** keeps the period state (hidden) for this receipt, so
  switching to **Гаранција** again shows the same period. A new scan starts fresh (R15).

### `src/popup.js`: `showReceipt` and the one button (amendment 5)
```js
function showReceipt(receipt, calendarUrl) {
  const add = el('button', 'primary', 'Додај у календар');
  add.id = 'add-calendar';
  add.addEventListener('click', async () => {
    try {
      // Built at click time: the purchase URL from the scan (as on main), or the expiry event.
      const url = warranty?.isWarranty() ? buildWarrantyCalendarUrl(receipt, warranty.months()) : calendarUrl;
      await chrome.tabs.create({ url });
    } catch (err) {
      setStatus(err.message, 'error');
      return;                                        // the popup stays open to show the error
    }
    // Desktop closes the popup by itself when the new tab takes focus. Firefox for Android leaves
    // it on top of the new tab, so close it to reveal the calendar. (Tab mode: the page stays.)
    if (!IN_TAB) window.close();
  });

  const warranty = transactionKind(receipt.transactionType) === 'sale' ? renderWarranty(receipt, add) : null;
  receiptEl.replaceChildren(
    ...(warranty ? [warranty.box] : []),
    add,
    receipt.preHtml ? renderJournal(receipt.preHtml) : renderSummary(receipt),
  );
  receiptEl.classList.remove('hidden');
  add.focus();
}
```
- If `months()` is `null` (only possible if the disabled button were clicked anyway),
  `buildWarrantyCalendarUrl` throws `Неисправан период гаранције: null`, which is shown as an error. No wrong date is
  ever opened.
- `handleImage()` is unchanged. It still calls `buildCalendarUrl(receipt)`, so an unreadable date fails before the
  review step (E3).
- The paste and drag guards (`TEXT_INPUT_TYPES`, `isTextEntryTarget`, `carriesFiles`) are unchanged from amendment
  3. Radio inputs are not text-entry fields, so they never block paste or drop.

### `src/popup.css` (amendment 5)
Replace the `.warranty-toggle` rules and the `#warranty-options button` rule. Keep the rest of the Warranty section.
```css
/* ── Warranty ─────────────────────────────────────────── */
.warranty { margin: 0 0 10px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
.add-as { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; }
.add-as-label { font-weight: 600; }
.add-as label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.add-as input { width: 18px; height: 18px; margin: 0; accent-color: var(--accent); }
.warranty-hint { margin: 6px 0 0; font-size: 12px; color: var(--muted); }
#warranty-options { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
#warranty-options select, #warranty-options input {
  padding: 8px 10px; font: inherit; color: var(--text); background: var(--bg);
  border: 1px solid var(--border); border-radius: 8px;
}
#warranty-options input { width: 7em; }
#warranty-end, #warranty-error { flex-basis: 100%; margin: 0; font-size: 13px; }
#warranty-error { color: var(--error); }
body.mobile .add-as label { min-height: 44px; font-size: 16px; }
body.mobile #warranty-options select, body.mobile #warranty-options input { min-height: 44px; font-size: 16px; }
```

### Documentation texts (R18, amendment 5)
- **`README.md`**, section "Use": replace the current "Warranty" paragraph with:
  > **Warranty.** For a sale, the popup asks **Додај као:** **Рачун** (the purchase event, as before) or
  > **Гаранција**. With **Гаранција**, choose 6, 12, 24 or 36 months, or **Друго…** for your own number of months
  > (1–120); the popup shows the end date, counted from the receipt's date. **Додај у календар** then opens an
  > all-day event on that date instead of the purchase. It is titled `Гаранција истиче: Merchant` and carries
  > `🛡 Гаранција до: 7.11.2028.`, the receipt number and date, the items and the receipt link. In the toolbar popup
  > (and on Android) the popup closes after the click, so to add both events scan the receipt twice: once as
  > **Рачун**, once as **Гаранција**. In a full tab (desktop, **Изабери слику…**) the page stays open: switch the
  > choice and click again. Nothing is remembered; the next receipt starts with **Рачун**. The button on the receipt
  > page has no warranty option; use the toolbar popup there.

  Under "Limitations", the two warranty bullets become:
  > - In the toolbar popup one scan adds one event, the purchase or the warranty end; scan again for the other.
  > - One warranty period per receipt. Save the warranty event to a calendar other than the Receipt Scanner's
  >   **Receipts** calendar. Once its date has passed, the Receipt Scanner shows any event in that calendar as a
  >   receipt: without an amount, under an unknown payment method, and counted in the month's number of receipts.
- **`docs/privacy.html`**, "What it sends", Google Calendar item. Replace its text after the `<b>…</b>
  (<code>calendar.google.com</code>):` part with:
  > when you click “Додај у календар”, a new tab opens Google Calendar's “new event” form. The receipt details (the
  > list above, and the receipt link) are part of that link, so Google receives them in that request. If you chose
  > “Гаранција”, the form is instead an all-day event on the day the warranty ends, with the receipt number, date,
  > items and link. The event is saved only if you press Save, in the Google account you are signed in to, and is
  > then covered by Google's privacy policy.

  This removes "and the warranty end date if you set one" and the "“Додај датум истека гаранције” opens a second
  form" sentence. "What it stores" keeps "The warranty period you choose is not saved either." Set "Last updated"
  to the date of the change.
- **`store/firefox/fields/privacy-policy.txt`**: the Google Calendar line becomes:
  > - To Google Calendar (calendar.google.com): when you click "Додај у календар", a new tab opens Google Calendar's
  >   new-event form. The receipt details and the receipt link are part of that link, so Google receives them in
  >   that request. If you chose "Гаранција", the form is instead an all-day event on the day the warranty ends,
  >   with the receipt number, date, items and link. The event is saved only if you press Save, in the Google
  >   account you are signed in to.
- **`docs/index.html`**, "How it works" step 2:
  > Check the receipt, which is shown as it was printed. For a sale you can add it as a warranty instead: an all-day
  > event on the day the warranty ends.
- **Both store descriptions** replace the warranty bullets:
  - МОГУЋНОСТИ: `• Гаранција: уместо куповине додајте целодневни догађај на дан истека гаранције (6, 12, 24, 36 месеци или друго)`
  - FEATURES: `• Warranty: instead of the purchase, add an all-day event on the day the warranty ends (6, 12, 24 or 36 months, or your own)`

## Edge cases
- **E1.** The end day does not exist in the target month: clamp to the month's last day.
  - `31.8.2026.` + 6 → `28.2.2027.`
  - `31.8.2027.` + 6 → `29.2.2028.`
  - `29.2.2028.` + 12 → `28.2.2029.`
  - `29.2.2028.` + 48 → `29.2.2032.`
  - `31.1.2026.` + 1 → `28.2.2026.`
  - `31.10.2026.` + 1 → `30.11.2026.`
- **E2.** The period crosses into another year, so the year rolls over:
  - `15.11.2026.` + 2 → `15.1.2027.`
  - `31.3.2026.` + 120 → `31.3.2036.`
  - an all-day event on `31.12.2027.` has `dates=20271231/20280101`.
- **E3.** The receipt date cannot be parsed: the popup shows `Датум рачуна није препознат: …` as an error and no
  review step (no block), as on `main`. `buildWarrantyCalendarUrl` throws the same message.
- **E4 (changed, A5).** Refund or other non-sale receipts: there is no block, and "Додај у календар" opens
  `main`'s URL. `buildWarrantyCalendarUrl(nonSale, 24)` throws `Гаранција се додаје само за рачун продаје.`
- **E5 (changed, A5).** The warranty has already expired (an old receipt) and **Гаранција** is selected: the preview
  reads `Гаранција до: … (истекла)`. The button stays enabled and opens an all-day event in the past (F5).
- **E6 (changed, A5).** Invalid periods.
  - In the pure functions (R4): `''`, `0`, `-3`, `2.5`, `'1e2'`, `'+24'`, `'abc'`, `121` and `'999999'` give
    `null`; `120` and `' 12 '` are valid.
  - In the custom field, with **Гаранција** selected:
    - empty, `abc`, `0`, `-3`, `2.5`, `121` and `999999` show the error, disable `#add-calendar`, and build no URL;
    - `24.0` is 24;
    - `1e2` and `+24` count as 100 and 24 wherever the browser reports a number for them.
- **E7 (changed, A5).** Long receipts with **Гаранција**: the expiry URL stays at most 6000 characters, and item lines
  are cut with `… +N`. The `🛡`, `📋`, `🕐` and `🔗` lines are kept, and there is never a `💰` line. Long receipts with
  **Рачун** behave as on `main`.
- **E8 (changed, A5).** The choice or the period changes after the review is shown: each click builds its URL from the
  current state. **Рачун** always gives `main`'s byte-identical URL, however often the choice was switched.
- **E9 (changed, A5).** A new scan replaces the receipt: the new block starts with **Рачун**, 24 months and the custom
  field hidden, and exactly one `#warranty` exists in the document.
- **E10.** A scan is aborted, or a second scan starts while the first runs: only the newest run reaches
  `showReceipt`. The block's state is local to that call. The older run shows no error and does not replace the
  block the user is working with.
- **E11.** Timezone and DST: the results do not change in another machine timezone.
  - `1.1.2026. 00:10:00` + 6 → `1.7.2026.`
  - `31.12.2026. 23:59:59` + 1 → `31.1.2027.`
  - `29.3.2026. 02:30:00` + 6 → `29.9.2026.`
  - `25.10.2026. 02:30:00` + 12 → `25.10.2027.`
- **E12.** An empty, missing or whitespace-only `merchantName`: the expiry title is `Гаранција истиче`. Spaces at the
  ends of a real name are dropped.
- **E13 (changed, A5).** The Receipt Scanner PWA reads a purchase event: purchase events are byte-identical to
  `main`'s again, so the PWA reads them exactly as before. The earlier risk from the `🛡` line in the purchase event
  is gone.
- **E14.** The expiry event saved into the PWA's **Receipts** calendar is listed and counted once its date has
  passed (Context). The damage is limited:
  - the title never contains `' — '`, so the amount reads as 0;
  - there is no `💳` line, so the event goes to "unknown payment";
  - there is no `💰` or `🧾` line.

  The count and the average still include it. The README advises another calendar (Open question 7).
- **E15 (changed, A5).** In popup mode one scan adds one event. A user who wants both scans the same receipt again
  and picks the other option; the hint (R23) says so. **Рачун** alone or **Гаранција** alone is a valid outcome. In
  tab mode the user switches the choice and clicks again.
- **E16 (changed, A5).** "Додај у календар" is double-clicked: it behaves as on `main` (no extra guard). In popup
  mode the popup closes after the first open. In tab mode a double click can open two identical forms, as on
  `main`.
- **E17.** The `isWarrantyExpired` boundary uses Belgrade dates:

  | End date | Now (UTC) | Belgrade time | Expired |
  |---|---|---|---|
  | `7.11.2028.` | `2028-11-07T22:59:59Z` | 7 Nov, 23:59:59 | no |
  | `7.11.2028.` | `2028-11-07T23:00:00Z` | 8 Nov, 00:00 | yes |
  | `1.7.2027.` | `2027-07-01T21:59:59Z` | 1 July (CEST) | no |
  | `1.7.2027.` | `2027-07-01T22:00:00Z` | 2 July | yes |
- **E18 (changed, A5).** Pasting while **Гаранција** and "Друго…" are selected:
  - text pasted into `#warranty-custom` goes into the field, the preview updates, and there is no error;
  - an image pasted there does nothing;
  - with focus on either radio option, or on `#warranty-months`, a pasted image scans as on `main`, and pasted text
    shows `У клипборду нема слике.`
- **E19 (changed, A5).** `chrome.tabs.create` or `buildWarrantyCalendarUrl` fails when "Додај у календар" is clicked:
  the error message is shown, the popup stays open, and the user can try again (R21).
- **E20 (changed, A5).** Drag and drop in tab mode:
  - text dragged into or within `#warranty-custom` is handled by the browser;
  - an image file dropped on either radio option, the select, the custom field or anywhere else scans;
  - text dropped outside a text-entry field shows `Превуци фајл слике.`
- **E21 (new, A5).** **Гаранција** with an invalid custom period, then **Рачун**: `#add-calendar` is enabled at once
  and opens `main`'s purchase URL. Back to **Гаранција**, the invalid value is still there, so the error shows again
  and the button is disabled.

## Test plan
- **Unit tests** go in `test/calendar-url.test.js`, with the existing `SALE`, `REFUND`, `OTHER` and `LONG` literals.
- **UI rows** are manual checks with `test/harness.html` (`python3 -m http.server 8766`) and in real browsers.
- The fixture receipt is dated `15.10.2026. 10:15:30`, so with 24 months its warranty ends `15.10.2028.`.
- In console steps, `close stub` means
  `window.close = () => { window.__closed = true; }; const c0 = chrome.tabs.create; chrome.tabs.create = async o => { window.__opts = o; return c0(o); };`.

| Test | Covers | Type | File |
|---|---|---|---|
| T1 **(changed, A5)** Golden purchase URL without git: `buildCalendarUrl(SALE)` equals `'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action: 'TEMPLATE', text: 'KAFE PRIMER DOO — 750,00 RSD', dates: '20261107T132506/20261107T134006', ctz: 'Europe/Belgrade', details: SALE_LINES.join('\n'), location: 'ПРИМЕРНА 1, Београд' })`, with `SALE_LINES` as in the test file (13 lines, no `🛡`) | R2 | unit | `test/calendar-url.test.js` |
| T2 `normalizeWarrantyMonths` table (Design examples) | R4, E6 | unit | same |
| T3 `warrantyEndDate('7.11.2026. 13:25:06', m)` for 6/12/24/36 → `7.5.2027`, `7.11.2027`, `7.11.2028`, `7.11.2029` | R3, R5 | unit | same |
| T4 Month-end clamping table (E1) | R5, E1 | unit | same |
| T5 Year rollover table (E2), including the all-day `dates` for `31.12.2026.` + 12 | R5, R9, E2 | unit | same |
| T6 `warrantyEndDate` returns `null` for `'nonsense'` and for months `0`, `121`, `'abc'`, `null` | R5 | unit | same |
| T7 `formatWarrantyDate` → `'7.11.2028.'`, `'1.2.2027.'` | R7 | unit | same |
| T8 **(removed, A5)** It checked the `🛡` line in the purchase description. T26 now checks that the line is absent | n/a | n/a | n/a |
| T9 **(removed, A5)** It checked the `🛡` position after `💰` in the purchase description | n/a | n/a | n/a |
| T10 **(removed, A5)** Non-sale purchase with a warranty argument; T26 covers it | n/a | n/a | n/a |
| T11 **(removed, A5)** `buildCalendarUrl` no longer validates a period (R8) | n/a | n/a | n/a |
| T12 **(changed, A5)** `dateTimeStr: 'nonsense'`: `buildCalendarUrl(bad)` throws exactly `Датум рачуна није препознат: nonsense`; `buildWarrantyCalendarUrl(bad, 24)`, `(bad, 0)` and the refund variant with `null` throw `/Датум рачуна/` (date checked first). No months argument on `buildCalendarUrl` | R8, R9, E3 | unit | same |
| T13 `buildWarrantyCalendarUrl(SALE, 24)`: keys in R9 order, `text`, `dates` `'20281107/20281108'`, `ctz`, `location`, `details === buildWarrantyDescription(SALE, SALE.items.length, 24)`, no `💰`/`💳`/`🧾` line | R9, R19 | unit | same |
| T14 Empty merchant → `text` `'Гаранција истиче'` | R9, E12 | unit | same |
| T15 `buildWarrantyCalendarUrl` throws `Неисправан период гаранције: <v>` for `null`, `undefined`, `0`, `121`, `'abc'`, `''`, `2.5`; then `Гаранција се додаје само за рачун продаје.` for `REFUND`/`OTHER`; the period is checked before the type | R9, E4 | unit | same |
| T16 **(changed, A5)** `LONG` + 24, **expiry URL only**: length ≤ 6000; `… +N`; kept items are the first ones; non-item lines equal `[🛡 line, '📋 …', '🕐 …', '🛒 Артикли:', '🔗 …']`; `🔗` last; no `💰` line. (The purchase side of long receipts is `main`'s own test "very long receipts are trimmed…") | R10, R19, E7 | unit | same |
| T17 **(changed, A5)** The E11 cases: `warrantyEndDate` and the expiry `dates` match. The child-process run under `America/Los_Angeles`, `Pacific/Kiritimati`, `Europe/Belgrade` and `UTC` returns the same `[end, buildCalendarUrl(r), buildWarrantyCalendarUrl(r, m)]` as in-process (no months argument on `buildCalendarUrl`; no `🛡` assertion on the purchase description) | R6, E11 | unit | same |
| T18 `isWarrantyExpired` with the four E17 instants | R11, E5, E17 | unit | same |
| T19 Exports: the three constants, and the eight function names are functions | R3, R4, R19 | unit | same |
| T20 **(changed, A5)** Against local `main` (skipped without git or `main`, F3): for `SALE`, `REFUND`, `OTHER`, `LONG`, and `{...SALE, vatTotal: '', merchantName: ''}`, `buildCalendarUrl(r)` and `buildCalendarUrl(r, 24)` equal `main`'s `buildCalendarUrl(r)`, and `buildReceiptDescription(r, n)` and `(r, n, 24)` equal `main`'s `buildReceiptDescription(r, n)` for `n` in `0`, `1`, `r.items.length` | R2, R8 | unit (uses git) | same |
| T21 `buildWarrantyDescription` exact lines (SALE + 24); `(no items parsed)`; no `🛡` for period `0` or a refund; no `💳`/`💰`/`🧾`/`👤`/`PIB:`/merchant/address line; item lines equal `buildReceiptDescription(LONG, limit)`'s | R19, E14 | unit | same |
| T22 **(changed, A5: call only)** Em dashes in the expiry title (`ALFA - BETA DOO`, `A-B`, `X - Y - 5`, no `' — '`). The purchase title check calls `buildCalendarUrl({...SALE, merchantName: 'ALFA — BETA DOO'})` without a months argument and still gets `'ALFA — BETA DOO — 750,00 RSD'` | R9, E14 | unit | same |
| T23 `isWarrantyExpired` with `t.mock.getter(Intl.DateTimeFormat.prototype, 'format', () => () => '11/7/2028')`: same results as T18, `callCount()` 0 | R11, E17 | unit | same |
| T24 **(removed, A5)** `buildCalendarUrl` no longer rejects periods for non-sale receipts (R8) | n/a | n/a | n/a |
| T25 Trimmed expiry title (`'   '`, `' \t\n'`, `undefined` → `'Гаранција истиче'`; `'  KAFE PRIMER DOO  '`; `'  ALFA — BETA  '`) | R9, E12 | unit | same |
| T26 **(new, A5)** The purchase path takes no warranty: `buildCalendarUrl.length === 1` and `buildReceiptDescription.length === 2`. For `SALE`, `REFUND`, `OTHER` and `LONG`, and `m` in `6`, `24`, `0`, `'abc'`, `null`: `buildCalendarUrl(r, m) === buildCalendarUrl(r)` (no throw), and `buildReceiptDescription(r, r.items.length, m) === buildReceiptDescription(r, r.items.length)`. No purchase `details` line starts with `\u{1F6E1}` | R2, R7, R8, E13 | unit | same |
| File test "E5" **(changed, A5)** Keep only the expiry assertion (`buildWarrantyCalendarUrl(old, 6)` `dates` `20210415/20210416`, and its first `details` line `🛡 Гаранција до: 15.4.2021.`); drop the purchase `🛡` assertion | E5 | unit | same |
| File test "E8" **(changed, A5)** Calls to `buildWarrantyCalendarUrl(SALE, 36)` and `(SALE, 6)` leave `buildCalendarUrl(SALE)` unchanged; drop the assertions that `buildCalendarUrl(SALE, 6/24)` carry `🛡` | E8 | unit | same |
| H1 **(changed, A5)** `harness.html?scan`: `#warranty` present; `#add-as-receipt` checked; `#warranty-options` hidden; `#warranty-hint` visible under the radios; no `#warranty-on`, no `#add-warranty`. Click `#add-calendar`: `__opened[0]` has no `🛡` and equals `buildCalendarUrl(parseReceiptHtml(FIXTURE.receiptPageHtml(''), FIXTURE.receiptUrl))` (receipt HTML without the QR image; same fields) | R1, R2, R13, R23 | integration (manual, harness) | `test/harness.html` |
| H2 **(changed, A5)** `?scan`, select **Гаранција**: `#warranty-options` visible, `24 месеца`, preview `Гаранција до: 15.10.2028.`. Click `#add-calendar`: one URL with title `Гаранција истиче: KAFE PRIMER DOO`, `dates=20281015/20281016`, `details` starting `🛡 Гаранција до: 15.10.2028.`, ending with `🔗`, no `💰`/`💳`/`🧾` | R3, R9, R11, R13, R19 | same | same |
| H3 **(changed, A5)** `harness.html?tab&scan`: **Гаранција**, choose 6: preview `15.4.2027.`; click: URL with `dates=20270415/20270416`. Select **Рачун**: options hidden; click: URL equals H1's | R3, R13, E8 | same | same |
| H4 **(changed, A5)** `?tab&scan`, **Гаранција**, `Друго…`: input shown, prefilled `24`, focused. `0`, `2.5`, `121` or empty: error `Унеси број месеци од 1 до 120.`, `#add-calendar` disabled. Select **Рачун**: button enabled, and a click opens H1's URL. Back to **Гаранција**: error and disabled again. Type `18`: `Гаранција до: 15.4.2028.`, enabled | R12, E6, E21 | same | same |
| H5 **(rewritten, A5)** Popup mode, `?scan`, close stub. (1) **Рачун**, click: `__opts` is `{ url }` (no `active` key, as on `main`), `__closed === true`. (2) Reload, **Гаранција**, close stub, click: `__opts.url` is the expiry URL, no `active: false`, `__closed === true`. The status line shows no message in either case | R13 | same | same |
| H6 **(changed, A5)** Select **Гаранција** and 6, then click `#scan-tab` again: exactly one `#warranty`, **Рачун** checked, options hidden, 24 selected, custom hidden | R15, E9, E10 | same | same |
| H7 **(changed, A5)** `?scan&refund`: no `#warranty`, no `#warranty-hint`; Add opens `main`'s refund URL | R1, E4 | same | same |
| H8 **(changed, A5)** Old receipt (fixture date `15.10.2020. 10:15:30` via a console fetch stand-in), **Гаранција**, 6: preview ends with ` (истекла)`, button enabled; click opens `dates=20210415/20210416` | R11, E5 | same | same |
| H9 **(changed, A5)** DevTools, Android UA, 360×740, `?tab&scan` and `?scan`: `body.mobile`; both radio labels, the select, the input and `#add-calendar` ≥ 44px tall; no horizontal scroll; hint wraps. Repeat at 340px and in dark mode | R16, R23 | same | same |
| H10 **(rewritten, A5)** Real Chrome desktop popup, Firefox desktop popup, Firefox for Android 161+: (1) scan a sale, read the hint, select **Гаранција** (24), click: the all-day expiry form opens in front, popup closes. (2) Scan the same receipt again, keep **Рачун**, click: the purchase form opens in front, without a `🛡` line, popup closes. (3) Desktop full tab (`Изабери слику…`): no hint; **Рачун** → click → purchase form; back to the page, **Гаранција** → click → expiry form; the page stays open | R13, R16, R23, E15 | integration (manual) | n/a |
| H11 On a real receipt page the floating button opens the same event as on `main` | R17 | integration (manual) | n/a |
| H12 **(changed, A5)** In the PWA's code (`receipt/js/app.js`) in a browser console: `parseSummary` on the T22 expiry titles gives total `''`; the `💳` lookup on the H2 `details` finds nothing; `eventToReceipt` on the H1 purchase `details` gives the same result as on `main` | E13, E14 | integration (manual) | n/a |
| H13 **(changed, A5)** `?scan`, **Гаранција**, `Друго…`, in Chrome and Firefox: `24.0` → `15.10.2028.`, enabled; `1e2` → `15.2.2035.` or the error; `+24` → `15.10.2028.` or the error (write down which); `2.5` and empty → error, disabled. With `24.0`, Add opens the expiry URL with `🛡 Гаранција до: 15.10.2028.` | R12, E6 | integration (manual, harness) | `test/harness.html` |
| H14 **(changed, A5)** Overlapping scans, as before (delayed first fetch, `handleImage(FIXTURE.receiptUrl)` twice). When the second receipt appears, select **Гаранција** and 6. After 4 s: one `#warranty`, still **Гаранција** with 6, empty status; Add opens `dates=20270415/20270416` | E10, E9 | same | same |
| H15 Unreadable date (console fetch stand-in with `sdcDateTimeLabel` `nonsense`): error `Датум рачуна није препознат: nonsense`, `#receipt` hidden, no `#warranty`, `__opened` empty | E3 | same | same |
| H16 **(changed, A5)** Paste, `?scan`, **Гаранција**, `Друго…`. (1) Text `18` pasted into `#warranty-custom`: field `18`, preview `15.4.2028.`, no error. (2) Image pasted with focus in `#warranty-custom`: no scan, choice and field stay. (3) Image on an empty area: scan; block back to **Рачун**. (4) Text on an empty area: `У клипборду нема слике.` (5) Click `#add-as-warranty` (focus on the radio), Ctrl+V the image: scan. (6) **Гаранција**, change `#warranty-months` with the mouse, Ctrl+V the image: scan. (7) Click `#add-as-receipt`, Ctrl+V text: `У клипборду нема слике.` Repeat 1, 2, 5, 6 in Firefox | R20, E18 | same | same |
| H17 **(changed, A5)** `#add-calendar` errors, `?scan`, close stub. (1) `chrome.tabs.create = async () => { throw new Error('tabs.create failed (test)'); }`; click with **Рачун**: error shown, `__closed` undefined, `__opened` unchanged. (2) **Гаранција**, `const rb = buildWarrantyCalendarUrl; buildWarrantyCalendarUrl = () => { throw new Error('build failed (test)'); };`, click: `build failed (test)`, not closed. (3) Restore both, click: one expiry URL added, `__closed === true` | R21, E19 | same | same |
| H18 **(rewritten, A5)** Tab mode switching, `?tab&scan`, close stub: **Рачун** → click → purchase URL; **Гаранција** (24) → click → expiry URL; **Рачун** → click → purchase URL again, identical to the first. `__opened` has 3 URLs, `__closed` undefined, `#add-calendar` keeps its label `Додај у календар` throughout. Then double-click `#add-calendar`: two more identical URLs are added, as on `main` (E16) | R13, E8, E15, E16 | same | same |
| H19 **(changed, A5)** Drag and drop, `?tab&scan`, **Гаранција**, `Друго…`, `18`. (1) Text dragged within or into `#warranty-custom`: handled by the browser, no error, no `#drop.over`. (2) `test/sample-qr.png` dropped on `#add-as-warranty`: scan, back to **Рачун**. (3) **Гаранција**, file dropped on `#warranty-months`: scan. (4) **Гаранција**, `Друго…`, file dropped on `#warranty-custom`: scan, no navigation. (5) Text dropped on an empty area: `Превуци фајл слике.` | R22, E20 | same | same |
| H20 **(changed, A5)** Hint. `?scan`: `#warranty-hint` is visible with exactly `За рачун и гаранцију скенирај рачун двапут.`, directly under the radio group, with both **Рачун** and **Гаранција** selected. `?tab&scan`: `document.getElementById('warranty-hint') === null`. `?scan&refund`: no hint | R23 | same | same |
| S1 No storage APIs in `src/`; manifests, `src/content.js`, `src/parser.js` unchanged against `main` | R15, R17 | integration (script) | command |
| S2 **(changed, A5)** Docs greps (Acceptance criteria) | R18 | integration (script) | command |
| S3 Paste and drag guards in place (Acceptance criteria) | R20, R22 | integration (script) | command |
| S4 **(new, A5)** Removed UI ids and old texts are gone from `src/` (Acceptance criteria) | R1, R13, R23 | integration (script) | command |

## Implementation steps
Amendments 1–4 are implemented (up to `4290a03`). Only amendment 5 remains. The test writer and the implementer can
work in parallel, because this spec fixes every interface.

### Amendment 5 steps: test writer (test files only)
- **W1.** In `test/calendar-url.test.js`:
  - delete T8, T9, T10, T11 and T24;
  - change T1, T12, T16, T17, T20 and T22, and the file tests "E5" and "E8", as in the Test plan;
  - add T26.

  Keep `SALE_LINES` and `WARRANTY_LINE`.
- **W2.** Check against `4290a03` (current code, where `buildCalendarUrl` still takes a warranty):
  - T26 fails (`buildCalendarUrl.length` is 2, and a months argument adds a `🛡` line);
  - T20 fails on `buildCalendarUrl(r, 24)` and `buildReceiptDescription(r, n, 24)`;
  - the changed file test "E8" fails if it asserts `buildCalendarUrl(SALE, 6) === buildCalendarUrl(SALE)`;
  - all other tests, T1 included, pass against `4290a03`.

  All tests pass once I1 is done.
- **W3.** No harness change is needed (`?refund` exists).

### Amendment 5 steps: implementer (production code and docs only)
- **I1. `src/calendar-url.js`:** remove the warranty parameter, the `🛡` entry and the period check from
  `buildReceiptDescription` and `buildCalendarUrl` (Design).
  - Verify: `node -e "Object.assign(globalThis, require('./src/parser.js')); const c = require('./src/calendar-url.js'); console.log(c.buildCalendarUrl.length, c.buildReceiptDescription.length)"`
    prints `1 2`.
  - Verify: the T20 script in Acceptance criteria prints `identical`.
- **I2. `src/popup.js`:** replace `renderWarranty` with the radio-choice version, and `showReceipt` with the
  one-button version (Design). Remove `#warranty-on`, `#add-warranty`, the `✓ Отворено у новој картици` label and the
  amendment-4 hint. Verify: S4, then H1–H6, H17, H18 and H20.
- **I3. `src/popup.css`:** apply the Warranty section from Design. Verify: H9.
- **I4. Docs:** replace the README paragraph and the Limitations bullets; update `docs/privacy.html` (and its "Last
  updated"), `store/firefox/fields/privacy-policy.txt`, `docs/index.html` and both store descriptions. Verify: S2.
- **I5. Regression run:** run the three `node --test` commands and `python3 scripts/build.py`, then H7, H8,
  H11–H16 and H19 in the harness, and H10 on real browsers.

## Acceptance criteria
Run from the repository root:
```bash
node --test test/*.test.js                               # all pass, 0 fail
TZ=America/Los_Angeles node --test test/*.test.js        # all pass
TZ=Pacific/Kiritimati  node --test test/*.test.js        # all pass

# T20 / R2, R8: the purchase path is byte-identical to main, with or without an extra argument
D=$(mktemp -d) && git show main:src/calendar-url.js > "$D/cal-main.js" && node -e '
Object.assign(globalThis, require("./src/parser.js"));
const before = require(process.argv[1]), after = require("./src/calendar-url.js");
const SALE = { merchantName: "KAFE PRIMER DOO", address: "ПРИМЕРНА 1, Београд", pib: "100000008",
  receiptNumber: "X-1", dateTimeStr: "7.11.2026. 13:25:06", cashier: "Ana", transactionType: "ПРОМЕТ ПРОДАЈА",
  paymentMethod: "Готовина", total: "750,00", vatTotal: "125,00", sourceUrl: "https://suf.purs.gov.rs/v/?vl=" + "A".repeat(760),
  items: [{ name: "Espresso", qty: "1", total: "220,00" }] };
const long = { ...SALE, items: Array.from({ length: 150 }, (_, i) => ({ name: "Артикал са дугим називом " + i, qty: "1", total: "100,00" })) };
const cases = [SALE, { ...SALE, transactionType: "ПРОМЕТ РЕФУНДАЦИЈА" }, { ...SALE, transactionType: "АВАНС ПРОДАЈА" }, long];
const ok = cases.every(r => before.buildCalendarUrl(r) === after.buildCalendarUrl(r) && after.buildCalendarUrl(r) === after.buildCalendarUrl(r, 24)
  && before.buildReceiptDescription(r, 1) === after.buildReceiptDescription(r, 1, 24));
console.log(ok && after.buildCalendarUrl.length === 1 && after.buildReceiptDescription.length === 2 ? "identical" : "DIFFERENT");
' "$D/cal-main.js"                                        # prints: identical

# S1 / R15, R17
grep -nE "localStorage|sessionStorage|indexedDB|chrome\.storage|browser\.storage|document\.cookie" src/*.js   # no output
git diff --exit-code main -- manifest.json manifest.firefox.json src/content.js src/parser.js            # no output, exit 0

# S2 / R18
grep -c "Додај као" README.md                                                                               # ≥ 1
grep -c "Гаранција" README.md store/chrome/fields/store-listing-description.txt store/firefox/fields/description.txt   # each ≥ 1
grep -c "Додај датум истека гаранције\|background tab\|Open it before" README.md docs/privacy.html store/firefox/fields/privacy-policy.txt store/chrome/fields/store-listing-description.txt store/firefox/fields/description.txt docs/index.html   # each 0
grep -ci "warranty" docs/privacy.html store/firefox/fields/privacy-policy.txt docs/index.html                       # each ≥ 1
grep -c "stores nothing" docs/privacy.html store/firefox/fields/privacy-policy.txt                                  # each ≥ 1

# S3 / R20, R22
grep -A1 "document.addEventListener('paste'" src/popup.js | grep -c "if (isTextEntryTarget(e.target)) return;"   # prints 1
grep -A1 -E "document.addEventListener\('(dragover|drop)'" src/popup.js | grep -c "if (isTextEntryTarget(e.target) && !carriesFiles(e)) return;"   # prints 2

# S4 / R1, R13, R23: removed UI is gone, new texts are present
grep -c "add-warranty\|warranty-on\|Додај датум истека гаранције\|✓ Отворено у новој картици\|За оба догађаја" src/popup.js src/popup.css   # each 0
grep -c "За рачун и гаранцију скенирај рачун двапут." src/popup.js                                         # prints 1
grep -c "Додај као:" src/popup.js                                                                           # prints 1
grep -c "active: false\|active: true" src/popup.js                                                          # prints 0

# R11 / T23
grep -nE "en-CA|\.format\(" src/calendar-url.js                # no output

python3 scripts/build.py                                 # ends without "Build failed"
```
Manual: H1–H20 behave as described in the Test plan.

## Assumptions
- **A1.** The end date is the same day of the month N months later (`7.11.2026.` + 24 → `7.11.2028.`), as in the
  user's example.
- **A2.** Dates are written `D.M.YYYY.` without zero padding.
- **A3.** `🛡` is U+1F6E1 without U+FE0F.
- **A4 (obsolete, A5).** The position of the `🛡` line in the purchase description no longer matters: the purchase
  description has no such line.
- **A5 (obsolete, A5).** The PWA's tolerance of a `🛡` line in purchase events no longer matters: purchase events are
  `main`'s again (E13).
- **A6.** The expiry title is `Гаранција истиче: <merchant>`, with em dashes replaced by `-`, because the PWA splits
  titles on `' — '`.
- **A7.** The expiry description keeps the end date, receipt number, purchase date and time, items and link. It
  drops `💰`, `💳`, `🧾`, merchant, address, PIB and cashier.
- **A8 (obsolete, amendment 4).** Background tab.
- **A9 (changed, A5).** The block, with the choice and the picker, sits above "Додај у календар", because the choice
  must be made before the click.
- **A10.** The custom period is capped at 120 months.
- **A11.** "Друго…" is prefilled with the preset selected just before.
- **A12.** "(истекла)" appears only in the preview.
- **A13 (changed, A5).** Non-sale receipts get no block. `buildWarrantyCalendarUrl` throws for them.
  `buildCalendarUrl` has no warranty input at all now.
- **A14.** UI behaviour is checked manually with the harness. There is no browser test runner.
- **A15.** No version bump and no regenerated screenshots in this branch.
- **A16.** The PWA counts every event in its Receipts calendar, so a saved expiry event still counts (0 RSD,
  unknown payment). The README advises another calendar.
- **A17.** `valueAsNumber` for `+24` and `1e2` depends on the browser. Either result is safe.
- **A18.** Text-entry fields are `textarea`, `contenteditable`, and `input` of type `text`, `number`, `search`,
  `email`, `url`, `tel` or `password`. Radio buttons, selects, checkboxes and buttons never block paste or drop.
- **A19 (obsolete, A5).** The `✓ Отворено у новој картици` label: the button that carried it is gone.
- **A20.** Only the expiry title trims the merchant name.
- **A21.** A drag that carries files is always handled by the page, even over the text field. An image pasted into
  the text field does nothing.
- **A22.** "Carries files" is read from `e.dataTransfer.types.includes('Files')`.
- **A23 (changed, A5).** One click adds one event. In popup mode the popup closes, so both events take two scans; in
  tab mode the user switches and clicks again. This is the user's decision, and it needs no permissions.
- **A24 (changed, A5).** The hint is muted 12px text directly under the radio group. It is visible in popup mode
  whatever the choice, because it is about the flow and a user on **Рачун** may also want the warranty. It is not
  created in tab mode or for non-sale receipts.
- **A25.** "Popup mode" is every mode except `?tab`, including Firefox for Android's full-screen page.
- **A26 (obsolete, A5).** The double-click guard on `#add-warranty`. "Додај у календар" keeps `main`'s behaviour,
  with no guard (E16).
- **A27 (new, A5).** The choice is two native radio inputs (`name="add-as"`) inside a `div` with
  `role="radiogroup"`, labelled by the `Додај као:` text. A `fieldset`/`legend` was not used because a `legend`
  does not sit inline next to the options without extra CSS.
  - `#add-as-receipt` and `#add-as-warranty` are the stable ids for tests.
  - The labels are exactly `Рачун` and `Гаранција`.
- **A28 (new, A5).** Switching between **Рачун** and **Гаранција** keeps the period state (preset, custom value)
  within the same receipt. Only a new scan resets it.
- **A29 (new, A5).** "No warranty parameter" means it is removed from the signatures (`.length` 1 and 2). An extra
  argument from an old caller is silently ignored, which is standard JavaScript and keeps the output equal to
  `main`. Making it throw would add a check that `main` does not have.
- **A30 (new, A5).** "The purchase path equals `main`" is checked on the output (byte-identical URLs and
  descriptions: T1, T20, T26), not on the source. `buildReceiptDescription` and `buildCalendarUrl` may keep calling
  the shared helpers `itemLinesText` and `fitCalendarUrl`.
- **A31 (new, A5).** In tab mode there is no "opened" mark and no status message after a click, as on `main`'s
  button. Each click opens the form for the current choice.
- **A32 (new, A5).** The `chrome.tabs.create({ url })` call omits `active` for both choices, exactly as `main` does
  (the default is in front). Amendment 4's explicit `active: true` is dropped so that the purchase path matches
  `main`; S4 checks that neither `active` form remains.
- **A33 (new, A5).** T1 now holds a git-free golden value for `SALE`'s full purchase URL. T20 keeps the broader
  comparison with `main` where git is available.

## Open questions
None blocks implementation.
1. ~~Warranty event title~~: resolved (A6).
2. **Receipt-page button.** Should the floating button also offer the warranty? Recommended: not now.
3. **Cap.** Is 120 months acceptable (A10)?
4. ~~Warranty event description~~: resolved (A7).
5. ~~Second button~~: superseded by amendment 5 (one button, a choice).
6. **Release.** Version bump to 1.1.0 and regenerated screenshots on this branch, or at release time (A15)?
7. **PWA counting (E14, A16).** Is the README advice enough, or should the Receipt Scanner skip events titled
   `Гаранција истиче…`? Recommended: the README now, and a PWA issue separately.

### Recorded follow-ups (not requirements)
- **F1.** Intl-part guard in `isWarrantyExpired`: a missing `year`, `month` or `day` part would throw inside
  `update()`.
- ~~**F2.**~~ Resolved (amendment 4): the background tab is gone.
- **F3 (partly resolved, A5).** T1 now has a git-free golden value for `SALE` (A33). T20's wider comparison still
  depends on a local `main` and is skipped in CI without it. Golden values for `REFUND`, `OTHER` and `LONG` are a
  possible later step.
- ~~**F4.**~~ Obsolete (amendment 4, and the `✓` label is gone in amendment 5).
- **F5.** For an already-expired warranty, **Гаранција** still opens an event in the past, which the PWA counts at
  once if it is saved to its Receipts calendar.
