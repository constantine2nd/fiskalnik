# Warranty end date for a receipt
Status: draft (amended after review: expiry-event description and title, `isWarrantyExpired`, popup custom field, extra tests) · Author: sdlc-spec-writer · Date: 2026-11-27

## Summary
In the popup's review step the user can turn on a warranty for a sale receipt and choose its length (6, 12, 24 or
36 months, or a custom number of months). The end date, counted from the receipt's own date, is added as one line
to the purchase event's description. An optional second button opens a second Google Calendar form: an all-day
event on the day the warranty ends. This tells the user when the warranty runs out. Nothing is stored, and with
the warranty off the output stays byte-identical to today's.

## Context
Line numbers in this section refer to `main` (`31d7ab3`), before this feature.

- **Pure calendar module.** `src/calendar-url.js` builds the Google Calendar template URL from a parsed receipt.
  - `receiptWallTime()` (`src/calendar-url.js:12-15`) keeps the receipt's Belgrade wall-clock time in a UTC
    timestamp, used only as a timezone-free container. `formatCalendarStamp()` (`:17-19`) formats it.
  - `buildReceiptDescription(receipt, itemLimit)` (`:31-56`) writes the emoji-prefixed description that the
    Receipt Scanner PWA reads back (comment at `:1-4`). `buildCalendarUrl(receipt)` (`:58-77`) throws
    `'Датум рачуна није препознат: ' + dateTimeStr` for an unreadable date (`:60`). It drops item lines from the end
    until the URL is at most `MAX_CALENDAR_URL_LENGTH = 6000` (`:6`, `:72-76`).
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
- **Receipt-page button.** `src/content.js:30-38` builds the URL with `buildCalendarUrl(receipt)` and opens it
  directly, with no review step. It stays unchanged.
- **Other callers of `buildCalendarUrl(receipt)`.** `store/chrome/shot.html:70` and
  `.claude/skills/demo-video/capture.js:40` call it with one argument. They must keep working unchanged.
- **Receipt Scanner PWA.** It is not in this repo. A local clone exists at
  `/home/marko/Tesons/GitHub/constantine2nd/receipt` (commit `fb02811`).
  - `eventToReceipt()` (`js/app.js:405-453`) reads lines by prefix (`getLine('💰 Укупно: ')` and so on). The item
    list stops at the first line that does not start with `• `, and the address scan stops at the first
    `📋🕐👤💳` line. A new line placed after `🧾 ПДВ` is therefore ignored.
  - `parseSummary()` (`js/app.js:456`, used by the monthly report in `js/report.js:66-74`) splits the event title at
    the last `' — '` and reads the part after it as the amount.
  - `fetchReceiptEvents()` (`js/api.js:149-160`) lists only events from the past 2 years up to now.
  - The monthly report (`js/report.js:48-51`, `:60-90`) counts **every** event of the month in the Receipts
    calendar, without looking at its description:
    - the amount comes from the title (`parseSummary`), not from the `💰` line;
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
- A per-receipt warranty choice in the popup review step, for sale receipts only, off by default.
- The end date (receipt date + N months) as a line in the purchase event's description.
- An optional second Google Calendar form: an all-day event on the end date.
- Correct date arithmetic (end of month, leap years, machine timezone) and a cap on the custom period.
- Docs, store texts and the privacy policy updated.

**Non-goals.** Do not build any of these:
- Warranty on the receipt-page floating button (`src/content.js`). Users who want a warranty there use the toolbar
  popup, whose scan button uses the page's own link.
- A warranty per item, or several periods on one receipt.
- Automatic detection of warranty terms in the receipt text, or any legal or consumer-law wording or advice.
- Remembering the last choice, settings or history (no `storage` permission, no `localStorage` or `sessionStorage`).
- Notifications or reminders of our own (Google Calendar's own default notifications apply), or editing existing
  events.
- Changes to `src/parser.js`, `manifest*.json`, the Receipt Scanner PWA or `scripts/build.py`.
- A version bump, regenerated store screenshots, or a new demo video.

## Requirements
- **R1.** For a receipt whose `transactionKind(receipt.transactionType)` is `'sale'`, the popup review step must show
  a warranty block (`#warranty`) above the "Додај у календар" button. The block starts with the checkbox
  `#warranty-on` unchecked and its options `#warranty-options` hidden.
- **R2.** While the warranty is off, the URL opened by "Додај у календар" must be byte-identical to today's
  `buildCalendarUrl(receipt)`. `buildCalendarUrl(receipt)`, `buildCalendarUrl(receipt, undefined)` and
  `buildCalendarUrl(receipt, null)` must return the same string, and that string must equal the output of the
  `main` branch for the same receipt.
- **R3.** When the warranty is on, the user must be able to choose:
  - a preset period with `#warranty-months`, offering 6, 12, 24 and 36 months, with 24 selected when the block
    first appears; or
  - "Друго…", which shows `#warranty-custom`, a number input for a whole number of months from 1 to
    `MAX_WARRANTY_MONTHS` (120).
- **R4.** `normalizeWarrantyMonths(value)` must return the integer number of months when `value` is
  - an integer `Number` from 1 to 120, or
  - a string that, after trimming whitespace, is 1-3 ASCII digits with a value from 1 to 120.
  
  For anything else it must return `null`.
- **R5.** `warrantyEndDate(dateTimeStr, months)` must return the end date `{year, month, day}` (month 1-12):
  - It is the receipt's own date (from `dateTimeStr`, never "today") plus `months` calendar months.
  - When that day does not exist in the target month, it is clamped to the month's last day.
  - It returns `null` when the date cannot be parsed or `months` is not valid under R4.
- **R6.** The warranty end date, the description line, and the all-day event dates must depend only on the date
  printed on the receipt. They must not change with the machine's timezone or daylight saving time.
- **R7.** With a valid warranty on a sale receipt, the purchase event description must contain exactly one extra
  line, `🛡 Гаранција до: D.M.YYYY.`. Its rules:
  - `🛡` is U+1F6E1 with no variation selector, followed by one space.
  - Day and month have no leading zero, and the date ends with a dot. Example: `🛡 Гаранција до: 7.11.2028.`
  - The line sits immediately before the `🔗` line, which stays last.
  - All other lines are unchanged and in the same order. For non-sale receipts no line is added.
- **R8.** `buildCalendarUrl(receipt, warrantyMonths)`:
  - With `warrantyMonths` `undefined` or `null`, it returns today's output.
  - With a valid value on a sale receipt, it adds the R7 line.
  - With a valid value on a non-sale receipt, it returns the same output as without a warranty.
  - With any other value it throws `Error('Неисправан период гаранције: ' + warrantyMonths)`.
  - An unreadable receipt date still throws `'Датум рачуна није препознат: ' + dateTimeStr`, checked first.
- **R9.** `buildWarrantyCalendarUrl(receipt, warrantyMonths)` must return a Google Calendar template URL. Its query
  parameters, in this order:
  - `action=TEMPLATE`
  - `text=Гаранција истиче: <title merchant>`, or just `Гаранција истиче` when `merchantName` is empty. The
    title merchant is `merchantName` with every em dash (U+2014 `—`) replaced by a hyphen-minus (U+002D `-`), so
    the title never contains `' — '` (E14). Example: `ALFA — BETA DOO` → `Гаранција истиче: ALFA - BETA DOO`.
  - `dates=YYYYMMDD/YYYYMMDD`: an all-day event on the end date; the second date is the next day (exclusive)
  - `ctz=Europe/Belgrade`
  - `details`: `buildWarrantyDescription(receipt, itemLimit, warrantyMonths)` (R19). It has no `💰` total, `💳`
    payment or `🧾` VAT line.
  - `location=<receipt.address>`

  It throws, in this order of checks:
  1. `'Датум рачуна није препознат: ' + dateTimeStr` when the date cannot be parsed.
  2. `'Неисправан период гаранције: ' + warrantyMonths` when the months are not valid under R4, including
     `null` and `undefined`.
  3. `'Гаранција се додаје само за рачун продаје.'` when the receipt is not a sale.
- **R10.** Both URLs (R8 and R9) must be at most 6000 characters. To fit, only item lines are dropped, from the end,
  with the existing `… +N` marker. The other lines are always kept: in the purchase event (R8) that means the
  `🛡`, `💰 Укупно` and `🔗` lines; in the expiry event (R9) the `🛡`, `📋`, `🕐` and `🔗` lines.
- **R11.** While the warranty is on and valid, `#warranty-end` must show `Гаранција до: D.M.YYYY.`, updated on every
  change of the checkbox, preset or custom value. When `isWarrantyExpired(end)` is true, the text ends with
  ` (истекла)`, and the buttons stay enabled.
- **R12.** The popup reads the custom field (`type="number"`) as a number, `custom.valueAsNumber`. It accepts it
  only when it is a whole number, and then passes that number to `normalizeWarrantyMonths`, so `24.0` gives 24;
  `+24` and `1e2` give 24 and 100 wherever the browser reports a number for them. `normalizeWarrantyMonths`
  itself does not change (R4). While the warranty is on and that value is invalid:
  - `#warranty-error` shows `Унеси број месеци од 1 до 120.`;
  - `#warranty-end` is hidden;
  - both `#add-calendar` and `#add-warranty` are disabled.
  
  No URL is built and no tab is opened.
- **R13.** "Додај у календар" (`#add-calendar`) must build its URL at click time from the current choice. With a
  valid warranty it opens `buildCalendarUrl(receipt, months)`. With the warranty off it opens the URL from R2.
  Opening (`chrome.tabs.create({url})`) and closing the popup are the same as today.
- **R14.** "Додај датум истека гаранције" (`#add-warranty`) must be visible only while the warranty is on. On click
  it calls `chrome.tabs.create({ url: buildWarrantyCalendarUrl(receipt, months), active: false })`. It must not
  close the popup or the tab page, and it sets the status line to
  `Догађај за истек гаранције је отворен у новој картици.` If the build throws, the status line shows `err.message`
  as an error.
- **R15.** Nothing may be persisted:
  - no use of `localStorage`, `sessionStorage`, `indexedDB`, `chrome.storage`/`browser.storage` or cookies in `src/`;
  - no change to `manifest.json` or `manifest.firefox.json`;
  - every newly shown receipt starts with the warranty off.
- **R16.** The warranty block must work and fit in:
  - the 340px desktop popup;
  - the full-tab page (`?tab`);
  - Firefox for Android (`body.mobile`): on a 360px-wide viewport the checkbox row, select, custom input and button
    are each at least 44px tall, with no horizontal scroll;
  - light and dark color schemes.
  
  All visible labels are in Serbian Cyrillic, with the exact texts in Design.
- **R17.** The receipt-page button (`src/content.js`) and the PWA-shared parser (`src/parser.js`) must stay
  unchanged.
- **R18.** The README, the privacy policy (`docs/privacy.html`, `store/firefox/fields/privacy-policy.txt`), the
  landing page (`docs/index.html`) and both store descriptions must describe the feature with the texts in
  Design. The "stores nothing" statements stay and remain true.
- **R19.** `buildWarrantyDescription(receipt, itemLimit, warrantyMonths)` must return exactly these lines, in this
  order, joined by `\n`:
  1. `🛡 Гаранција до: D.M.YYYY.` (as in R7)
  2. `📋 <receiptNumber>`
  3. `🕐 <dateTimeStr>`
  4. `🛒 Артикли:`
  5. the item lines, exactly as in the purchase description (`• <name> ×<qty> = <total> RSD`, trimmed to
     `itemLimit` with `… +N`, or `(no items parsed)` when there are no items)
  6. `🔗 <sourceUrl>`

  It has no merchant, address, `PIB:`, `👤`, `💳`, `↩`/`🏷`, `💰` or `🧾` line. With a period that is not valid
  under R4, or for a non-sale receipt, line 1 is left out. Callers validate first, as `buildWarrantyCalendarUrl`
  does. Without the `💳` line a saved expiry event at least does not inflate a real payment method in the PWA
  report. It is still counted as a receipt there (E14).

## Design

### Files
| File | Change |
|---|---|
| `src/calendar-url.js` | Add constants and pure functions; extend `buildReceiptDescription` and `buildCalendarUrl`; add `buildWarrantyDescription` and `buildWarrantyCalendarUrl`; extend exports |
| `src/popup.js` | Add `renderWarranty()`; change `showReceipt()` |
| `src/popup.css` | New "Warranty" section |
| `test/calendar-url.test.js` | New unit tests (test-writer) |
| `test/harness.html` | Optional `?refund` switch (test-writer), see Test plan |
| `README.md`, `docs/privacy.html`, `docs/index.html`, `store/firefox/fields/privacy-policy.txt`, `store/chrome/fields/store-listing-description.txt`, `store/firefox/fields/description.txt` | Texts below |
| `docs/specs/warranty-end-date.md` | This spec |

No new files in `src/`, no change to `popup.html` (the block is built in JS, as the rest of `#receipt` is).

### `src/calendar-url.js`: interface
Add these constants near `TRANSACTION_MARK` (`:24`):
```js
const WARRANTY_PRESETS = [6, 12, 24, 36];   // months offered in the popup
const DEFAULT_WARRANTY_MONTHS = 24;          // selected when the warranty is turned on
const MAX_WARRANTY_MONTHS = 120;             // custom periods above this are rejected
const WARRANTY_MARK = '\u{1F6E1}';           // 🛡 (no U+FE0F)
```

Functions. All are pure; "date" means `{year, month, day}` with a 1-based month.
```js
normalizeWarrantyMonths(value) → number | null
warrantyEndDate(dateTimeStr, months) → { year, month, day } | null
formatWarrantyDate({ year, month, day }) → string          // {2028,11,7} → '7.11.2028.'
isWarrantyExpired({ year, month, day }, now = new Date()) → boolean
buildReceiptDescription(receipt, itemLimit, warrantyMonths) → string   // 3rd param new, optional
buildCalendarUrl(receipt, warrantyMonths) → string                     // 2nd param new, optional
buildWarrantyDescription(receipt, itemLimit, warrantyMonths) → string  // new (R19)
buildWarrantyCalendarUrl(receipt, warrantyMonths) → string             // new
```

Behaviour:
- **`normalizeWarrantyMonths`**:
  - A number must satisfy `Number.isInteger(v) && v >= 1 && v <= MAX_WARRANTY_MONTHS`.
  - A string must match `/^\d{1,3}$/` after `.trim()`, and its `Number()` must be from 1 to 120.
  - Any other type (`null`, `undefined`, boolean, object) gives `null`.
  - Examples: `24`→24, `'24'`→24, `' 24 '`→24, `'024'`→24, `'120'`→120. These give `null`: `0`, `-3`, `2.5`, `NaN`,
    `Infinity`, `121`, `''`, `'0'`, `'-3'`, `'+24'`, `'2.5'`, `'1e2'`, `'abc'`, `'121'`, `'999999'`, `true`.
- **`warrantyEndDate`**:
  1. Read the date with `parts = parseSerbianDateParts(dateTimeStr)`, and the period with
     `n = normalizeWarrantyMonths(months)`. If either is `null`, return `null`.
  2. Compute the target month: `y = parts.year`, `m0 = parts.month - 1 + n`, `ty = y + Math.floor(m0 / 12)`,
     `tm = m0 % 12` (0-based).
  3. Find the target month's last day: `last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()`.
  4. Return `{ year: ty, month: tm + 1, day: Math.min(parts.day, last) }`.

  Only `Date.UTC` and `getUTC*` are used, never local-time `Date` methods (R6). The time of day is ignored.
- **`formatWarrantyDate`**: `` `${day}.${month}.${year}.` ``. Day and month are not zero-padded, matching the
  receipts' `7.11.2026.` style.
- **`isWarrantyExpired`**:
  - Get today's Belgrade date from the parts, never from the shape of a formatted string. (One Chrome/ICU release
    returned `'M/D/YYYY'` for `en-CA`.)
    ```js
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Belgrade', calendar: 'gregory', numberingSystem: 'latn',
      year: 'numeric', month: 'numeric', day: 'numeric',
    }).formatToParts(now);
    const get = type => Number(parts.find(p => p.type === type).value);
    const today = { year: get('year'), month: get('month'), day: get('day') };
    ```
  - Compare `year * 10000 + month * 100 + day` for both dates. Return `true` only if the end date is strictly
    earlier; the end day itself is not expired.
  - Do not call `.format()`.
- **`buildReceiptDescription(receipt, itemLimit, warrantyMonths)`**:
  - Compute `end = transactionKind(receipt.transactionType) === 'sale' ? warrantyEndDate(receipt.dateTimeStr, warrantyMonths) : null`.
  - In the array at `:41-55`, insert `end ? `${WARRANTY_MARK} Гаранција до: ${formatWarrantyDate(end)}` : ''`
    between the `🧾 ПДВ` entry and the `🔗` entry. The `.filter(Boolean)` already drops it when it is empty.
  - Nothing else changes.
- **Item lines helper.** Move the item-line text (`:33-39`) into an internal
  `itemLinesText(items, itemLimit) → string`, so that both descriptions produce identical item lines and trimming.
  `buildReceiptDescription`'s output must not change (R2).
- **`buildWarrantyDescription(receipt, itemLimit, warrantyMonths)`** (R19):
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
  For `SALE` with 24 months:
  ```
  🛡 Гаранција до: 7.11.2028.
  📋 ABCD1234-ABCD1234-1001
  🕐 7.11.2026. 13:25:06
  🛒 Артикли:
  • Espresso ×1 = 220,00 RSD
  • Limunada 0.3 ×1 = 295,00 RSD
  🔗 https://suf.purs.gov.rs/v/?vl=AAAA…  (the full SALE.sourceUrl)
  ```
- **`buildCalendarUrl(receipt, warrantyMonths)`**:
  1. Keep the date check at `:59-60` first.
  2. Then, if `warrantyMonths != null` and `normalizeWarrantyMonths(warrantyMonths) === null`, throw
     `new Error('Неисправан период гаранције: ' + warrantyMonths)`.
  3. Pass `warrantyMonths` through to `buildReceiptDescription`.
  4. Move the trimming loop (`:72-76`) into an internal helper `fitCalendarUrl(make, itemCount)`, which returns the
     URL, so that both builders share it.

  With `warrantyMonths == null`, the URL parameters, their order and their values are as today.
- **`buildWarrantyCalendarUrl(receipt, warrantyMonths)`**:
  1. Check the date (same throw as `:60`), then the months (same throw as above, `null` and `undefined` included),
     then that the receipt is a sale (throw `new Error('Гаранција се додаје само за рачун продаје.')`).
  2. Compute `end = warrantyEndDate(...)`. Format it as `YYYYMMDD` with
     `new Date(Date.UTC(end.year, end.month - 1, end.day)).toISOString().slice(0, 10).replace(/-/g, '')`, and the
     next day the same way with `day + 1`.
  3. Build the title as
     `receipt.merchantName ? 'Гаранција истиче: ' + receipt.merchantName.replace(/\u2014/g, '-') : 'Гаранција истиче'`.
  4. Build the URL with `new URLSearchParams({ action, text, dates, ctz, details, location })`, in that key order,
     with `details: buildWarrantyDescription(receipt, itemLimit, warrantyMonths)`, through `fitCalendarUrl`.

  Example: `SALE` (`7.11.2026. 13:25:06`, merchant `KAFE PRIMER DOO`) with 24 months gives
  `text=Гаранција истиче: KAFE PRIMER DOO` and `dates=20281107/20281108`.
- **Exports** (`:80-82`):
  ```js
  module.exports = {
    buildCalendarUrl, buildReceiptDescription, buildWarrantyCalendarUrl, buildWarrantyDescription,
    normalizeWarrantyMonths, warrantyEndDate, formatWarrantyDate, isWarrantyExpired,
    WARRANTY_PRESETS, DEFAULT_WARRANTY_MONTHS, MAX_WARRANTY_MONTHS,
  };
  ```
- **Global names.** The module loads as a classic script next to `parser.js`, `content.js` and `popup.js`. The new
  top-level names must not clash with names in those files (checked: none do).

### `src/popup.js`: UI
Add `renderWarranty(receipt, mainButton) → { box, months }` above `showReceipt`, with a comment saying that the
period applies to the whole receipt and that nothing is remembered. It builds the DOM below with `el()`. All state
lives in this closure; there are no module-level variables (E10).

```html
<div id="warranty" class="warranty">
  <label class="warranty-toggle"><input type="checkbox" id="warranty-on"> Гаранција</label>
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
    <button type="button" id="add-warranty" class="secondary">Додај датум истека гаранције</button>
  </div>
</div>
```
- Build the option labels from `WARRANTY_PRESETS` with a map in `popup.js`:
  `const WARRANTY_OPTION_LABEL = { 6: '6 месеци', 12: '12 месеци', 24: '24 месеца', 36: '36 месеци' };`.
- Build the error text from `MAX_WARRANTY_MONTHS`.
- **`months()`**:
  - returns `null` when `#warranty-on` is unchecked;
  - when the select is `custom`, reads the field as a number (R12):
    `const n = custom.valueAsNumber; return Number.isInteger(n) ? normalizeWarrantyMonths(n) : null;`.
    An empty or unparsable field gives `NaN`, and therefore `null`;
  - otherwise returns `Number(select.value)`.
- **`update()`** runs on `change` of the checkbox and the select, and on `input` of the custom field:
  - When the checkbox is off: hide `#warranty-options` and set `mainButton.disabled = false`.
  - When it is on: show `#warranty-options`, and show `#warranty-custom` only when the select is `custom`.
    - If `months()` is valid: hide the error, show `#warranty-end` with
      `'Гаранција до: ' + formatWarrantyDate(end)`, adding `' (истекла)'` when `isWarrantyExpired(end)`, and enable
      both buttons.
    - If it is invalid: show the error, hide `#warranty-end` and disable both buttons (R12).
- **Choosing "Друго…"**: prefill `#warranty-custom` with the preset that was selected just before (24 at first),
  then focus it.
- **`#add-warranty` click**:
  ```js
  try {
    await chrome.tabs.create({ url: buildWarrantyCalendarUrl(receipt, months()), active: false });
    setStatus('Догађај за истек гаранције је отворен у новој картици.');
  } catch (err) { setStatus(err.message, 'error'); }
  ```
  No `window.close()`. Background is chosen so that the desktop popup, which closes when it loses focus, stays open
  for "Додај у календар" afterwards.

Change `showReceipt(receipt, calendarUrl)` (`:84-96`):
- Give the main button an id: `add.id = 'add-calendar'`.
- Click handler: `const months = warranty?.months() ?? null;`, then
  `await chrome.tabs.create({ url: months ? buildCalendarUrl(receipt, months) : calendarUrl });`. The
  `window.close()` line stays as it is.
- Before `replaceChildren`: `const warranty = transactionKind(receipt.transactionType) === 'sale' ? renderWarranty(receipt, add) : null;`.
  Then `receiptEl.replaceChildren(...(warranty ? [warranty.box] : []), add, <journal or summary>)`.
- `add.focus()` stays.
- `handleImage()` stays as it is. It still calls `buildCalendarUrl(receipt)` at `:191`, so an unreadable date fails
  before the review step, exactly as today (E3).

### `src/popup.css`
Add a section after "Receipt" (`:101-103`), using the existing variables:
```css
/* ── Warranty ─────────────────────────────────────────── */
.warranty { margin: 0 0 10px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
.warranty-toggle { display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; }
.warranty-toggle input { width: 18px; height: 18px; margin: 0; accent-color: var(--accent); }
#warranty-options { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
#warranty-options select, #warranty-options input {
  padding: 8px 10px; font: inherit; color: var(--text); background: var(--bg);
  border: 1px solid var(--border); border-radius: 8px;
}
#warranty-options input { width: 7em; }
#warranty-end, #warranty-error { flex-basis: 100%; margin: 0; font-size: 13px; }
#warranty-error { color: var(--error); }
#warranty-options button { margin: 0; }
body.mobile .warranty-toggle { min-height: 44px; font-size: 16px; }
body.mobile #warranty-options select, body.mobile #warranty-options input { min-height: 44px; font-size: 16px; }
```
`.hidden` (`:47`, `!important`) overrides `display: flex`. `body.mobile button` (`:45`) already makes
`#add-warranty` at least 44px tall.

### Documentation texts (R18)
- **`README.md`**, section "Use": add this paragraph after "The popup shows the receipt as it is printed…":
  > **Warranty.** For a sale, tick **Гаранција** above the button and choose 6, 12, 24 or 36 months, or **Друго…**
  > for your own number of months (1–120). The end date, counted from the receipt's date, is added to the event as
  > `🛡 Гаранција до: 7.11.2028.`. **Додај датум истека гаранције** opens a second form in a background tab: an
  > all-day event on that date, titled `Гаранција истиче: Merchant`. Open it before **Додај у календар**, which
  > closes the popup. Nothing is remembered; the next receipt starts with the warranty off. The button on the
  > receipt page has no warranty option; use the toolbar popup there.

  Under "Limitations", add:
  > - One warranty period per receipt. Save the warranty event to a calendar other than the Receipt Scanner's
  >   **Receipts** calendar. Once its date has passed, the Receipt Scanner shows any event in that calendar as a
  >   receipt: without an amount, under an unknown payment method, and counted in the month's number of receipts.
- **`docs/privacy.html`**:
  - In "What it sends", in the Google Calendar item, replace "The receipt details (the list above, and the receipt
    link)" with "The receipt details (the list above, the receipt link, and the warranty end date if you set one)".
    Add the sentence: "“Додај датум истека гаранције” opens a second form the same way."
  - In "What it stores", add after "keeps no history of receipts.": "The warranty period you choose is not saved
    either."
  - Change "Last updated" to the date of the change.
- **`store/firefox/fields/privacy-policy.txt`**: the same two edits, in its shorter wording.
- **`docs/index.html`**, "How it works" step 2: change it to "Check the receipt, which is shown as it was printed,
  and set a warranty period if you want its end date in the calendar."
- **Both store descriptions** (`store/chrome/fields/store-listing-description.txt`,
  `store/firefox/fields/description.txt`):
  - Add to МОГУЋНОСТИ: `• Гаранција: изаберите трајање (6, 12, 24, 36 месеци или друго) и датум истека се уписује у догађај; још једним кликом додајете целодневни догађај на дан истека`
  - Add to FEATURES: `• Warranty: pick a period (6, 12, 24 or 36 months, or your own) and the end date goes into the event; one more click adds an all-day event on the day it ends`

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
  - An all-day event on `31.12.2027.` has `dates=20271231/20280101`.
- **E3.** The receipt date cannot be parsed: the popup shows `Датум рачуна није препознат: …` as an error and no
  review step (no warranty block), exactly as today. Both builders throw that message even when months are given.
  H15 checks the popup side.
- **E4.** Refund or other non-sale receipts (`↩`/`🏷`):
  - The warranty block is not rendered, and "Додај у календар" opens today's URL.
  - `buildCalendarUrl(nonSale, 24)` returns the same string as `buildCalendarUrl(nonSale)`.
  - `buildWarrantyCalendarUrl(nonSale, 24)` throws `Гаранција се додаје само за рачун продаје.`
- **E5.** The warranty has already expired (an old receipt): the preview reads `Гаранција до: … (истекла)`. Both
  buttons stay enabled, and the description line has no "expired" marker.
- **E6.** Invalid periods.
  - In the pure functions (R4): `''`, `0`, `-3`, `2.5`, `'1e2'`, `'+24'`, `'abc'`, `121` and `'999999'` give
    `null`; `120` and `' 12 '` are valid.
  - In the popup's custom field (R12), the field's numeric value counts:
    - empty, `abc` (no number), `0`, `-3`, `2.5`, `121` and `999999` are invalid: error text, both buttons
      disabled, and no URL is built;
    - `24.0` is 24;
    - `1e2` is 100 and `+24` is 24, wherever the browser reports a number for them; otherwise they are invalid.
- **E7.** Long receipts at the URL limit with a warranty: both URLs stay at most 6000 characters, and item lines are
  cut with `… +N`. The purchase event keeps its `🛡`, `💰` and `🔗` lines; the expiry event keeps its `🛡`, `📋`,
  `🕐` and `🔗` lines and never has a `💰` line.
- **E8.** The choice changes after the review is shown (on, preset, custom, off): each click builds its URL from the
  current state. Turning the warranty off again gives the R2 byte-identical URL.
- **E9.** A new scan replaces the receipt: the new block starts unchecked, with 24 selected and the custom field
  hidden. Exactly one `#warranty` exists in the document.
- **E10.** A scan is aborted, or a second scan starts while the first runs: only the newest run reaches
  `showReceipt` (`currentRun`, `src/popup.js:158-170`). The warranty state is local to that call, so it always
  belongs to the receipt shown. When the older run's fetch finishes later, it shows no error and does not reset or
  replace the block the user is working with. H14 checks this.
- **E11.** Timezone and DST: the results do not change when the machine runs in another timezone.
  - `1.1.2026. 00:10:00` + 6 → `1.7.2026.`
  - `31.12.2026. 23:59:59` + 1 → `31.1.2027.`
  - `29.3.2026. 02:30:00` (the spring DST change) + 6 → `29.9.2026.`
  - `25.10.2026. 02:30:00` (the autumn DST change) + 12 → `25.10.2027.`
- **E12.** An empty `merchantName` (no journal on the page): the warranty event title is `Гаранција истиче`, with no
  colon.
- **E13.** The Receipt Scanner PWA reads a purchase event that has the `🛡` line: by code reading
  (`receipt/js/app.js:405-453`) every field it reads (merchant, address, PIB, items, total, VAT, payment, link)
  comes out the same as without the line. This is a residual risk, because the deployed PWA may differ from the
  local clone.
- **E14.** The expiry event is saved into the PWA's **Receipts** calendar. Once its date has passed, the PWA lists
  it and counts it in the monthly report. The PWA counts every event in that calendar (Context), so no
  description content can prevent this. The spec limits the damage:
  - the title never contains `' — '`, because every em dash in the merchant name becomes `-` (R9). The PWA
    therefore reads the amount as `''` → 0, and the monthly total does not change;
  - there is no `💳` line (R19), so a real payment method's count does not grow. The event goes to "unknown
    payment";
  - there is no `💰` or `🧾` line, so the PWA's receipt card shows no total or VAT for it.

  The receipt count and the average still include the event. That residual risk is documented in the README
  (save the event to another calendar), and Open question 7 covers it.
- **E15.** In popup mode the user clicks "Додај у календар" before the warranty button: the popup closes as today,
  and the purchase event still carries the `🛡` line. To add the expiry event, the user scans again.
- **E16.** "Додај датум истека гаранције" is clicked twice: two forms open. There is no duplicate check, as today.
- **E17.** The `isWarrantyExpired` boundary uses Belgrade dates:
  - end `7.11.2028.`, now `2028-11-07T22:59:59Z` (23:59:59 Belgrade): not expired;
  - end `7.11.2028.`, now `2028-11-07T23:00:00Z` (8 Nov 00:00 Belgrade): expired;
  - end `1.7.2027.`, now `2027-07-01T21:59:59Z` (CEST, Belgrade still 1 July): not expired;
  - end `1.7.2027.`, now `2027-07-01T22:00:00Z`: expired.

## Test plan
The unit tests go in `test/calendar-url.test.js`, with the existing `SALE` literal (`:10-16`) and style. The popup UI
has no browser automation in this repo, so UI rows are manual checks with `test/harness.html` (served with
`python3 -m http.server 8766`) and in real browsers. The fixture receipt is dated `15.10.2026. 10:15:30`.

| Test | Covers | Type | File |
|---|---|---|---|
| T1 `buildCalendarUrl(SALE)` equals `buildCalendarUrl(SALE, undefined)` and `(SALE, null)`. Its keys are `['action','text','dates','ctz','details','location']`; its `details` lines `deepEqual` the 13 expected lines of today's format (merchant … `🔗 …`) | R2, R8 | unit | `test/calendar-url.test.js` |
| T2 `normalizeWarrantyMonths` table: the valid and `null` examples from Design | R4, E6 | unit | `test/calendar-url.test.js` |
| T3 `warrantyEndDate('7.11.2026. 13:25:06', m)` for 6/12/24/36 → `7.5.2027`, `7.11.2027`, `7.11.2028`, `7.11.2029` (as objects) | R3, R5 | unit | `test/calendar-url.test.js` |
| T4 Month-end clamping table (E1) | R5, E1 | unit | `test/calendar-url.test.js` |
| T5 Year rollover table (E2), including the all-day `dates` for `31.12.2026.` + 12 | R5, R9, E2 | unit | `test/calendar-url.test.js` |
| T6 `warrantyEndDate` returns `null` for `'nonsense'` and for months `0`, `121`, `'abc'`, `null` | R5 | unit | `test/calendar-url.test.js` |
| T7 `formatWarrantyDate({year:2028,month:11,day:7})` → `'7.11.2028.'`; `{2027,2,1}` → `'1.2.2027.'` | R7 | unit | `test/calendar-url.test.js` |
| T8 `buildCalendarUrl(SALE, 24)` details: `lines.at(-2) === '🛡 Гаранција до: 7.11.2028.'`, `lines.at(-1)` starts with `🔗`; removing that line gives exactly the T1 lines; the line's first code point is U+1F6E1 and the second char is a space; `text`/`dates`/`location` equal T1's | R7, R8, R13 | unit | `test/calendar-url.test.js` |
| T9 With `vatTotal: ''` the `🛡` line comes directly after `💰 Укупно` and before `🔗` | R7 | unit | `test/calendar-url.test.js` |
| T10 Refund and `АВАНС ПРОДАЈА`: `buildCalendarUrl(x, 24) === buildCalendarUrl(x)`, with no `🛡` line | R7, R8, E4 | unit | `test/calendar-url.test.js` |
| T11 `buildCalendarUrl(SALE, v)` throws `/Неисправан период гаранције/` for `0`, `-1`, `121`, `2.5`, `'abc'`, `''` | R8, E6 | unit | `test/calendar-url.test.js` |
| T12 `dateTimeStr: 'nonsense'` with months 24: both builders throw `/Датум рачуна/` | R8, R9, E3 | unit | `test/calendar-url.test.js` |
| T13 `buildWarrantyCalendarUrl(SALE, 24)`: keys in R9 order, `text` `'Гаранција истиче: KAFE PRIMER DOO'`, `dates` `'20281107/20281108'`, `ctz` `'Europe/Belgrade'`, `location` `SALE.address`, `details === buildWarrantyDescription(SALE, SALE.items.length, 24)`; no `details` line starts with `💰`, `💳` or `🧾` **(changed by the amendment)** | R9, R19 | unit | `test/calendar-url.test.js` |
| T14 `buildWarrantyCalendarUrl({...SALE, merchantName: ''}, 24)` gives the `text` `'Гаранција истиче'` | R9, E12 | unit | `test/calendar-url.test.js` |
| T15 `buildWarrantyCalendarUrl` throws `/Неисправан период гаранције/` for `null`, `undefined`, `0`, `121`, and `/само за рачун продаје/` for a refund | R9, E4 | unit | `test/calendar-url.test.js` |
| T16 150 long items (as at `:48-56`) with months 24: both URLs have length ≤ 6000, and their `details` contain `… +N`, the `🛡` line and, last, `🔗 https://suf.purs.gov.rs/`. The purchase URL also keeps `💰 Укупно: 750,00 RSD`, and its non-item lines equal `buildReceiptDescription(LONG, 0, 24)`'s. The expiry URL has no `💰` line, and its non-item lines equal `buildWarrantyDescription(LONG, 0, 24)`'s (`🛡`, `📋`, `🕐`, `🛒`, `🔗`) **(changed)** | R10, R19, E7 | unit | `test/calendar-url.test.js` |
| T17 The E11 cases. The whole suite also passes under `TZ=America/Los_Angeles` and `TZ=Pacific/Kiritimati` (Acceptance criteria) | R6, E11 | unit | `test/calendar-url.test.js` |
| T18 `isWarrantyExpired` with the four E17 instants | R11, E5, E17 | unit | `test/calendar-url.test.js` |
| T19 Exports: `WARRANTY_PRESETS` deepEqual `[6,12,24,36]`, `DEFAULT_WARRANTY_MONTHS === 24`, `MAX_WARRANTY_MONTHS === 120`; all eight functions, including `buildWarrantyDescription`, are `typeof 'function'` **(changed)** | R3, R4, R19 | unit | `test/calendar-url.test.js` |
| T21 **(new)** `buildWarrantyDescription(SALE, SALE.items.length, 24).split('\n')` `deepEqual` the 7 lines in Design. With `{...SALE, items: []}` the item line is `(no items parsed)`. With period `0` or a refund there is no `🛡` line. For SALE (which has cashier, payment, VAT and PIB) no line starts with `💳`, `💰`, `🧾`, `👤` or `PIB:`, and no line equals `SALE.merchantName` or `SALE.address`. For `LONG` and any `itemLimit` the `• `/`… +N` lines equal those of `buildReceiptDescription(LONG, itemLimit)` | R19, E14 | unit | `test/calendar-url.test.js` |
| T22 **(new)** Expiry title with em dashes: merchant `'ALFA — BETA DOO'` → `'Гаранција истиче: ALFA - BETA DOO'`, `'A—B'` → `'Гаранција истиче: A-B'`, `'X — Y — 5'` → `'Гаранција истиче: X - Y - 5'`. Each `text` has `lastIndexOf(' — ') === -1`. The purchase title is unchanged (`'ALFA — BETA DOO — 750,00 RSD'`) | R9, E14 | unit | `test/calendar-url.test.js` |
| T23 **(new)** `isWarrantyExpired` does not depend on `.format()`: with `t.mock.getter(Intl.DateTimeFormat.prototype, 'format', () => () => '11/7/2028')` (`format` is a getter on the prototype, so `mock.method` does not apply) the four E17 cases give the same results as T18, and the mock's `callCount()` is 0 | R11, E17 | unit | `test/calendar-url.test.js` |
| T24 **(new)** R8 on non-sale receipts: for `REFUND` and `OTHER` (`АВАНС ПРОДАЈА`), `buildCalendarUrl(x, v)` throws exactly `'Неисправан период гаранције: ' + v` for `v` in `0`, `-1`, `121`, `2.5`, `'abc'`, `''`, `NaN`, while `buildCalendarUrl(x, 24) === buildCalendarUrl(x)` | R8, E4, E6 | unit | `test/calendar-url.test.js` |
| T20 Byte-identity against `main`: the Acceptance criteria script compares old and new `buildCalendarUrl` for a sale, a refund, an `other` type and a 150-item receipt | R2 | integration (script) | n/a (command) |
| H1 `harness.html?scan`: `#warranty` is present, `#warranty-on` unchecked, `#warranty-options` hidden. Click `#add-calendar`: `__opened[0]` has no `🛡` and equals `buildCalendarUrl(parseReceiptHtml(...))` run in the console | R1, R2, R13 | integration (manual, harness) | `test/harness.html` |
| H2 Tick the box: the select shows `24 месеца`, `#warranty-end` reads `Гаранција до: 15.10.2028.`, and `#add-warranty` is visible. Click `#add-calendar`: the details contain `🛡 Гаранција до: 15.10.2028.` | R3, R11, R13 | integration (manual, harness) | `test/harness.html` |
| H3 Choose 6: the preview reads `15.4.2027.` and the URL carries it. Untick, then click Add: the URL equals H1's | R13, E8 | integration (manual, harness) | `test/harness.html` |
| H4 Choose `Друго…`: the input is shown, prefilled `24` and focused. Typing `0`, `2.5` or `121`, or clearing the field, shows `Унеси број месеци од 1 до 120.` and disables both buttons. Typing `18` gives `Гаранција до: 15.4.2028.` and enables them | R3, R12, E6 | integration (manual, harness) | `test/harness.html` |
| H5 Click `#add-warranty`: `__opened` gets a URL with `dates=20281015/20281016` and the title `Гаранција истиче: KAFE PRIMER DOO`. Its `details` start with `🛡 Гаранција до: 15.10.2028.`, end with the `🔗` line, and have no `💰`, `💳` or `🧾` line **(changed)**. The status line reads `Догађај за истек гаранције је отворен у новој картици.`; the page stays | R9, R14, R19 | integration (manual, harness) | `test/harness.html` |
| H6 Set a warranty, then click `#scan-tab` again: exactly one `#warranty`, unchecked, 24 selected, custom hidden | R15, E9, E10 | integration (manual, harness) | `test/harness.html` |
| H7 `harness.html?scan&refund` (the test-writer adds the switch: the portal stand-in replaces `ПРОМЕТ ПРОДАЈА` with `ПРОМЕТ РЕФУНДАЦИЈА` in the fixture HTML): no `#warranty`, and Add works as before | R1, E4 | integration (manual, harness) | `test/harness.html` |
| H8 An old receipt: in the console, `isWarrantyExpired` is true for 6 months from `15.10.2020.`. In the harness, with the fixture date edited to `15.10.2020. 10:15:30` in the console stand-in, the preview ends with ` (истекла)` and the buttons are enabled | R11, E5 | integration (manual, harness) | `test/harness.html` |
| H9 Chrome DevTools with an Android user agent at 360×740, `harness.html?tab&scan`: `body.mobile`; the checkbox row, select, input and button are each at least 44px tall; no horizontal scroll. Repeat at 340px (popup) and with `prefers-color-scheme: dark` | R16 | integration (manual, harness) | `test/harness.html` |
| H10 Real browsers (Chrome desktop popup, Firefox desktop, Firefox for Android through `web-ext run`): turn on the warranty, then click `#add-warranty`: a background tab opens with an all-day form and the popup stays open. Then `#add-calendar` opens the purchase form as today. Clicking Add first closes the popup | R14, R16, E15, E16 | integration (manual) | n/a |
| H11 On a real receipt page the floating button opens the same event as on `main`, with no warranty UI | R17 | integration (manual) | n/a |
| H12 Copy the T8 `details` and run the PWA's `eventToReceipt({description})` (`receipt/js/app.js:405`) in a browser console: the result equals the one for the T1 `details`. Run its `parseSummary` on the T22 titles: total `''` for each. Its `_matchesFilter`-style payment lookup on the H5 `details` finds no `💳` line **(changed)** | E13, E14 | integration (manual) | n/a |
| H13 **(new)** Custom field numeric value, in Chrome and Firefox, `harness.html?scan`, warranty on, `Друго…`: `24.0` → `Гаранција до: 15.10.2028.`, buttons enabled; `1e2` → `Гаранција до: 15.2.2035.` (or the error, if the browser reports no number); `+24` → `15.10.2028.` or the error, likewise (write down which); `2.5` and an empty field → the error and both buttons disabled. With `24.0`, `#add-calendar` opens a URL with `🛡 Гаранција до: 15.10.2028.` | R12, E6 | integration (manual, harness) | `test/harness.html` |
| H14 **(new)** Overlapping scans (E10). Open `harness.html?scan`, wait for the receipt, and in the console run `const f = window.fetch; let n = 0; window.fetch = (u, o) => new Promise(r => setTimeout(r, n++ === 0 ? 3000 : 0)).then(() => f(u, o)); handleImage(FIXTURE.receiptUrl); setTimeout(() => handleImage(FIXTURE.receiptUrl), 300);`. As soon as the receipt reappears (the second run), tick `#warranty-on` and choose 6. After 4 s: exactly one `#warranty`, still ticked with 6; the status line is empty (no error from the aborted first run). `#add-calendar` opens one URL, with `🛡 Гаранција до: 15.4.2027.` | E10, E9 | integration (manual, harness) | `test/harness.html` |
| H15 **(new)** Unreadable date in the popup (E3). Open plain `harness.html`. In the console run `const f = window.fetch; window.fetch = (u, o) => f(u, o).then(r => r.text()).then(t => new Response(t.replace(/(id="sdcDateTimeLabel">)[^<]*/, '$1nonsense'), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })); handleImage(FIXTURE.receiptUrl);`. The status line shows `Датум рачуна није препознат: nonsense` as an error, `#receipt` stays hidden, `document.getElementById('warranty') === null`, and `__opened` is empty | E3 | integration (manual, harness) | `test/harness.html` |
| S1 Static check: no storage APIs in `src/`, and the manifests, `src/content.js` and `src/parser.js` are unchanged against `main` (Acceptance criteria) | R15, R17 | integration (script) | n/a (command) |
| S2 Docs check: `grep` for the texts in Design in each of the files listed under R18; the "stores nothing" statements are still present | R18 | integration (script) | n/a (command) |

## Implementation steps
1. **Constants and `normalizeWarrantyMonths`** in `src/calendar-url.js`, with exports. Verify:
   `node -e "Object.assign(globalThis, require('./src/parser.js')); const c=require('./src/calendar-url.js'); console.log(c.normalizeWarrantyMonths(' 24 '), c.normalizeWarrantyMonths('1e2'))"`
   prints `24 null`.
2. **`warrantyEndDate`, `formatWarrantyDate`, `isWarrantyExpired`.** Verify in the same way:
   `formatWarrantyDate(warrantyEndDate('31.8.2027. 10:00:00', 6))` prints `29.2.2028.`.
3. **Extract `fitCalendarUrl(make, itemCount)`** from `buildCalendarUrl` without changing behaviour. Verify:
   `node --test test/*.test.js` still passes all 17 existing tests.
4. **Add the third parameter to `buildReceiptDescription` and the second to `buildCalendarUrl`** (the R7 line and
   the R8 validation). Verify: the existing tests pass, and the T20 byte-identity script prints `identical`.
5. **Add `buildWarrantyCalendarUrl`.** Verify: for `SALE` + 24 it prints `dates` `20281107/20281108`.
6. **Run the test-writer's tests** (T1-T19): `node --test test/*.test.js`, then the same under both `TZ` values.
   All pass.
7. **Add `renderWarranty()` to `src/popup.js` and change `showReceipt()`.** Verify: H1-H6 in the harness.
8. **Add the warranty section to `src/popup.css`.** Verify: H9.
9. **Update the docs** (README, privacy page and text, landing page, both store descriptions). Verify: S2.
10. **Run `python3 scripts/build.py`.** It finishes without "Build failed". Run H10 and H11 with
    `dist/firefox/` and the unpacked repo.

### Amendment steps (after review, on top of `fd5de43`)
11. **`isWarrantyExpired`**: switch to `formatToParts` as in Design. Verify: T18 and T23 pass, and
    `grep -n "en-CA\|\.format(" src/calendar-url.js` prints nothing.
12. **Extract `itemLinesText`** and add `buildWarrantyDescription` (R19). Verify: T1 and T20 still pass
    (purchase output unchanged), and T21 passes.
13. **`buildWarrantyCalendarUrl`**: use `buildWarrantyDescription` and the em-dash replacement in the title.
    Export `buildWarrantyDescription`. Verify: T13, T16, T19 and T22 pass.
14. **Popup `months()`**: read `custom.valueAsNumber` as in Design. Verify: H4 and H13.
15. **Tests (test-writer)**: update T13, T16 and T19, and add T21-T24 in `test/calendar-url.test.js`. Verify:
    `node --test test/*.test.js` passes, as do both `TZ` runs. Then run H5 and H12-H15.
16. **README**: replace the Limitations bullet with the new text in Design. Verify: S2.

## Acceptance criteria
Run from the repository root:
```bash
node --test test/*.test.js                               # all pass, 0 fail
TZ=America/Los_Angeles node --test test/*.test.js        # all pass
TZ=Pacific/Kiritimati  node --test test/*.test.js        # all pass

# T20 / R2: byte-identical to main without a warranty
D=$(mktemp -d) && git show main:src/calendar-url.js > "$D/cal-main.js" && node -e '
Object.assign(globalThis, require("./src/parser.js"));
const before = require(process.argv[1]), after = require("./src/calendar-url.js");
const SALE = { merchantName: "KAFE PRIMER DOO", address: "ПРИМЕРНА 1, Београд", pib: "100000008",
  receiptNumber: "X-1", dateTimeStr: "7.11.2026. 13:25:06", cashier: "Ana", transactionType: "ПРОМЕТ ПРОДАЈА",
  paymentMethod: "Готовина", total: "750,00", vatTotal: "125,00", sourceUrl: "https://suf.purs.gov.rs/v/?vl=" + "A".repeat(760),
  items: [{ name: "Espresso", qty: "1", total: "220,00" }] };
const long = { ...SALE, items: Array.from({ length: 150 }, (_, i) => ({ name: "Артикал са дугим називом " + i, qty: "1", total: "100,00" })) };
const cases = [SALE, { ...SALE, transactionType: "ПРОМЕТ РЕФУНДАЦИЈА" }, { ...SALE, transactionType: "АВАНС ПРОДАЈА" }, long];
const ok = cases.every(r => before.buildCalendarUrl(r) === after.buildCalendarUrl(r) && after.buildCalendarUrl(r) === after.buildCalendarUrl(r, null));
console.log(ok ? "identical" : "DIFFERENT"); process.exit(ok ? 0 : 1);
' "$D/cal-main.js"                                        # prints: identical

# S1 / R15, R17: nothing stored, no new permissions, shared files untouched
grep -nE "localStorage|sessionStorage|indexedDB|chrome\.storage|browser\.storage|document\.cookie" src/*.js   # no output
git diff --exit-code main -- manifest.json manifest.firefox.json src/content.js src/parser.js            # no output, exit 0

# S2 / R18: docs mention the feature; the privacy promise is kept
grep -c "Гаранција" README.md store/chrome/fields/store-listing-description.txt store/firefox/fields/description.txt   # each ≥ 1
grep -ci "warranty" docs/privacy.html store/firefox/fields/privacy-policy.txt docs/index.html                          # each ≥ 1
grep -c "stores nothing" docs/privacy.html store/firefox/fields/privacy-policy.txt                                     # each ≥ 1

# R11 / T23: today's Belgrade date comes from formatToParts, not from a formatted string
grep -nE "en-CA|\.format\(" src/calendar-url.js                # no output

python3 scripts/build.py                                 # ends without "Build failed"
```
Manual: H1-H15 behave as described in the Test plan.

## Assumptions
- **A1. End date.** The end date is the same day-of-month N months later (`7.11.2026.` + 24 → `7.11.2028.`), as in
  the user's example. It is not "the day before".
- **A2. Date format.** Dates are written `D.M.YYYY.` without zero padding, matching the receipt style and the
  user's example.
- **A3. Emoji.** `🛡` is U+1F6E1 without U+FE0F, as typed in the user's example. The other marks in the module have
  no variation selector either.
- **A4. Line position.** The `🛡` line goes immediately before `🔗`. The `🔗` line stays last (an existing test
  checks this), and the PWA's address and item scans end before this point.
- **A5. PWA risk.** The PWA's tolerance of the new line was checked by reading the local clone
  (`receipt` @ `fb02811`), not the deployed app. It stays a risk (E13).
- **A6. Warranty event title.** The title is `Гаранција истиче: <merchant>` (with a colon) instead of the user's
  example `Гаранција истиче — <merchant>`, and every em dash (U+2014) in the merchant name becomes `-`. The PWA
  reads the text after the last `' — '` as the amount. Only U+2014 is replaced, because that is the only dash
  the PWA splits on; en dashes and hyphens stay.
- **A7. Warranty event description (amended).** It keeps what a warranty claim needs: the end date (`🛡`), the
  receipt number (`📋`), the purchase date and time (`🕐`), the items (what was bought) and the receipt link
  (`🔗`). The following are dropped:
  - `💰` and `💳`, as the review asked;
  - `🧾` VAT, which says nothing about the warranty and is a money line;
  - the merchant (already in the title), the address (already in `location`), PIB and cashier.
  
  The `🛡` line comes first because it is the point of the event.
- **A8. Background tab.** "Додај датум истека гаранције" opens its form in a background tab (`active: false`) and
  does not close the popup, because the desktop popup closes as soon as a new tab takes focus. This assumes
  Firefox for Android honours `active: false`, or at least keeps the popup page on top (H10 checks this).
- **A9. Block position.** The warranty block sits above "Додај у календар", so that the period is set before the
  click and the warranty button comes first.
- **A10. Cap.** The custom period is capped at 120 months, as the analyst suggested. The user did not give a
  limit.
- **A11. "Друго…".** It is prefilled with the preset selected just before (24 at first), so the form never starts
  invalid.
- **A12. "(истекла)" marker.** It is shown only in the popup preview. The event text stays in its fixed format.
- **A13. Non-sale receipts.** A warranty passed to `buildCalendarUrl` for a non-sale receipt is ignored, not an
  error. The UI never passes one, and ignoring it keeps `buildCalendarUrl` safe for other callers.
  `buildWarrantyCalendarUrl` does throw, because a non-sale expiry event would be meaningless.
- **A14. UI tests.** UI behaviour is checked manually with the existing harness. The repo has no browser test
  runner or `package.json`, and adding one is out of scope.
- **A16. PWA counting.** Dropping lines does not stop the PWA counting the expiry event. Its report counts every
  event in the Receipts calendar and takes the amount from the title (`receipt/js/report.js:48-90`, read at
  `fb02811`). The amendment therefore limits the effect (0 RSD, unknown payment) instead of removing it. The real
  mitigation is the README advice, or a PWA change (Open question 7).
- **A17. Custom field reading.** `valueAsNumber` follows each browser's number parsing. For `+24` and `1e2` the
  result may differ between browsers (H13 records it). Both cases are safe: either a correct whole number of
  months, or the error.
- **A15. Release.** No version bump in `manifest.json` and no regenerated screenshots. The store screenshots will
  show the new warranty row only after the next `scripts/screenshots.sh` run, at release time.

## Open questions
None blocks implementation; each has a recommended default that the spec already uses.
1. ~~Warranty event title~~: resolved by the review. The title is `Гаранција истиче: <merchant>`, and em dashes in
   the merchant name become `-` (R9, A6).
2. **Receipt-page button.** Should the floating button on `suf.purs.gov.rs` also offer the warranty? Recommended:
   not now (non-goal); the toolbar popup covers that page.
3. **Cap.** Is 120 months acceptable as the maximum custom period (A10)?
4. ~~Warranty event description~~: resolved by the review. It is the shorter R19 format, without `💰`, `💳` or
   `🧾` (A7).
5. **Second button.** Is "opens in a background tab and keeps the popup open" (A8) the behaviour you want? The
   alternative is a foreground tab, which on desktop closes the popup, so the purchase event would have to be
   added first.
6. **Release.** Should the version bump to 1.1.0 and the store screenshots be regenerated as part of this
   branch, or at release time (A15)?
7. **PWA counting (E14, A16).** An expiry event saved in the PWA's Receipts calendar still counts as one receipt
   (0 RSD, unknown payment) in its monthly count and average. Is the README advice enough? The alternative is a
   change in the Receipt Scanner repo, for example skipping events whose title starts with `Гаранција истиче`.
   Recommended: the README advice now, and the PWA change as a separate issue there.
