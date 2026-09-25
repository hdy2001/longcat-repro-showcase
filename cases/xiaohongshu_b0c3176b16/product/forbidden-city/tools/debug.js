import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8767;
const CHROME = '~/.cache/puppeteer/chrome/mac_arm-154.0.8037.57/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 300000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1080,1920'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${PORT}/anim/vertical.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__READY === true', { timeout: 120000, polling: 500 });

await page.evaluate('window.__paused = true');
for (const t of [4, 46, 72]) {
  const info = await page.evaluate(`(() => {
    window.__captureStill(${t});
    const c = window.__app.camera;
    return { t: ${t}, pos: c.position.toArray().map(v=>+v.toFixed(1)), cineTime: window.__cine.time() };
  })()`);
  console.log(JSON.stringify(info));
}
await browser.close();
server.close();
process.exit(0);
