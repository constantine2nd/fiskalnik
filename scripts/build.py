#!/usr/bin/env python3
"""Build the store upload packages:  python3 scripts/build.py

  dist/fiskalnik-chrome-<version>.zip    Chrome Web Store
  dist/fiskalnik-firefox-<version>.zip   addons.mozilla.org (desktop and Android)
  dist/firefox/                          the Firefox package unpacked, for about:debugging and web-ext

Both packages hold the same files; only manifest.json differs. The Firefox manifest is manifest.json with
manifest.firefox.json merged over it (objects are merged key by key, everything else is replaced).
Packs only what the extension needs at runtime (no tests, docs, store assets, SVG sources or .git) and checks that
every file the manifest and popup.html refer to is in the package. Run from anywhere; paths are relative to the repo.
"""
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
RUNTIME = ['popup.html', 'LICENSE', 'src/*.js', 'src/*.css', 'icons/*.png', 'vendor/*']  # plus manifest.json


def merged(base, overlay):
    """base with overlay applied: dicts are merged recursively, any other value is replaced."""
    out = dict(base)
    for key, value in overlay.items():
        out[key] = merged(out[key], value) if isinstance(value, dict) and isinstance(out.get(key), dict) else value
    return out


def referenced_files(manifest):
    """Every file path the manifest and popup.html point to."""
    refs = set(manifest.get('icons', {}).values())
    refs |= set(manifest.get('action', {}).get('default_icon', {}).values())
    if 'default_popup' in manifest.get('action', {}):
        refs.add(manifest['action']['default_popup'])
    if 'background' in manifest:
        refs.add(manifest['background']['service_worker'])
    for cs in manifest.get('content_scripts', []):
        refs |= set(cs.get('js', [])) | set(cs.get('css', []))
    for war in manifest.get('web_accessible_resources', []):
        refs |= set(war.get('resources', []))
    html = (ROOT / 'popup.html').read_text(encoding='utf-8')
    refs |= set(re.findall(r'(?:src|href)="([^"#:]+)"', html))
    return refs


def main():
    chrome = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
    firefox = merged(chrome, json.loads((ROOT / 'manifest.firefox.json').read_text(encoding='utf-8')))
    files = sorted({p.relative_to(ROOT).as_posix() for pattern in RUNTIME for p in ROOT.glob(pattern) if p.is_file()})

    problems = [f'referenced but missing from the package: {r}' for r in sorted(referenced_files(chrome)) if r not in files]
    if len(chrome.get('description', '')) > 132:
        problems.append('manifest description is longer than 132 characters')
    if len(chrome.get('name', '')) > 75:
        problems.append('manifest name is longer than 75 characters')
    if problems:
        sys.exit('Build failed:\n  ' + '\n  '.join(problems))

    DIST.mkdir(exist_ok=True)
    for browser, manifest in (('chrome', chrome), ('firefox', firefox)):
        manifest_text = json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'
        out = DIST / f"fiskalnik-{browser}-{manifest['version']}.zip"
        with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr('manifest.json', manifest_text)
            for f in files:
                z.write(ROOT / f, f)
        print(f"{out.relative_to(ROOT)}  ({out.stat().st_size // 1024} KB, {len(files) + 1} files)")

        if browser == 'firefox':
            unpacked = DIST / 'firefox'
            shutil.rmtree(unpacked, ignore_errors=True)
            with zipfile.ZipFile(out) as z:
                z.extractall(unpacked)
            print(f"{unpacked.relative_to(ROOT)}/  (the same, unpacked)")

    for f in ['manifest.json'] + files:
        print('  ' + f)


if __name__ == '__main__':
    main()
