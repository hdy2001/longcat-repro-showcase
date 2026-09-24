import puppeteer from "puppeteer-core";

const frames = process.argv[2] ? process.argv[2].split(",").map(Number) : [0, 90, 200, 320, 450, 560, 700, 899];
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  defaultViewport: { width: 900, height: 1600, deviceScaleFactor: 1 },
  args: [
    "--hide-scrollbars",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--disable-gpu-sandbox",
    "--no-sandbox",
  ],
});
const page = await browser.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    console.log(`[console.${msg.type()}]`, msg.text().slice(0, 300));
  }
});
page.on("pageerror", (err) => console.log("[pageerror]", String(err).slice(0, 500)));
await page.goto("http://127.0.0.1:4173/?exportMode=composite&renderScale=1", {
  waitUntil: "networkidle0",
  timeout: 60000,
});
await page.waitForFunction(() => Boolean(window.__SCENE_3D_EXPORT__?.isReady?.()), { timeout: 60000 });
console.log("scene ready, frames =", await page.evaluate(() => window.__SCENE_3D_EXPORT__.getTotalFrames()));
for (const f of frames) {
  const t0 = Date.now();
  await page.evaluate(async (frame) => {
    await window.__SCENE_3D_EXPORT__.setFrame(frame);
  }, f);
  await page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const el = await page.$("#preview-shell");
  await el.screenshot({ path: `/tmp/gugong-test/frame-${String(f).padStart(4, "0")}.png` });
  console.log(`frame ${f} captured in ${Date.now() - t0}ms`);
}
await browser.close();
console.log("DONE");
