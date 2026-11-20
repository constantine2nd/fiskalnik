# addons.mozilla.org listing – Fiskalnik

Each text field has its own file in [`fields/`](fields/): open it, select all, copy, paste. Choices that are not
text are listed here. One listing covers Firefox for desktop and Firefox for Android.

## Upload

| Step | Choose |
|---|---|
| Distribution | **On this site** (listed on addons.mozilla.org) |
| File | `dist/fiskalnik-firefox-<version>.zip` |
| Compatibility | tick **Firefox** and **Firefox for Android** |
| Source code | **No**, you do not need to submit source: nothing of ours is minified or generated. The vendored library is explained in the reviewer notes. |

## Describe your add-on

| Field | Paste / choose |
|---|---|
| Name | Fiskalnik (from the manifest) |
| Summary (max 250) | [`fields/summary.txt`](fields/summary.txt) |
| Description | [`fields/description.txt`](fields/description.txt) (Serbian, then English; the same text as the Chrome listing) |
| Categories | Firefox: *Other* (or *Shopping*); Android: *Other* |
| Support website | [`fields/support-url.txt`](fields/support-url.txt) |
| Homepage | [`fields/homepage-url.txt`](fields/homepage-url.txt) |
| License | MIT License |
| Privacy policy | tick "This add-on has a privacy policy" and paste [`fields/privacy-policy.txt`](fields/privacy-policy.txt) (this store wants the text, not a link) |
| Notes to reviewer | [`fields/notes-to-reviewer.txt`](fields/notes-to-reviewer.txt) — **put a real receipt link in it first** |
| Icon | taken from the package (`icons/icon128.png`) |
| Screenshots | `store/chrome/screenshots/1-scan.png`, `2-receipt.png`, `3-event.png` (the same images) |

## Data collection

Declared in the package, not in a form: `manifest.firefox.json` →
`browser_specific_settings.gecko.data_collection_permissions.required` = `websiteContent`, `financialAndPaymentInfo`.
Firefox shows these to the user at install. Why those two: the receipt is a record of a purchase read from a web
page, and it is passed to Google Calendar when the user clicks the button. This is our reading of Mozilla's rule
(data that leaves the browser counts, whoever receives it), not something a reviewer has confirmed; if they say
`none` is right because nothing reaches the developer, change it there and raise the version.

## Versions

The add-on needs Firefox 140 on desktop and 142 on Android (`strict_min_version` in `manifest.firefox.json`),
the first versions that understand the data-collection declaration.
