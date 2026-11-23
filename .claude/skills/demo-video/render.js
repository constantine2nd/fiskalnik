// node render.js stills 3,18.5,51   → out/still-<t>.png, to look at single moments
// node render.js film              → every frame, piped to ffmpeg → out/video.mp4 (no sound; build.sh adds it)
// film.html is a pure function of time (window.seek), so the frames are exact, not a screen recording.
const { spawn } = require('child_process');
const { fs, WORK, BASE, launch } = require('./common.js');
process.chdir(WORK);
const FPS = 30;
(async () => {
  fs.mkdirSync('out', { recursive: true });
  const browser = await launch();
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exitCode = 1; });
  await page.goto(BASE + '/v/film.html');
  await page.waitForFunction('window.ready === true', null, { timeout: 30000 });
  if (process.argv[2] === 'stills') {
    for (const t of process.argv[3].split(',')) {
      await page.evaluate(t => seek(t), +t);
      await page.screenshot({ path: `out/still-${t}.png` });
      console.log(`out/still-${t}.png`);
    }
  } else {
    const total = Math.round((await page.evaluate('DURATION')) * FPS);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', 'out/video.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < total; f++) {
      await page.evaluate(t => seek(t), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 300 === 0) console.log('frame', f, '/', total);
    }
    ff.stdin.end();
    const code = await new Promise(r => ff.on('close', r));
    if (code) throw new Error('ffmpeg exited with ' + code);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
