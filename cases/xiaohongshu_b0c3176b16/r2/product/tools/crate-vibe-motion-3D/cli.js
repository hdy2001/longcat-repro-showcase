#!/usr/bin/env node
// ============================================================
// crate-vibe-motion-3D — 把 3D 场景渲染为 9:16 竖屏解说动画
//
// 用法:
//   npx crate-vibe-motion-3D render \
//     --url http://127.0.0.1:8788/video.html \
//     --narration narration.txt \
//     --shots shots.json \
//     --out output/forbidden-city-night-9x16.mp4
//
// 流程: say 合成中文配音 → 无头 Chrome 加载 9:16 3D 场景页
//       → canvas.captureStream + MediaRecorder 录 WebM
//       → ffmpeg 转 H.264 MP4 并混入配音，输出 .srt 字幕
// ============================================================
import { execFileSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : def;
}

const CMD = process.argv[2] || 'render';
if (CMD !== 'render') { console.error('未知命令', CMD); process.exit(1); }

const URL_ = arg('url', 'http://127.0.0.1:8788/video.html');
const NARR_FILE = arg('narration');
const SHOTS_FILE = arg('shots');
const OUT = arg('out', 'output/forbidden-city-night-9x16.mp4');
const TITLE = arg('title', '故宫 · 夜游');
const VOICE = arg('voice', 'Tingting');
const RATE = arg('rate', '175');
const NOFX = arg('fx', '1') === '0';

if (!NARR_FILE || !SHOTS_FILE) { console.error('需要 --narration 和 --shots 参数'); process.exit(1); }

// ---------- 1. 分镜与解说文本 ----------
// shots.json: [{label:"午门"}]（每行一个分镜）；narration.txt 每行对应一段解说
const shotLabels = JSON.parse(fs.readFileSync(SHOTS_FILE, 'utf8')).map(s => typeof s === 'string' ? s : s.label);
const narrLines = fs.readFileSync(NARR_FILE, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
if (shotLabels.length !== narrLines.length) {
  console.error(`分镜数(${shotLabels.length})与解说行数(${narrLines.length})不一致`);
  process.exit(1);
}
const totalChars = narrLines.reduce((a, b) => a + b.length, 0);
const DUR = Math.max(20, Math.round(totalChars / 4.2));   // 中文配音 ≈ 4.2 字/秒

const shots = [];
{
  let t = 0;
  narrLines.forEach((text, i) => {
    const d = (text.length / totalChars) * DUR;
    shots.push({ t0: +t.toFixed(2), t1: +(t + d).toFixed(2), label: shotLabels[i], text });
    t += d;
  });
  shots[shots.length - 1].t1 = DUR;
}
console.log(`① 分镜 ${shots.length} 段，总时长 ${DUR}s`);

// ---------- 2. 合成配音（macOS say） ----------
const outDir = path.dirname(path.resolve(OUT));
fs.mkdirSync(outDir, { recursive: true });
const aiff = path.join(outDir, 'narration.aiff');
execSync(`say -v ${VOICE} -r ${RATE} -o "${aiff}" -f "${NARR_FILE}"`, { stdio: 'inherit' });
console.log('② 配音合成完成（', VOICE, '）');

// ---------- 3. 无头浏览器录制 9:16 ----------
function findChrome() {
  try {
    const shell = execSync('ls -d ~/.cache/puppeteer/chrome-headless-shell/*/chrome-headless-shell-mac-arm64/chrome-headless-shell 2>/dev/null | tail -1').toString().trim();
    if (shell && fs.existsSync(shell)) return shell;
  } catch {}
  try {
    const full = execSync('ls -d ~/.cache/puppeteer/chrome/*/chrome-mac-*/Google\\ Chrome 2>/dev/null | tail -1').toString().trim();
    if (full && fs.existsSync(full)) return full;
  } catch {}
  const app = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(app)) return app;
  throw new Error('找不到 Chrome，请先安装 puppeteer 或 Google Chrome');
}

const shotsParam = encodeURIComponent(JSON.stringify(shots));
const pageUrl = `${URL_}${URL_.includes('?') ? '&' : '?'}shots=${shotsParam}&dur=${DUR}&title=${encodeURIComponent(TITLE)}&fx=${NOFX ? '0' : '1'}`;
const webmPath = path.join(outDir, '_capture.webm');

console.log('③ 启动无头 Chrome 录制 9:16 …');
const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: 'shell',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=540,960'],
});
const page = await browser.newPage();
await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('[pageerror]', String(e).slice(0, 500)));
await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction('window.__video && window.__video.ready', { timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));   // 等场景预热
await page.evaluate(() => { window.__video.seek(0); window.__video.startRecording(); });

const t0 = Date.now();
await new Promise(r => setTimeout(r, (DUR + 2) * 1000));
const b64 = await page.evaluate(() => window.__video.stopRecording());
await browser.close();
fs.writeFileSync(webmPath, Buffer.from(b64, 'base64'));
console.log('④ WebM 录制完成', (fs.statSync(webmPath).size / 1024 / 1024).toFixed(1) + 'MB');

// ---------- 4. ffmpeg 转 MP4 + 配音 + 字幕 ----------
console.log('⑤ ffmpeg 合成 MP4 …');
execFileSync('ffmpeg', ['-y', '-i', webmPath, '-i', aiff,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
  path.resolve(OUT)], { stdio: 'inherit' });
fs.unlinkSync(webmPath);

// ---------- 5. SRT 字幕 ----------
{
  const srt = shots.map((s, i) => {
    const f = t => { const m = Math.floor(t / 60), ss = (t % 60).toFixed(3).padStart(6, '0'); return `00:${String(m).padStart(2, '0')}:${ss}`; };
    return `${i + 1}\n${f(s.t0).replace('.', ',')} --> ${f(s.t1).replace('.', ',')}\n${s.label}\n${s.text}\n`;
  }).join('\n');
  fs.writeFileSync(path.join(outDir, 'narration.srt'), srt);
}
console.log('✅ 完成:', path.resolve(OUT));
