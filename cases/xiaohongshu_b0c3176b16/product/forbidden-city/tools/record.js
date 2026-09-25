#!/usr/bin/env node
// ============================================================
// record.js — 9:16 竖屏 3D 动画录制（Puppeteer + 本机 Chrome）
// 用法: node tools/record.js qa   → 抓取时间线静帧 QA
//       node tools/record.js rec  → 录制完整解说动画 webm/mp4
// ============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8766;
const CHROME = '~/.cache/puppeteer/chrome/mac_arm-154.0.8037.57/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

// ---- 静态服务器 ----
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
console.log(`[server] http://127.0.0.1:${PORT}`);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  protocolTimeout: 600000,
  args: [
    '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1080,1920',
  ],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}]`, m.text().slice(0, 300));
});

const mode = process.argv[2] || 'qa';
await page.goto(`http://127.0.0.1:${PORT}/anim/vertical.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction('window.__READY === true', { timeout: 120000, polling: 500 });
console.log('[ready] scene booted');

fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });

if (mode === 'qa') {
  await page.evaluate('window.__paused = true');
  const times = [4, 12, 21, 28, 38, 46, 55, 62, 72, 82, 92, 100, 112];
  for (const t of times) {
    const dataUrl = await page.evaluate(`window.__captureStill(${t})`);
    const b64 = String(dataUrl).split(',')[1];
    const out = path.join(ROOT, 'shots', `qa_${String(t).padStart(3, '0')}.jpg`);
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log('[shot]', out);
  }
} else if (mode === 'rec') {
  const dir = path.join(ROOT, 'shots');
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
  const dlPromise = page.waitForEvent('download', { timeout: 420000 });
  await page.evaluate('window.__startRecording()');
  console.log('[rec] started, waiting for finish…');
  const dl = await dlPromise;
  const out = path.join(ROOT, 'shots', dl.suggestedFilename());
  await dl.saveAs(out);
  console.log('[saved]', out);
  const size = fs.statSync(out).size / 1048576;
  console.log(`[done] ${size.toFixed(1)} MB`);
} else {
  console.log('unknown mode', mode);
}

await browser.close();
server.close();
process.exit(0);
