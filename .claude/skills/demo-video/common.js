// Shared by capture.js and render.js: paths from the environment that build.sh sets, and the browser.
const fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('playwright-core');
const REPO = process.env.REPO, WORK = process.env.WORK, BASE = process.env.BASE;
function browserPath() {
  const root = path.join(os.homedir(), '.cache/ms-playwright');
  const dirs = fs.existsSync(root) ? fs.readdirSync(root).filter(d => d.startsWith('chromium_headless_shell-')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })) : [];
  if (!dirs.length) throw new Error('No headless Chromium found. Install one: npx playwright install chromium-headless-shell');
  return path.join(root, dirs.pop(), 'chrome-headless-shell-linux64/chrome-headless-shell');
}
module.exports = { fs, path, REPO, WORK, BASE, launch: () => chromium.launch({ executablePath: browserPath() }) };
