#!/usr/bin/env python3
"""Generate procedural textures for the Hanging Temple model (PIL + numpy)."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'textures')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(42)


def fbm(shape, freq, octaves=4, persistence=0.55):
    """Value-noise fBm, returns float32 array in [0,1]."""
    h, w = shape
    out = np.zeros(shape, np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        fh, fw = freq * (2 ** o), freq * (2 ** o)
        gw, gh = max(2, int(round(w / fw * 4))), max(2, int(round(h / fh * 4)))
        grid = rng.random((gh + 1, gw + 1)).astype(np.float32)
        ys = np.linspace(0, gh, h, endpoint=False)
        xs = np.linspace(0, gw, w, endpoint=False)
        y0 = ys.astype(int); x0 = xs.astype(int)
        y1 = np.minimum(y0 + 1, gh); x1 = np.minimum(x0 + 1, gw)
        fy = (ys - y0)[:, None]; fx = (xs - x0)[None, :]
        fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
        v = (grid[y0][:, x0] * (1 - fx) + grid[y0][:, x1] * fx) * (1 - fy) + \
            (grid[y1][:, x0] * (1 - fx) + grid[y1][:, x1] * fx) * fy
        out += v * amp
        total += amp
        amp *= persistence
    return out / total


def save(arr, name):
    img = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))
    img.save(os.path.join(OUT, name))
    print('saved', name, img.size)


# ---------- 1. Rock cliff (beige strata + vertical weather streaks) ----------
S = 512
base = fbm((S, S), 6, 5)
strata = fbm((S, S), 3, 3)
streak = fbm((S, S), 10, 3)
# horizontal strata: compress noise vertically
ys = np.linspace(0, 1, S)
strata_pat = np.sin(ys[:, None] * 46 + fbm((S, S), 5, 3) * 7.0)
r = 0.62 + 0.16 * strata + 0.10 * strata_pat + 0.05 * streak
g = 0.50 + 0.14 * strata + 0.09 * strata_pat + 0.04 * streak
b = 0.38 + 0.12 * strata + 0.08 * strata_pat + 0.035 * streak
# dark vertical water stains
st = fbm((S, S), 14, 3)
st = np.clip((st - 0.55) * 4, 0, 1)[:, ::1]
stain_col = np.zeros((S, S, 3), np.float32)
for i, c in enumerate((0.55, 0.5, 0.45)):
    stain_col[:, :, i] = st * c * 0.5
rock = np.stack([r, g, b], -1) - stain_col
save(np.clip(rock, 0, 1), 'rock_cliff.png')

# ---------- 2. Glazed golden roof tiles (筒瓦 rows) ----------
S = 512
rows = 16          # tile courses along V
cols = 24          # barrel tiles along U
tile = np.zeros((S, S, 3), np.float32)
gold = np.array([0.85, 0.62, 0.18])
for c in range(cols):
    u0, u1 = c / cols, (c + 1) / cols
    # barrel tile profile: convex cylinder shading
    uu = np.linspace(0, 1, S)[None, :]
    prof = np.sin(np.clip((uu - u0) / (u1 - u0), 0, 1) * np.pi) ** 0.8
    shade = 0.55 + 0.45 * prof
    for i in range(3):
        tile[:, :, i] = np.maximum(tile[:, :, i], gold[i] * shade * (1 + 0.05 * fbm((S, S), 40, 2)))
# row seams
for r_ in range(rows):
    y0 = int(r_ * S / rows)
    tile[max(0, y0 - 2):y0 + 2, :] *= 0.55
# tile end caps (瓦当) hints: darker dots along row bottoms
yy = np.linspace(0, 1, S)[:, None]
caps = (np.sin(yy * rows * np.pi * 2) > 0.92)[None, :]
tile *= (1 - 0.25 * caps[:, :S].astype(np.float32))
save(np.clip(tile, 0, 1), 'glazed_tile.png')

# ---------- 3. Wood (columns / beams, dark red-brown) ----------
S = 512
grain = fbm((S, S), 8, 4)
rings = np.sin((np.linspace(0, 1, S)[None, :] * 30 + fbm((S, S), 6, 3) * 4))
w = 0.42 + 0.10 * grain + 0.06 * rings
wood = np.stack([w * 1.0, w * 0.62, w * 0.42], -1)
save(wood, 'wood.png')

# ---------- 4. Deck planks ----------
S = 512
pl = np.zeros((S, S, 3), np.float32)
plank_w = S // 8
for p in range(8):
    y0 = p * plank_w
    tone = 0.5 + 0.12 * rng.random()
    g2 = fbm((S, S), 10, 3) * 0.08
    for i, c in enumerate((0.62, 0.44, 0.30)):
        pl[y0:y0 + plank_w - 2, :, i] = np.clip((c + g2[y0:y0 + plank_w - 2]) * tone, 0, 1)
pl[plank_w - 2::plank_w, :, :] *= 0.5
save(pl, 'plank.png')

# ---------- 5. Brick wall (base retaining wall, grey-red) ----------
S = 512
br = np.zeros((S, S, 3), np.float32)
bh, bw = S // 16, S // 32
mortar = np.array([0.45, 0.42, 0.38])
brick_col = np.array([0.55, 0.30, 0.22])
for row in range(16):
    offset = (bw // 2) if row % 2 else 0
    for col_ in range(-1, 34):
        x0 = col_ * bw + offset
        tone = 0.85 + 0.3 * rng.random()
        noise = fbm((S, S), 30, 2) * 0.08
        xs = slice(max(0, x0), min(S, x0 + bw - 3))
        ys = slice(row * bh + 2, (row + 1) * bh - 2)
        for i in range(3):
            br[ys, xs, i] = np.clip((brick_col[i] + noise[ys, xs]) * tone, 0, 1)
br = np.where(br.sum(-1, keepdims=True) == 0, mortar[None, None, :], br)
save(br, 'brick.png')

# ---------- 6. Stone (steps / piers, grey) ----------
S = 512
st = fbm((S, S), 7, 5)
spots = fbm((S, S), 24, 3)
s = 0.52 + 0.16 * st + 0.08 * spots
stone = np.stack([s, s * 0.98, s * 0.94], -1)
save(stone, 'stone.png')

# ---------- 7. Terrain (dry grass / dirt slope) ----------
S = 512
t1 = fbm((S, S), 5, 5)
t2 = fbm((S, S), 30, 3)
ter = np.stack([0.45 + 0.14 * t1 + 0.06 * t2,
                0.42 + 0.13 * t1 + 0.06 * t2,
                0.26 + 0.08 * t1 + 0.04 * t2], -1)
save(ter, 'terrain.png')

# ---------- 8. Red plaster wall ----------
S = 512
n = fbm((S, S), 9, 4)
rw = 0.52 + 0.06 * n
redwall = np.stack([rw, rw * 0.55, rw * 0.42], -1)
save(redwall, 'red_wall.png')

# ---------- 9. Lattice window (dark wood lattice, used as color+alpha) ----------
S = 512
lat = np.zeros((S, S, 3), np.float32)
lat[:] = np.array([0.16, 0.10, 0.07])
bar = np.array([0.35, 0.22, 0.14])
bw2 = 14
for i in range(0, S, bw2):
    lat[:, i:i + 6, :] = bar
    lat[i:i + 6, :, :] = bar
save(lat, 'lattice.png')

print('ALL TEXTURES DONE')
