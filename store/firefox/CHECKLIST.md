# Publishing checklist – addons.mozilla.org (Firefox, desktop and Android)

What's prepared in this repo, and the steps only you can do (testing in Firefox, account, submit).

## Prepared

- [x] Package: `python3 scripts/build.py` → `dist/fiskalnik-firefox-<version>.zip` and `dist/firefox/` (unpacked)
- [x] Firefox manifest differences: `manifest.firefox.json` (add-on ID, minimum versions, data collection)
- [x] Listing texts: `store/firefox/fields/`; what goes where: `store/firefox/listing.md`
- [x] Privacy policy text (`fields/privacy-policy.txt`) and page (`docs/privacy.html`)
- [x] Screenshots: the Chrome ones, `store/chrome/screenshots/`

## Test first (not done yet: the Firefox build has not been run in Firefox)

- [ ] **Lint**: `npx web-ext lint -s dist/firefox` → no errors
- [ ] **Desktop Firefox**: `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* → `dist/firefox/manifest.json`.
      Open a receipt page: the "Додај у календар" button appears and opens the calendar form. Toolbar button →
      scan the QR on the tab, paste an image, choose an image.
      If the button does not appear on the receipt page: `about:addons` → Fiskalnik → *Permissions* → allow
      `suf.purs.gov.rs`.
- [ ] **Firefox for Android** (phone with USB debugging on, *Remote debugging via USB* on in Firefox settings):
      `npx web-ext run -t firefox-android -s dist/firefox --adb-device <id from "adb devices">`
      Check, in this order:
      1. the calendar link: does "Додај у календар" open a filled-in event (in the Calendar app or on the web)?
         Everything else depends on this.
      2. the button on a receipt page
      3. the extension page (⋮ → Extensions → Fiskalnik): *Изабери слику…* with the camera and with a saved photo
      4. whether *Скенирај QR на овој картици* is shown and works; it hides itself if Firefox can't take the picture
- [ ] **A receipt link for the reviewer** in `store/firefox/fields/notes-to-reviewer.txt`

## On addons.mozilla.org

1. [ ] Developer account: https://addons.mozilla.org/developers/ → sign in with a Mozilla account (free).
2. [ ] **Submit a New Add-on** → *On this site* → upload `dist/fiskalnik-firefox-1.0.0.zip` → tick Firefox and
       Firefox for Android.
3. [ ] Listing fields, privacy policy and reviewer notes: see `store/firefox/listing.md`.
4. [ ] Submit. The automatic check is immediate; a human review can follow later.
5. [ ] After it is listed: add the link to `docs/index.html` and `README.md`.

## Later updates

1. Raise `version` in `manifest.json` (both browsers share it).
2. `python3 scripts/build.py` → upload the new Firefox zip under *Upload New Version*.
