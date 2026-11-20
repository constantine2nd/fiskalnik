#!/usr/bin/env bash
# Render the Chrome Web Store images with headless Chromium:
#   store/chrome/screenshots/1-scan.png, 2-receipt.png, 3-event.png  (1280×800, from store/chrome/shot.html: the real popup with the made-up receipt)
#   store/chrome/promo-440x280.png                                    (small promo tile, from store/chrome/promo.html)
#   docs/og-image.png                                          (1200×627 link-preview card, from store/chrome/og.html)
#   docs/receipt.png                                           (copy of 2-receipt.png for the landing page)
# Usage: scripts/screenshots.sh [path-to-chrome]   (default: Playwright's chrome-headless-shell, then google-chrome/chromium)
set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="${1:-}"
if [[ -z "$CHROME" ]]; then
  # Playwright's headless shell is made for screenshots; full Chromium in --headless mode can hang here
  CHROME=$(ls -d "$HOME"/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell 2>/dev/null | sort -V | tail -1 || true)
  [[ -z "$CHROME" ]] && CHROME=$(command -v google-chrome || command -v chromium || true)
fi
[[ -x "$CHROME" ]] || { echo "No Chrome found; pass its path as the first argument." >&2; exit 1; }

PORT=8767
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
PROFILE=$(mktemp -d)
trap 'kill $SERVER 2>/dev/null; rm -rf "$PROFILE"' EXIT
sleep 1

shot() { # shot <output.png> <width> <height> <url>
  timeout -k 2 30 "$CHROME" --headless --no-sandbox --hide-scrollbars --no-first-run --user-data-dir="$PROFILE" \
    --window-size="$2,$3" --virtual-time-budget=8000 --screenshot="$1" "$4" >/dev/null 2>&1 \
    || { echo "screenshot failed or timed out: $1" >&2; return 1; }
  echo "$1"
}

mkdir -p store/chrome/screenshots
shot store/chrome/screenshots/1-scan.png    1280 800 "http://127.0.0.1:$PORT/store/chrome/shot.html?n=1"
shot store/chrome/screenshots/2-receipt.png 1280 800 "http://127.0.0.1:$PORT/store/chrome/shot.html?n=2"
shot store/chrome/screenshots/3-event.png   1280 800 "http://127.0.0.1:$PORT/store/chrome/shot.html?n=3"
shot store/chrome/promo-440x280.png         440  280 "http://127.0.0.1:$PORT/store/chrome/promo.html"
shot docs/og-image.png               1200 627 "http://127.0.0.1:$PORT/store/chrome/og.html"
cp store/chrome/screenshots/2-receipt.png docs/receipt.png && echo docs/receipt.png
