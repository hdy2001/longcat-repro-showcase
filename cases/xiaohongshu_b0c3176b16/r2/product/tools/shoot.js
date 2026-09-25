// 截图工具：用无头 Chrome 打开页面截图（调试用）
// 用法: node tools/shoot.js <url> <outfile> [width] [height] [waitMs] [script]
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const [url, out, w = '1600', h = '900', wait = '6000', script = ''] = process.argv.slice(2);
const shellDir = execSync('ls -d ~/.cache/puppeteer/chrome-headless-shell/*/chrome-headless-shell-mac-arm64/chrome-headless-shell | tail -1').toString().trim();
const chromeDir = execSync('ls -d ~/.cache/puppeteer/chrome/*/chrome-mac-arm64/Google\\ Chrome | tail -1').toString().trim();

const browser = await puppeteer.launch({
  executablePath: fs.existsSync(shellDir) ? shellDir : chromeDir,
  headless: 'shell',
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=' + w + ',' + h, '--hide-scrollbars',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text().slice(0, 500)); });
page.on('pageerror', e => console.log('[pageerror]', e.stack ? e.stack.slice(0, 1200) : String(e).slice(0, 800)));
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise(r => setTimeout(r, +wait));
if (script) { await page.evaluate(script); await new Promise(r => setTimeout(r, 1200)); }
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
