# Vibe Motion 3D App

Three.js scene scaffold with deterministic frame control and Puppeteer export.

## Start

```bash
pnpm install
pnpm dev
```

Open the printed local URL, scrub the frame controls, and export either a PNG or a ZIP image sequence.

## Render Contract

The scene exposes `window.__SCENE_3D_EXPORT__` for Puppeteer:

- `isReady()`
- `getCurrentFrame()`
- `getTotalFrames()`
- `getSize()`
- `setFrame(frame)`

Every frame should be computed from the requested frame number. Do not depend on prior render order.

## Browser Selection

Exports use `puppeteer-core`, so Chrome or another Chromium browser must exist locally. The script auto-detects common Chrome, Chromium, and Edge paths. To force a browser path:

```bash
SCENE_EXPORT_BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm dev
```

`PUPPETEER_EXECUTABLE_PATH` is also supported.
