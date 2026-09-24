import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");

const SERVER_PORT = Number(process.env.SCENE_EXPORT_PORT || 4173);
const SERVER_HOST = process.env.SCENE_EXPORT_HOST || "127.0.0.1";
const VIEWPORT_WIDTH = Number(process.env.SCENE_EXPORT_VIEWPORT_WIDTH || 900);
const VIEWPORT_HEIGHT = Number(process.env.SCENE_EXPORT_VIEWPORT_HEIGHT || 1600);
const DEFAULT_RENDER_SCALE = Number(process.env.SCENE_EXPORT_DEVICE_SCALE_FACTOR || 1);
const MIN_RENDER_SCALE = 1;
const MAX_RENDER_SCALE = 2;
const FRAME_FILE_PADDING = 4;
const ZIP_VERSION_NEEDED = 20;
const ZIP_STORE_METHOD = 0;
const BROWSER_EXECUTABLE = resolveBrowserExecutable();

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
]);

function jsonResponse(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  });
  response.end(JSON.stringify(payload));
}

function textResponse(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  });
  response.end(message);
}

function binaryResponse(response, statusCode, contentType, filename, buffer) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": contentType,
    "Content-Length": buffer.length,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store, no-cache, must-revalidate",
  });
  response.end(buffer);
}

function parseRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

function normalizeRenderScale(value) {
  const scale = Number(value);
  if (Number.isFinite(scale)) {
    return Math.min(Math.max(scale, MIN_RENDER_SCALE), MAX_RENDER_SCALE);
  }

  return Math.min(Math.max(DEFAULT_RENDER_SCALE, MIN_RENDER_SCALE), MAX_RENDER_SCALE);
}

function formatFrameFileName(frame) {
  return `frame-${String(frame).padStart(FRAME_FILE_PADDING, "0")}.png`;
}

function resolveBrowserExecutable() {
  const explicit =
    process.env.SCENE_EXPORT_BROWSER || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicit) {
    return explicit;
  }

  const candidatesByPlatform = {
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ],
    win32: [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ],
    linux: [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/microsoft-edge",
    ],
  };

  for (const candidate of candidatesByPlatform[process.platform] ?? []) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function serveStaticFile(request, response) {
  if (!request.url) {
    textResponse(response, 400, "Missing request URL");
    return;
  }

  const requestUrl = new URL(request.url, `http://${SERVER_HOST}:${SERVER_PORT}`);
  const rawPathname = decodeURIComponent(requestUrl.pathname);
  const pathname = rawPathname === "/" ? "/index.html" : rawPathname;
  const filePath = path.resolve(appDir, `.${pathname}`);
  const relativePath = path.relative(appDir, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    textResponse(response, 403, "Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const contentType =
      contentTypes.get(path.extname(filePath).toLowerCase()) ||
      "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    });
    response.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      textResponse(response, 404, "Not found");
      return;
    }

    textResponse(response, 500, error.stack || error.message);
  }
}

async function capturePreviewPngBuffer(page) {
  const preview = await page.$("#preview-shell");
  if (!preview) {
    throw new Error("Preview shell is missing");
  }

  return await preview.screenshot({
    type: "png",
  });
}

async function withScenePage({ renderScale }, task) {
  let browser;

  try {
    if (!BROWSER_EXECUTABLE) {
      throw new Error(
        "Could not find a Chromium browser. Install Chrome/Chromium/Edge or set SCENE_EXPORT_BROWSER."
      );
    }

    browser = await puppeteer.launch({
      executablePath: BROWSER_EXECUTABLE,
      headless: true,
      defaultViewport: {
        width: Math.round(VIEWPORT_WIDTH * renderScale),
        height: Math.round(VIEWPORT_HEIGHT * renderScale),
        deviceScaleFactor: 1,
      },
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
    await page.goto(
      `http://${SERVER_HOST}:${SERVER_PORT}/?exportMode=composite&renderScale=${renderScale}`,
      { waitUntil: "networkidle0" }
    );
    await page.waitForFunction(() => Boolean(window.__SCENE_3D_EXPORT__?.isReady?.()));

    const metadata = await page.evaluate(() => ({
      totalFrames: window.__SCENE_3D_EXPORT__.getTotalFrames(),
    }));

    return await task({ page, metadata });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function captureFrameBuffer({ frame, renderScale }) {
  return await withScenePage({ renderScale }, async ({ page, metadata }) => {
    const clampedFrame = Math.max(0, Math.min(frame, metadata.totalFrames - 1));

    await page.evaluate(async (nextFrame) => {
      await window.__SCENE_3D_EXPORT__.setFrame(nextFrame);
    }, clampedFrame);

    return {
      frame: clampedFrame,
      buffer: await capturePreviewPngBuffer(page),
    };
  });
}

async function captureSequenceZip({ startFrame, endFrame, renderScale }) {
  return await withScenePage({ renderScale }, async ({ page, metadata }) => {
    const clampedStartFrame = Math.max(0, Math.min(startFrame, metadata.totalFrames - 1));
    const clampedEndFrame = Math.max(
      clampedStartFrame,
      Math.min(endFrame, metadata.totalFrames - 1)
    );

    const entries = [];
    for (let frame = clampedStartFrame; frame <= clampedEndFrame; frame += 1) {
      await page.evaluate(async (nextFrame) => {
        await window.__SCENE_3D_EXPORT__.setFrame(nextFrame);
      }, frame);

      entries.push({
        name: formatFrameFileName(frame),
        data: await capturePreviewPngBuffer(page),
      });
    }

    return {
      startFrame: clampedStartFrame,
      endFrame: clampedEndFrame,
      buffer: createStoredZipBuffer(entries),
    };
  });
}

function createStoredZipBuffer(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    if (entry.data.length > 0xffffffff) {
      throw new Error("A ZIP entry is too large.");
    }

    const nameBytes = encoder.encode(entry.name);
    const crc = computeCrc32(entry.data);
    const localHeader = createZipLocalHeader({ nameBytes, data: entry.data, crc });
    const centralHeader = createZipCentralHeader({
      nameBytes,
      data: entry.data,
      crc,
      localHeaderOffset: offset,
    });

    localParts.push(localHeader, entry.data);
    centralParts.push(centralHeader);
    offset += localHeader.length + entry.data.length;
    centralSize += centralHeader.length;

    if (offset > 0xffffffff || centralSize > 0xffffffff) {
      throw new Error("ZIP is too large.");
    }
  }

  const endRecord = createZipEndRecord({
    entryCount: entries.length,
    centralSize,
    centralOffset: offset,
  });

  return Buffer.concat([...localParts, ...centralParts, endRecord]);
}

function createZipLocalHeader({ nameBytes, data, crc }) {
  const header = Buffer.alloc(30 + nameBytes.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(ZIP_VERSION_NEEDED, 4);
  header.writeUInt16LE(ZIP_STORE_METHOD, 8);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(nameBytes.length, 26);
  header.set(nameBytes, 30);
  return header;
}

function createZipCentralHeader({ nameBytes, data, crc, localHeaderOffset }) {
  const header = Buffer.alloc(46 + nameBytes.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(ZIP_VERSION_NEEDED, 4);
  header.writeUInt16LE(ZIP_VERSION_NEEDED, 6);
  header.writeUInt16LE(ZIP_STORE_METHOD, 10);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(data.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(nameBytes.length, 28);
  header.writeUInt32LE(localHeaderOffset, 42);
  header.set(nameBytes, 46);
  return header;
}

function createZipEndRecord({ entryCount, centralSize, centralOffset }) {
  if (entryCount > 0xffff) {
    throw new Error("ZIP has too many files.");
  }

  const record = Buffer.alloc(22);
  record.writeUInt32LE(0x06054b50, 0);
  record.writeUInt16LE(entryCount, 8);
  record.writeUInt16LE(entryCount, 10);
  record.writeUInt32LE(centralSize, 12);
  record.writeUInt32LE(centralOffset, 16);
  return record;
}

function computeCrc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createCrc32Table() {
  const table = new Uint32Array(256);

  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
}

const crc32Table = createCrc32Table();

let exportQueue = Promise.resolve();

function queueExport(task) {
  const nextTask = exportQueue.then(task, task);
  exportQueue = nextTask.catch(() => undefined);
  return nextTask;
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    textResponse(response, 400, "Missing request URL");
    return;
  }

  const requestUrl = new URL(request.url, `http://${SERVER_HOST}:${SERVER_PORT}`);
  const pathname = requestUrl.pathname;

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    response.end();
    return;
  }

  if (request.method === "GET" && pathname === "/health") {
    jsonResponse(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await serveStaticFile(request, response);
    return;
  }

  if (request.method !== "POST") {
    textResponse(response, 405, "Only GET and POST are supported");
    return;
  }

  try {
    const body = await parseRequestBody(request);

    if (pathname === "/export/frame") {
      const frame = Number(body.frame);
      const renderScale = normalizeRenderScale(body.renderScale);
      const result = await queueExport(() =>
        captureFrameBuffer({
          frame: Number.isFinite(frame) ? Math.round(frame) : 0,
          renderScale,
        })
      );

      binaryResponse(
        response,
        200,
        "image/png",
        `vibe-motion-3d-${formatFrameFileName(result.frame)}`,
        result.buffer
      );
      return;
    }

    if (pathname === "/export/sequence") {
      const startFrame = Number(body.startFrame);
      const endFrame = Number(body.endFrame);
      const renderScale = normalizeRenderScale(body.renderScale);
      const result = await queueExport(() =>
        captureSequenceZip({
          startFrame: Number.isFinite(startFrame) ? Math.round(startFrame) : 0,
          endFrame: Number.isFinite(endFrame) ? Math.round(endFrame) : 0,
          renderScale,
        })
      );

      binaryResponse(
        response,
        200,
        "application/zip",
        `vibe-motion-3d-${String(result.startFrame).padStart(4, "0")}-${String(
          result.endFrame
        ).padStart(4, "0")}.zip`,
        result.buffer
      );
      return;
    }

    textResponse(response, 404, "Unknown export endpoint");
  } catch (error) {
    textResponse(response, 500, error.stack || error.message);
  }
});

server.listen(SERVER_PORT, SERVER_HOST, () => {
  process.stdout.write(
    `vibe motion 3d server listening on http://${SERVER_HOST}:${SERVER_PORT}${os.EOL}`
  );
});
