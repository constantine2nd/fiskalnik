---
name: demo-video
description: Make the Fiskalnik demo video (about 50 s, 1920x1080, Serbian narration) from one real receipt link - downloads the receipt, takes stills with the extension's own code, voices the script with the serbian-voice skill, and renders animated scenes cut to the narration. Use when the user wants a demo, promo or store video of the add-on, or wants the existing one redone after the interface, the script or the receipt changed.
---

# Fiskalnik demo video

Six scenes, one narration segment each: hook → title → from the receipt page → from a QR code on screen →
from a paper receipt on the phone → a calendar week and the closing card.

The film is animated, not screen-recorded. The receipt page and the popups are real captures (the extension's
code, the given receipt); the browser frame, the e-mail page, the camera view, the phone frame, the event card
and the calendar week are drawn in `film.html`. Say so when you present the result.

## Rules

- **The receipt link never enters the repository.** Everything about one video lives in a work folder outside
  the repo (default `~/Videos/fiskalnik-demo`); `build.sh` refuses a folder inside it.
- **The cashier's name is blurred** in every picture and left out of the event card. Keep it that way. The QR
  code stays readable (the scan scenes need it), so tell the user that viewers can open the receipt.
- Ask for the receipt link if the user gave none. Don't reuse one from an earlier video without asking.

## Steps

```
B=.claude/skills/demo-video/build.sh      # from the repository root
W=~/Videos/fiskalnik-demo                 # the work folder
```

1. **Prepare**: `$B prepare $W '<receipt link>'`. Downloads the receipt page, fonts and the browser driver,
   takes the stills into `$W/assets`, and copies `script.json`, `texts.json` and `lexicon.json` into `$W`
   (only if they are not there yet: those copies belong to this video). It prints the event the extension
   would create. Look at `assets/portal.png`, `popup-b.png` and `mobile-b.png` before going on.

2. **Fit the words to the receipt.** In `$W/script.json` (narration) and `$W/texts.json` (words on screen) the
   hook asks about fuel; change both when the receipt is for something else. Keep the six segment ids, one
   per scene. Check the closing line against where the add-on is really available (Firefox only at the
   time of writing; ask about Chrome). Show the user the script and wait for their agreement.

3. **Voice it** with the serbian-voice skill (read it first; Gemini has a daily limit and `segments` costs
   one request):
   ```
   S=~/.claude/skills/serbian-voice/serbian_voice.py
   $S segments --in $W/script.json --out-dir $W/voice --voice Leda --style objasnjenje --lexicon $W/lexicon.json
   $S verify   --in $W/script.json --out-dir $W/voice
   ```
   Leda is the voice the user chose for the first video; ask before changing it. Every segment must verify.

4. **Check frames**: `$B stills $W 3,18.5,22,31,36.8,43.5,51` writes `$W/out/still-<t>.png`. Look at them:
   a long merchant name or a long receipt can overflow the event card, the week or the popup.

5. **Render**: `$B render $W` → `$W/out/fiskalnik-demo.mp4`. Takes about two minutes. Then tell the user
   what you did and did not check: stills are checked by you, the sound and its timing only by them.

## How it fits together

| File | What it does |
|---|---|
| `build.sh` | the three commands; computes scene lengths from the narration (`voice/durations.json`) and mixes the sound |
| `capture.js` | stills: the real receipt page with the content script, the popup before and after a scan, desktop and phone |
| `harness.html` | the real `popup.html` with stand-ins for `chrome.*` and the portal, fed with the downloaded receipt |
| `film.html` | all six scenes; a pure function of time (`window.seek(t)`), so every frame is exact |
| `render.js` | steps `film.html` frame by frame (30 fps) into ffmpeg |
| `script.json`, `texts.json`, `lexicon.json` | default narration, on-screen words, pronunciations (QR, Firefox) |

Scene lengths are the narration plus a pause, never shorter than the scene's animation (`PAD` and `MIN` in
`build.sh`). Each scene's animation in `film.html` is timed from that scene's start, so a longer narration
only makes the scene hold longer. To change what a scene shows, edit `film.html` and use `stills` to look.

When the interface of the popup or the content script changes, run `prepare` again: the stills are taken
from the current code. Cursor targets in `film.html` (`C3`, `ICON`, `SCAN`, `ADD`, the phone's `finger`) are
fixed positions and need moving if a button moves.

## Needs

`node`, `python3`, `ffmpeg`, `curl`; a headless Chromium from Playwright
(`npx playwright install chromium-headless-shell`); the serbian-voice skill. Port 8791 free.
