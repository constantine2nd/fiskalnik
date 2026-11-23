#!/usr/bin/env bash
# Fiskalnik demo video. Everything about one video lives in a work folder OUTSIDE the repository
# (it holds a real receipt link):
#
#   build.sh prepare <work> <receipt-url>   download the receipt, take the stills, copy script.json and texts.json
#   build.sh stills  <work> 3,18.5,51       single frames → <work>/out/still-<t>.png (needs the narration, for timing)
#   build.sh render  <work>                 frames + narration → <work>/out/fiskalnik-demo.mp4
#
# Between prepare and render the narration is voiced into <work>/voice (see SKILL.md).
set -euo pipefail
SKILL="$(cd "$(dirname "$0")" && pwd)"
export REPO="$(cd "$SKILL/../../.." && pwd)"
CMD="${1:?prepare | stills | render}"; WORK="${2:?work folder}"
mkdir -p "$WORK"; export WORK="$(cd "$WORK" && pwd)"
case "$WORK/" in "$REPO"/*) echo "The work folder must be outside the repository: it holds the receipt link." >&2; exit 1;; esac
PORT=8791; export BASE="http://127.0.0.1:$PORT"
export NODE_PATH="$WORK/node_modules"
VOICE_LEAD=0.45   # the narration of a scene starts this long after the scene

serve() {
  python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$WORK/www" >/dev/null 2>&1 &
  SERVER=$!; trap 'kill $SERVER 2>/dev/null || true' EXIT
  for _ in $(seq 20); do curl -s -o /dev/null "$BASE/" && return; sleep .2; done
  echo "The local server did not start on port $PORT." >&2; exit 1
}

# Scene lengths: the narration plus room for the picture to finish, never shorter than the scene's animation.
timing() {
  python3 - "$WORK" "$VOICE_LEAD" <<'PY'
import json, sys
from pathlib import Path
work, lead = Path(sys.argv[1]), float(sys.argv[2])
ids = [s['id'] for s in json.loads((work / 'script.json').read_text(encoding='utf-8'))]
dur_file = work / 'voice/durations.json'
if not dur_file.exists(): sys.exit(f'No narration yet: {dur_file} is missing (see SKILL.md, step 3).')
dur = json.loads(dur_file.read_text())
if len(ids) != 6: sys.exit('script.json must keep its six segments, one per scene.')
missing = [i for i in ids if i not in dur]
if missing: sys.exit('Narration missing for: ' + ', '.join(missing))
PAD = [0.95, 0.85, 1.15, 2.1, 2.9, 1.95]      # after the voice ends
MIN = [8.0, 5.5, 11.5, 9.0, 6.5, 12.0]        # what each scene's animation needs
t, timing, delays = 0.0, {}, []
for n, i in enumerate(ids):
    timing[f's{n + 1}'] = round(t, 2); delays.append(round((t + lead) * 1000))
    t += max(MIN[n], round(dur[i] + PAD[n], 1))
timing['end'] = round(t, 2)
(work / 'www/v/timing.json').write_text(json.dumps(timing))
(work / 'out').mkdir(exist_ok=True)
(work / 'out/delays.txt').write_text(' '.join(map(str, delays)) + f"\n{timing['end']}\n")
(work / 'out/ids.txt').write_text(' '.join(ids) + '\n')
print('scenes start at', timing)
PY
}

case "$CMD" in
prepare)
  URL="${3:?receipt link (https://suf.purs.gov.rs/v/?vl=...)}"
  mkdir -p "$WORK/www/v/fonts" "$WORK/assets" "$WORK/voice" "$WORK/out"
  printf '%s\n' "$URL" > "$WORK/receipt-url.txt"
  for f in src vendor icons popup.html; do ln -sfn "$REPO/$f" "$WORK/www/$f"; done
  ln -sfn "$WORK/assets" "$WORK/www/assets"
  for f in film.html harness.html; do ln -sfn "$SKILL/$f" "$WORK/www/v/$f"; done
  for f in script.json texts.json lexicon.json; do [[ -f "$WORK/$f" ]] || cp "$SKILL/$f" "$WORK/$f"; done   # per-video copies, yours to edit
  ln -sfn "$WORK/texts.json" "$WORK/www/v/texts.json"
  cp "$WORK/receipt-url.txt" "$WORK/www/v/receipt-url.txt"
  curl -sS --fail -m 30 -o "$WORK/www/v/receipt.html" "$URL"
  grep -q '<pre' "$WORK/www/v/receipt.html" || { echo "The portal's answer has no receipt journal; is the link right?" >&2; exit 1; }

  # Roboto and Roboto Mono with Cyrillic, so the film does not depend on this machine's fonts
  if [[ ! -s "$WORK/www/v/fonts.css" ]]; then
    curl -sS --fail -m 30 -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36" \
      "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400&display=block" -o "$WORK/www/v/fonts/g.css"
    python3 - "$WORK/www/v" <<'PY'
import re, sys, urllib.request
from pathlib import Path
v = Path(sys.argv[1]); out = []
for subset, block in re.findall(r'/\* ([\w-]+) \*/\s*(@font-face \{.*?\})', (v / 'fonts/g.css').read_text(), re.S):
    if subset not in ('cyrillic', 'latin', 'latin-ext'): continue
    url = re.search(r'url\((https://[^)]+)\)', block).group(1)
    name = re.search(r"font-family: '([^']+)'", block).group(1).replace(' ', '') + '-' + re.search(r'font-weight: (\d+)', block).group(1) + f'-{subset}.woff2'
    urllib.request.urlretrieve(url, v / 'fonts' / name)
    out.append(block.replace(url, 'fonts/' + name))
(v / 'fonts.css').write_text('\n'.join(out))
PY
  fi
  [[ -d "$WORK/node_modules/playwright-core" ]] || (cd "$WORK" && npm init -y >/dev/null && npm i --silent playwright-core)
  serve
  node "$SKILL/capture.js"
  echo "Stills in $WORK/assets. Next: check script.json and texts.json in $WORK, then voice the narration."
  ;;
stills)
  timing; serve
  node "$SKILL/render.js" stills "${3:?times in seconds, comma separated}"
  ;;
render)
  timing; serve
  node "$SKILL/render.js" film
  read -r -a DELAYS < <(sed -n 1p "$WORK/out/delays.txt"); END=$(sed -n 2p "$WORK/out/delays.txt"); read -r -a IDS < "$WORK/out/ids.txt"
  INPUTS=(); FILTER=""; MIX=""
  for n in "${!IDS[@]}"; do
    INPUTS+=(-i "$WORK/voice/${IDS[$n]}.wav"); FILTER+="[$n]adelay=${DELAYS[$n]}:all=1[a$n];"; MIX+="[a$n]"
  done
  ffmpeg -y -loglevel error "${INPUTS[@]}" \
    -filter_complex "${FILTER}${MIX}amix=inputs=${#IDS[@]}:normalize=0,apad=whole_dur=$END,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]" \
    -map "[a]" -t "$END" "$WORK/out/voice.wav"
  ffmpeg -y -loglevel error -i "$WORK/out/video.mp4" -i "$WORK/out/voice.wav" -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$WORK/out/fiskalnik-demo.mp4"
  ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$WORK/out/fiskalnik-demo.mp4"
  echo "$WORK/out/fiskalnik-demo.mp4"
  ;;
*) echo "Unknown command: $CMD (prepare | stills | render)" >&2; exit 1;;
esac
