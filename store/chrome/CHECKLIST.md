# Publishing checklist – Chrome Web Store

What's prepared in this repo, and the steps only you can do (account, submit).

## Prepared

- [x] Package: `python3 scripts/build.py` → `dist/fiskalnik-chrome-<version>.zip` (checks that every file the
      manifest and `popup.html` use is inside)
- [x] Listing texts, one file per field: `store/chrome/fields/`; what goes where: `store/chrome/listing.md`
- [x] Privacy policy page: `docs/privacy.html` (→ https://constantine2nd.github.io/fiskalnik/privacy.html
      once GitHub Pages is on), landing page `docs/index.html`
- [x] Images: `icons/icon128.png`, `store/chrome/screenshots/1-scan.png`, `2-receipt.png`, `3-event.png` (1280×800),
      `store/chrome/promo-440x280.png`; re-render with `scripts/screenshots.sh`

## Before submitting

- [x] **Repository on GitHub**: `constantine2nd/fiskalnik`, public (the listing, the privacy policy and the
      landing page all link to it)
- [x] **GitHub Pages on** (`main` / `docs`); the privacy URL above loads
- [ ] **A receipt link for the reviewer**: put a real `https://suf.purs.gov.rs/v/?vl=…` link into
      `store/chrome/fields/test-instructions.txt` in place of `<PASTE A RECEIPT LINK…>`. Pick a receipt you don't mind a
      stranger seeing; paste the text into the store form only if you'd rather not commit the link.
- [ ] **Test the package itself**: unzip `dist/fiskalnik-chrome-…zip` into an empty folder → `chrome://extensions` → Load unpacked →
      add a receipt from its page, and one from a QR code
- [ ] Version in `manifest.json` is the one you want (now `1.0.0`; every later upload needs a higher number)

## In the Chrome Web Store

1. [ ] Developer account: https://chrome.google.com/webstore/devconsole (the same account that publishes
       Resume Maker for LinkedIn; the US$5 fee is already paid there).
2. [ ] **New item** → upload `dist/fiskalnik-chrome-1.0.0.zip`.
3. [ ] **Store listing** tab: description, category, language, icon, screenshots, promo tile, homepage and support
       URLs – see `store/chrome/listing.md` (texts in `store/chrome/fields/`).
4. [ ] **Privacy** tab: single purpose, permission justifications, "no remote code", data-usage ticks and the three
       certifications, privacy policy URL – see `store/chrome/listing.md` (texts in `store/chrome/fields/`).
5. [ ] **Distribution** tab: Public (or Unlisted first), regions, free.
6. [ ] **Test instructions**: paste `store/chrome/fields/test-instructions.txt` (with the receipt link).
7. [ ] **Submit for review.** Usually a few days; you get an email. If it's rejected, the email names the policy –
       the usual fixes are listing wording or a permission justification.
8. [ ] After approval: put the store link on `docs/index.html` (the *Install* button) and in `README.md`.

## Later updates

1. Raise `version` in `manifest.json` (e.g. `1.0.1`).
2. `python3 scripts/build.py` → upload the new Chrome zip under *Package* → submit. Installed copies update automatically.
