// Takes the stills the film is made of, with the extension's own code and the given receipt:
//   assets/portal.png              the real receipt page with the "Додај у календар" button (content script)
//   assets/popup-a.png, popup-b.png    the toolbar popup before and after "scan this tab"
//   assets/mobile-a.png, mobile-b.png  the same on a phone (Firefox for Android)
//   assets/event.json              what "Додај у календар" hands to Google Calendar
// The cashier's name is blurred in every picture.
const { fs, REPO: R, WORK, BASE, launch } = require('./common.js');
process.chdir(WORK);
const blurCashier = () => {
  for (const pre of document.querySelectorAll('pre')) {
    const w = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      const i = n.data.indexOf('Касир:'); if (i < 0) continue;
      const rest = n.data.slice(i + 6); const lead = rest.match(/^\s*/)[0].length;
      const eol = rest.search(/\n|$/);
      const r = document.createRange(); r.setStart(n, i + 6 + lead); r.setEnd(n, i + 6 + eol);
      const s = document.createElement('span'); s.style.filter = 'blur(5px)'; s.style.display = 'inline-block';
      r.surroundContents(s); return true;
    }
  }
  return false;
};
(async () => {
  const browser = await launch();
  fs.mkdirSync('assets', { recursive: true });
  const url = fs.readFileSync('receipt-url.txt', 'utf8').trim();

  // 1. the real receipt page with the content script
  let ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1.5, locale: 'sr-RS' });
  let page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.addStyleTag({ path: R + '/src/content.css' });
  const icon = 'data:image/png;base64,' + fs.readFileSync(R + '/icons/icon48.png').toString('base64');
  await page.evaluate(icon => { window.chrome = { runtime: { getURL: () => icon } }; }, icon);
  for (const f of ['parser.js', 'calendar-url.js', 'content.js']) await page.addScriptTag({ path: R + '/src/' + f });
  console.log('cashier blurred on the receipt page:', await page.evaluate(blurCashier));
  await page.screenshot({ path: 'assets/portal.png' });
  const ev = await page.evaluate(u => {
    const r = parseReceiptHtml(document.documentElement.outerHTML, u);
    const p = new URL(buildCalendarUrl(r)).searchParams;
    return { text: p.get('text'), dates: p.get('dates'), location: p.get('location'), details: p.get('details'), ctz: p.get('ctz') };
  }, url);
  fs.writeFileSync('assets/event.json', JSON.stringify(ev, null, 1));
  await ctx.close();

  // 2. desktop popup
  ctx = await browser.newContext({ viewport: { width: 340, height: 300 }, deviceScaleFactor: 3 });
  page = await ctx.newPage();
  await page.goto(BASE + '/v/harness.html'); await page.waitForSelector('#scan-tab'); await page.waitForTimeout(500);
  await page.screenshot({ path: 'assets/popup-a.png', fullPage: true });
  await page.click('#scan-tab'); await page.waitForSelector('#receipt:not(.hidden)'); await page.waitForTimeout(300);
  console.log('cashier blurred in the popup:', await page.evaluate(blurCashier));
  await page.evaluate(() => document.activeElement.blur());
  await page.screenshot({ path: 'assets/popup-b.png', fullPage: true });
  await ctx.close();

  // 3. phone popup (Firefox for Android)
  ctx = await browser.newContext({ viewport: { width: 407, height: 757 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Android 15; Mobile; rv:160.0) Gecko/160.0 Firefox/160.0' });
  page = await ctx.newPage();
  await page.goto(BASE + '/v/harness.html'); await page.waitForSelector('#take-photo'); await page.waitForTimeout(500);
  await page.screenshot({ path: 'assets/mobile-a.png' });
  await page.click('#scan-tab'); await page.waitForSelector('#receipt:not(.hidden)'); await page.waitForTimeout(300);
  await page.evaluate(blurCashier); await page.evaluate(() => document.activeElement.blur());
  await page.screenshot({ path: 'assets/mobile-b.png', fullPage: true });
  await ctx.close();
  await browser.close();
  console.log('event:', ev.text, '|', ev.dates, '|', ev.location);
})().catch(e => { console.error(e); process.exit(1); });
