#!/usr/bin/env python3
"""Build particle data for 藻井之舞 (Dance of the Caisson Ceiling).

For each caisson image: crop away watermarks, resize, boost saturation,
quantize to a 256-color palette, then weighted-sample N particles
(brightness + edge emphasis) so dougong / dragon structures stay crisp.
Output: compact binary -> base64 -> injected into template.html -> index.html
"""
import base64
import struct
import numpy as np
from PIL import Image

ROOT = 'workspace'

# (name, x0, y0, x1, y1) crop fractions — removes 小红书 / Merrick watermarks
# and the bottom caption bar.
FORMS = [
    ('uniform_01', (0.020, 0.055, 0.980, 0.795)),  # wheel / radial caisson
    ('uniform_03', (0.020, 0.055, 0.980, 0.820)),  # round caisson, coiled dragon
    ('uniform_05', (0.020, 0.055, 0.980, 0.860)),  # square caisson, blue ground
    ('uniform_06', (0.020, 0.055, 0.980, 0.860)),  # octagonal caisson, dragon
]
N = 12000          # particles per form
SW = 300           # sample-space width
SEED = 11


def build_form(name, box):
    im = Image.open(f'{ROOT}/inputs/{name}.jpg').convert('RGB')
    w, h = im.size
    c = im.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)))
    nh = round(c.size[1] * SW / c.size[0])
    c = c.resize((SW, nh), Image.LANCZOS)

    # boost saturation & value so reds / blues / golds stay vivid
    hsv = np.asarray(c.convert('HSV')).astype(np.uint16)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.35, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * 1.06, 0, 255)
    c = Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB')

    q = c.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    pal = np.array(q.getpalette()[:768], dtype=np.uint8).reshape(256, 3)
    idx = np.asarray(q)  # nh x SW palette indices

    lum = (0.2126 * pal[:, 0] + 0.7152 * pal[:, 1] + 0.0722 * pal[:, 2])
    L = lum[idx]
    gy, gx = np.gradient(L)
    grad = np.hypot(gx, gy)
    W = np.clip((L - 45) / 210.0, 0, 1) ** 1.3 + 0.45 * np.clip(grad / 55.0, 0, 1)
    W[L < 38] = 0

    flat = W.ravel()
    cdf = np.cumsum(flat)
    cdf /= cdf[-1]
    rng = np.random.default_rng(SEED)
    sel = np.searchsorted(cdf, rng.random(N))
    ys, xs = np.divmod(sel, SW)
    cs = idx[ys, xs].astype(np.uint8)

    # preview: 2x scale, 2px blocks
    prev = Image.new('RGB', (SW * 2, nh * 2), (0, 0, 0))
    pa = np.array(prev)
    for x, y, ci in zip(xs, ys, cs):
        pa[y * 2:y * 2 + 2, x * 2:x * 2 + 2] = pal[ci]
    Image.fromarray(pa).save(f'{ROOT}/build/preview_{name}.png')

    return c.size[0], c.size[1], pal, xs.astype(np.uint16), ys.astype(np.uint16), cs


def main():
    out = bytearray(b'ZJ' + bytes([1, len(FORMS)]))
    for name, box in FORMS:
        w, h, pal, xs, ys, cs = build_form(name, box)
        print(f'{name}: sample {w}x{h}, {len(xs)} particles')
        out += struct.pack('<HHI', w, h, len(xs))
        out += pal.tobytes()
        for x, y, ci in zip(xs, ys, cs):
            out += struct.pack('<HHB', int(x), int(y), int(ci))
    b64 = base64.b64encode(bytes(out)).decode()
    print(f'binary {len(out)} bytes -> base64 {len(b64)} chars')

    with open(f'{ROOT}/build/template.html', 'r', encoding='utf-8') as f:
        tpl = f.read()
    assert '/*__PARTICLE_DATA__*/' in tpl, 'placeholder missing'
    html = tpl.replace('/*__PARTICLE_DATA__*/', b64)
    with open(f'{ROOT}/index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'index.html written ({len(html)} bytes)')


if __name__ == '__main__':
    main()
