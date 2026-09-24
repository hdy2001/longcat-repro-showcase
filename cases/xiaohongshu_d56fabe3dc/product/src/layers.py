#!/usr/bin/env python3
"""
天宫 (Heavenly Palace) — procedural layer generation.
Generates all depth layers as RGBA PNGs at 2x frame resolution.
Composition based on inputs/img_00.jpg: white-jade dragon pillars on the right,
palace on a sea of clouds, waterfall, cranes, two tiny figures.
"""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1080, 1350          # final frame size (4:5, xiaohongshu style)
SS = 2                     # layer supersample factor
LW, LH = W * SS, H * SS    # layer pixel size (2160 x 2700)
HERE = os.path.dirname(os.path.abspath(__file__))
LDIR = os.path.abspath(os.path.join(HERE, os.pardir, "layers"))
os.makedirs(LDIR, exist_ok=True)

# ------------------------------------------------ noise & helpers

def fbm(w, h, octaves=6, seed=0, persistence=0.55, base_grid=3):
    rng = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float64)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gw = base_grid * (2 ** o)
        gh = max(2, int(round(gw * h / w)))
        g = rng.random((gh, gw))
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        acc += np.asarray(im, np.float64) / 255.0 * amp
        tot += amp
        amp *= persistence
    return acc / tot

def fbm_1d(n, octaves=4, seed=0, persistence=0.55, base_grid=4):
    return fbm(n, 1, octaves, seed, persistence, base_grid).ravel()

def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)

def to_img(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

def overlay(base):
    ov = Image.new("RGBA", base.size, (0, 0, 0, 0))
    return ov, ImageDraw.Draw(ov)

def comp(base, ov):
    base.alpha_composite(ov)
    return base

def save(img, name):
    img.save(os.path.join(LDIR, name + ".png"))
    print("  saved", name, img.size)

# ------------------------------------------------ sky

def gen_sky():
    y = np.linspace(0, 1, LH)[:, None]
    top = np.array([46, 94, 160], np.float64)
    mid = np.array([128, 184, 222], np.float64)
    hor = np.array([224, 236, 243], np.float64)
    t1 = np.clip(y / 0.52, 0, 1)[..., None]
    t2 = np.clip((y - 0.52) / 0.48, 0, 1)[..., None]
    col = top * (1 - t1) + mid * t1
    col = col * (1 - t2) + hor * t2
    col = np.broadcast_to(col, (LH, LW, 3)).copy()
    sx, sy = 0.30 * LW, 0.145 * LH
    d2 = (np.arange(LW)[None, :] - sx) ** 2 + (np.arange(LH)[:, None] - sy) ** 2
    glow = np.exp(-d2 / (2 * (0.40 * LW) ** 2))[..., None]
    col += glow * np.array([255, 236, 200]) * 0.62
    dsun = np.exp(-d2 / (2 * (0.028 * LW) ** 2))[..., None]
    col += dsun * np.array([255, 252, 240]) * 1.0
    img = to_img(col).convert("RGBA")
    ov, d = overlay(img)
    rng = np.random.default_rng(3)
    for i in range(8):
        cx = rng.random() * LW
        cy = rng.random() * 0.38 * LH
        rx = (0.05 + rng.random() * 0.11) * LW
        ry = rx * (0.22 + rng.random() * 0.18)
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(255, 255, 255, 46))
    ov = ov.filter(ImageFilter.GaussianBlur(28))
    return comp(img, ov)

# ------------------------------------------------ clouds

def gen_clouds(name, seed, edge_frac, edge_var, coverage, extra_w=0,
               shadow_str=1.0, warm=1.0, blur=0, alpha_scale=1.0, bright=1.0,
               gap_x=None, gap_w=0.0, gap_alpha=1.0):
    """Sea-of-clouds bank with an irregular top edge at edge_frac.
    gap_x/gap_w: a notch (fraction of width) where alpha drops to gap_alpha,
    letting the waterfall show through."""
    w = LW + extra_w
    n1 = fbm(w, LH, 6, seed)
    n2 = fbm(w, LH, 5, seed + 100)
    field = n1 * 0.72 + n2 * 0.28
    e1 = fbm_1d(w, 4, seed + 200)
    ys = np.arange(LH)[:, None]
    edge = edge_frac + edge_var * (e1 - 0.5) * 2
    depth = ys / LH - edge                       # >0 below the cloud edge
    a = smoothstep(coverage, coverage + 0.26, field + depth * 1.45)
    a = np.clip(a * alpha_scale, 0, 1)
    if gap_x is not None:
        g = (np.arange(w)[None, :] / w - gap_x) / max(gap_w, 1e-6)
        gap = np.exp(-g * g * 2.2)
        a = a * (1 - gap * (1 - gap_alpha))
        a = np.clip(a, 0, 1)
    gy, gx = np.gradient(field)
    shade = np.clip(-(gx * 0.8 + gy * 0.35) * 22, -1, 1)
    shade = np.clip(shade + (n2 - 0.5) * 1.3, -1, 1)
    base = np.array([255, 255, 255]) * bright
    col = base + shade[..., None] * np.array([52, 62, 80]) * shadow_str
    col += np.clip(shade, 0, 1)[..., None] * np.array([28, 15, -16]) * warm
    # sun-lit rim right at the cloud edge (cloud side only), bluer depths below
    rim = np.exp(-np.clip(depth, 0, None) * 9) * smoothstep(-0.03, 0.01, depth)
    col += rim[..., None] * np.array([26, 18, 6]) * warm
    col -= np.clip(depth, 0, 1)[..., None] * np.array([26, 14, 2])
    if gap_x is not None:
        # darken the cloud in the gap so the white waterfall contrasts
        col = col - gap[..., None] * np.array([64, 54, 30]) * shadow_str
    col = np.clip(col, 0, 255)
    rgba = np.dstack([col, a * 255]).astype(np.uint8)
    img = Image.fromarray(rgba, "RGBA")
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    return img

# ------------------------------------------------ palace
HAZE = (168, 204, 228)

def mix(c, f=0.62):
    return tuple(int(c[i] * f + HAZE[i] * (1 - f)) for i in range(3)) + (255,)

def _roof_pts(cx, y, w, h, up):
    rh, eh, cu = w * 0.16, w * 0.50, h * up
    n = 22
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append((cx - eh + t * 2 * eh, y + h - cu * (1 - (2 * t - 1) ** 2)))
    pts.append((cx + rh, y + h * 0.10))
    for i in range(1, n):
        t = i / n
        pts.append((cx + rh - t * 2 * rh, y + h * 0.10 - h * 0.14 * (1 - (2 * (1 - t) - 1) ** 2)))
    pts.append((cx - rh, y + h * 0.10))
    return pts

def draw_roof(d, cx, y, w, h, up=0.32):
    pts = _roof_pts(cx, y, w, h, up)
    d.polygon(pts, fill=mix((66, 96, 128), 0.74))
    # lighter upper slope
    rh, eh, cu = w * 0.16, w * 0.50, h * up
    f = 0.50
    up_pts = [(cx - rh, y + h * 0.10), (cx + rh, y + h * 0.10)]
    n = 16
    for i in range(1, n + 1):
        t = i / n
        x = cx + rh - t * 2 * rh
        yy = y + h * 0.10 - h * 0.14 * (1 - (2 * (1 - t) - 1) ** 2)
        up_pts.append((x, yy))
    for i in range(n, -1, -1):
        t = i / n
        x = cx - eh + t * 2 * eh
        yy = y + h - cu * (1 - (2 * t - 1) ** 2)
        sx = cx - rh + (eh - rh) * f
        sy = y + h * 0.10 + (h - cu - h * 0.10) * f
        up_pts.append((sx + (x - (cx - eh)) * f, sy + (yy - (y + h)) * f))
    d.polygon(up_pts, fill=mix((104, 136, 168), 0.74))
    # under-eave shadow + gold eave line
    eave = [(cx - eh + (i / 22) * 2 * eh, y + h - cu * (1 - (2 * (i / 22) - 1) ** 2)) for i in range(23)]
    d.line(eave, fill=mix((40, 54, 72), 0.7), width=int(h * 0.10), joint="curve")
    d.line(eave, fill=mix((216, 196, 148), 0.62), width=int(h * 0.045), joint="curve")
    # ridge
    ridge = [(cx - rh + (i / 22) * 2 * rh, y + h * 0.10 - h * 0.14 * (1 - (2 * (1 - i / 22) - 1) ** 2)) for i in range(23)]
    d.line(ridge, fill=mix((48, 68, 92), 0.72), width=int(h * 0.075), joint="curve")
    for sx in (-1, 1):
        ox = cx + sx * rh
        oy = y + h * 0.10 - h * 0.14
        d.rounded_rectangle([ox - w * 0.016, oy - h * 0.17, ox + w * 0.016, oy + h * 0.02],
                            radius=w * 0.008, fill=mix((196, 176, 128), 0.66))
    # tile rows
    for k in (0.30, 0.55, 0.78):
        row = []
        for i in range(23):
            t = i / 22
            x = cx - eh + t * 2 * eh
            yy = y + h - cu * (1 - (2 * t - 1) ** 2)
            ry = y + h * 0.10
            row.append((x, yy + (ry - yy) * k))
        d.line(row, fill=mix((54, 80, 110), 0.7), width=int(h * 0.016), joint="curve")

def draw_hall(d, cx, base_y, w, body_h, n_door=3):
    ph = body_h * 0.16
    pw = w * 1.18
    d.rounded_rectangle([cx - pw / 2, base_y - ph, cx + pw / 2, base_y],
                        radius=ph * 0.2, fill=mix((214, 210, 198), 0.80))
    npost = 9
    for i in range(npost + 1):
        x = cx - pw / 2 + pw * i / npost
        d.rectangle([x - w * 0.008, base_y - ph - w * 0.030, x + w * 0.008, base_y - ph],
                    fill=mix((200, 196, 184), 0.8))
    d.rectangle([cx - pw / 2, base_y - ph - w * 0.036, cx + pw / 2, base_y - ph - w * 0.024],
                fill=mix((206, 202, 190), 0.8))
    d.rectangle([cx - w / 2, base_y - body_h, cx + w / 2, base_y - ph], fill=mix((232, 228, 218), 0.85))
    ncol = 2 * n_door + 1
    for i in range(ncol):
        x = cx - w / 2 + w * (i + 0.5) / ncol
        d.rectangle([x - w * 0.016, base_y - body_h, x + w * 0.016, base_y - ph],
                    fill=mix((146, 62, 48), 0.8))
    for i in range(n_door):
        x = cx - w / 2 + w * (i + 1) / (n_door + 1)
        d.rectangle([x - w * 0.045, base_y - body_h * 0.72, x + w * 0.045, base_y - ph],
                    fill=mix((58, 72, 88), 0.8))
    d.rectangle([cx - w * 0.05, base_y - body_h * 0.92, cx + w * 0.05, base_y - body_h * 0.78],
                fill=mix((120, 84, 50), 0.8))

def draw_pagoda(d, cx, base_y, w, tiers):
    for t in range(tiers):
        yy = base_y - t * w * 0.46
        ww = w * (1 - t * 0.13)
        draw_roof(d, cx, yy - w * 0.30, ww, w * 0.30, up=0.30)
        d.rectangle([cx - ww * 0.32, yy - w * 0.30, cx + ww * 0.32, yy], fill=mix((226, 222, 212), 0.85))
        d.rectangle([cx - ww * 0.05, yy - w * 0.22, cx + ww * 0.05, yy - w * 0.06],
                    fill=mix((58, 72, 88), 0.8))
    top_y = base_y - tiers * w * 0.46 - w * 0.30
    d.line([(cx, top_y), (cx, top_y - w * 0.34)], fill=mix((196, 176, 128), 0.7), width=int(w * 0.05))
    for k in range(3):
        r = w * (0.16 - k * 0.045)
        d.ellipse([cx - r, top_y - w * (0.10 + k * 0.09), cx + r, top_y - w * (0.02 + k * 0.09)],
                  fill=mix((196, 176, 128), 0.7))

def gen_palace():
    img = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    ov, d = overlay(img)
    base = 0.575 * LH
    # shared marble terrace
    d.rounded_rectangle([0.13 * LW, base - 0.012 * LH, 0.76 * LW, base + 0.02 * LH],
                        radius=20, fill=mix((216, 212, 200), 0.82))
    # main 3-tier hall
    cx, w = 0.44 * LW, 0.300 * LW
    body_h, roof_h = w * 0.30, w * 0.38
    y = base
    for t in range(3):
        ww = w * (1 - 0.17 * t)
        bh = body_h * (1 - 0.10 * t)
        rh = roof_h * (1 - 0.08 * t)
        draw_hall(d, cx, y, ww, bh)
        draw_roof(d, cx, y - bh - rh + rh * 0.18, ww, rh, up=0.30)
        y = y - bh - 0.75 * rh
    # side halls
    for sx in (0.295, 0.585):
        cx2, w2 = sx * LW, 0.150 * LW
        y2 = base + 0.012 * LH
        for t in range(2):
            ww = w2 * (1 - 0.15 * t)
            bh = w2 * 0.30 * (1 - 0.10 * t)
            rh = w2 * 0.38 * (1 - 0.08 * t)
            draw_hall(d, cx2, y2, ww, bh)
            draw_roof(d, cx2, y2 - bh - rh + rh * 0.18, ww, rh, up=0.30)
            y2 = y2 - bh - 0.75 * rh
    # pagoda towers
    draw_pagoda(d, 0.185 * LW, base + 0.02 * LH, 0.062 * LW, 5)
    draw_pagoda(d, 0.700 * LW, base + 0.025 * LH, 0.055 * LW, 4)
    # connecting corridor
    d.rectangle([0.36 * LW, base - 0.012 * LH, 0.52 * LW, base + 0.004 * LH], fill=mix((224, 220, 210), 0.85))
    draw_roof(d, 0.44 * LW, base - 0.045 * LH, 0.175 * LH, 0.030 * LH, up=0.30)
    comp(img, ov)
    img = img.filter(ImageFilter.GaussianBlur(1.8))
    return img

# ------------------------------------------------ waterfall (tileable streak strip, scrolled at render time)

WF_W = int(0.24 * LW)          # waterfall width
WF_H = int(0.46 * LH)          # tileable strip height
WF_TOP = 0.55                  # waterfall top edge, fraction of H

def gen_waterfall_streak():
    """Tileable vertical streak field, saved as .npy for per-frame scrolling."""
    w, h = WF_W, WF_H
    n = fbm(w, h // 5, 5, seed=11)
    streak = np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC),
                        np.float64) / 255
    n2 = fbm(w, h // 3, 4, seed=23)
    streak = streak * 0.7 + np.asarray(Image.fromarray((n2 * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC),
                                       np.float64) / 255 * 0.3
    # make tileable in y via seam crossfade
    K = h // 5
    for i in range(K):
        t = i / K
        streak[i] = streak[i] * t + streak[h - K + i] * (1 - t)
    np.save(os.path.join(LDIR, "waterfall_streak.npy"), streak)
    return streak

def waterfall_rgba(streak):
    a = smoothstep(0.30, 0.62, streak)
    # horizontal edge falloff so the strip doesn't look like a rectangle
    w = streak.shape[1]
    x = np.linspace(0, 1, w)
    env = smoothstep(0.0, 0.20, x) * smoothstep(1.0, 0.80, x)
    a = a * env[None, :]
    col = 252 - (1 - a)[..., None] * np.array([148, 166, 188])
    col += np.clip(streak - 0.5, 0, 1)[..., None] * np.array([24, 20, 10])
    return np.dstack([np.clip(col, 0, 255), a * 255]).astype(np.uint8)

def gen_waterfall_foam():
    """Static foam + cloud lip at the waterfall top."""
    w = WF_W + int(0.10 * LW)
    h = int(0.075 * LH)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(5)
    for i in range(40):
        cx = rng.random() * w
        cy = rng.random() * h * 0.7
        r = (0.008 + rng.random() * 0.025) * w
        d.ellipse([cx - r, cy - r * 0.6, cx + r, cy + r * 0.6], fill=(255, 255, 255, int(120 + rng.random() * 100)))
    img = img.filter(ImageFilter.GaussianBlur(2))
    return img

def gen_waterfall_static(streak):
    """Static full-frame layer (for preview only)."""
    img = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    body = Image.fromarray(waterfall_rgba(streak), "RGBA")
    img.alpha_composite(body, (int(0.13 * LW), int(WF_TOP * LH)))
    foam = gen_waterfall_foam()
    img.alpha_composite(foam, (int(0.08 * LW), int((WF_TOP - 0.02) * LH)))
    return img

# ------------------------------------------------ dragon pillar

def draw_dragon_head(img, x, y, s):
    """Dragon head facing left. (x, y) = neck base, s = head length."""
    ov, d = overlay(img)
    jade = (238, 235, 226, 255)
    jade_d = (196, 192, 180, 255)
    jade_dd = (146, 142, 132, 255)
    horn = (212, 200, 174, 255)
    mouth = (70, 22, 16, 255)
    fang = (246, 241, 229, 255)
    hx, hy = x - s * 0.70, y - s * 0.70
    # neck
    d.line([(x, y), (hx + s * 0.30, hy + s * 0.28)], fill=jade, width=int(s * 0.50))
    # skull
    d.ellipse([hx - s * 0.52, hy - s * 0.42, hx + s * 0.46, hy + s * 0.42], fill=jade)
    # long tapering snout, slightly upturned
    d.polygon([(hx - s * 0.40, hy - s * 0.22), (hx - s * 1.70, hy - s * 0.16),
               (hx - s * 1.95, hy - s * 0.02), (hx - s * 1.80, hy + s * 0.10),
               (hx - s * 0.38, hy + s * 0.26)], fill=jade)
    # nose knob
    d.ellipse([hx - s * 1.98, hy - s * 0.16, hx - s * 1.62, hy + s * 0.06], fill=jade_d)
    d.ellipse([hx - s * 1.84, hy - s * 0.06, hx - s * 1.74, hy + s * 0.06], fill=jade_dd)
    # slightly open mouth: thin dark slit + small fangs
    d.polygon([(hx - s * 1.62, hy + s * 0.06), (hx - s * 0.50, hy + s * 0.14),
               (hx - s * 0.46, hy + s * 0.24), (hx - s * 1.55, hy + s * 0.20)], fill=mouth)
    d.polygon([(hx - s * 1.45, hy + s * 0.08), (hx - s * 1.32, hy + s * 0.22), (hx - s * 1.20, hy + s * 0.09)], fill=fang)
    d.polygon([(hx - s * 0.90, hy + s * 0.14), (hx - s * 0.78, hy + s * 0.26), (hx - s * 0.66, hy + s * 0.15)], fill=fang)
    # eye + heavy brow
    d.ellipse([hx - s * 0.36, hy - s * 0.38, hx + s * 0.02, hy - s * 0.06], fill=(250, 248, 240, 255))
    d.ellipse([hx - s * 0.24, hy - s * 0.30, hx - s * 0.08, hy - s * 0.14], fill=(18, 14, 10, 255))
    d.polygon([(hx - s * 0.50, hy - s * 0.46), (hx + s * 0.14, hy - s * 0.32),
               (hx + s * 0.08, hy - s * 0.10), (hx - s * 0.42, hy - s * 0.22)], fill=jade_d)
    # horns: thick at base, curving back-up, with a branch
    d.line([(hx + s * 0.02, hy - s * 0.42), (hx + s * 0.50, hy - s * 0.80), (hx + s * 0.92, hy - s * 0.78)],
           fill=horn, width=int(s * 0.16))
    d.line([(hx + s * 0.48, hy - s * 0.72), (hx + s * 0.62, hy - s * 0.95)], fill=horn, width=int(s * 0.09))
    d.line([(hx + s * 0.10, hy - s * 0.32), (hx + s * 0.42, hy - s * 0.58)], fill=horn, width=int(s * 0.11))
    # mane: tight flame shapes along the back of the head
    for i in range(4):
        t = i / 3
        bx = hx + s * 0.28 + t * s * 0.55
        by = hy - s * 0.36 + t * s * 0.72
        d.polygon([(bx, by), (bx + s * 0.22, by + s * 0.06), (bx + s * 0.02, by + s * 0.26)], fill=jade_d[:3] + (225,))
    # whiskers: long thin curves flowing back
    d.line([(hx - s * 1.70, hy + s * 0.02), (hx - s * 1.05, hy + s * 0.30), (hx - s * 0.50, hy + s * 0.24)],
           fill=jade_d, width=int(s * 0.045))
    d.line([(hx - s * 1.70, hy + s * 0.10), (hx - s * 0.95, hy + s * 0.48), (hx - s * 0.40, hy + s * 0.46)],
           fill=jade_d, width=int(s * 0.038))
    # beard tuft
    d.polygon([(hx - s * 0.48, hy + s * 0.26), (hx - s * 0.30, hy + s * 0.66), (hx - s * 0.18, hy + s * 0.30)], fill=jade_d)
    comp(img, ov)

def draw_pedestal(d, cx, y, w):
    jade = (228, 225, 216, 255)
    jade_d = (188, 184, 172, 255)
    h = w * 0.55
    d.rounded_rectangle([cx - w * 0.75, y - h * 0.30, cx + w * 0.75, y], radius=w * 0.10, fill=jade_d)
    d.rounded_rectangle([cx - w * 0.62, y - h * 0.62, cx + w * 0.62, y - h * 0.28], radius=w * 0.08, fill=jade)
    for i in range(8):
        a = math.pi * (i + 0.5) / 8
        px = cx + math.cos(a) * w * 0.50
        py = y - h * 0.45 + math.sin(a) * h * 0.16
        d.ellipse([px - w * 0.13, py - h * 0.20, px + w * 0.13, py + h * 0.20], fill=jade)
    d.rounded_rectangle([cx - w * 0.55, y - h * 0.80, cx + w * 0.55, y - h * 0.58], radius=w * 0.06, fill=jade_d)

def gen_pillar(name, cx_frac, pw_frac, seed, head=True, head_y_frac=0.10, base_y_frac=None):
    cx = cx_frac * LW
    pw = int(pw_frac * LW)
    x0, x1 = cx - pw / 2, cx + pw / 2
    img = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    # dragon back pass (peeks out at pillar edges)
    turns = 2.4
    y0, y1 = -0.10 * LH, 1.10 * LH
    n_seg = 520
    ys = np.linspace(y0, y1, n_seg)
    th = (ys - y1) / (y0 - y1) * turns * 2 * math.pi
    xs = cx + pw * 0.60 * np.sin(th)
    zs = np.cos(th)
    br = pw * 0.30 * (0.72 + 0.38 * np.sin(np.pi * (ys - y1) / (y0 - y1)) ** 0.7)
    ov, d = overlay(img)
    dark = (162, 158, 146, 255)
    for i in range(n_seg - 1):
        if zs[i] < -0.08:
            r = br[i]
            d.ellipse([xs[i] - r, ys[i] - r * 0.92, xs[i] + r, ys[i] + r * 0.92], fill=dark)
    comp(img, ov)
    # shaft
    shade = np.zeros((LH, pw))
    for i in range(pw):
        t = i / (pw - 1) * 2 - 1
        s = 1 - 0.60 * (t + 0.30) ** 2 * 1.9
        shade[:, i] = np.clip(s, 0.30, 1.0)
    base = np.array([237, 234, 225], np.float64)
    vein = fbm(pw, LH, 4, seed + 7)
    col = base[None, None, :] * shade[..., None]
    col *= (0.93 + 0.11 * vein[..., None])
    vy = np.linspace(1.0, 0.90, LH)[:, None, None]
    col *= vy
    shaft = to_img(col).convert("RGBA")
    img.paste(shaft, (int(x0), 0))
    # dragon front pass
    ov, d = overlay(img)
    for i in range(n_seg - 1):
        if zs[i] > 0.04:
            r = br[i]
            zz = zs[i]
            c = (int(237 * (0.80 + 0.28 * zz)), int(234 * (0.80 + 0.28 * zz)), int(225 * (0.80 + 0.26 * zz)), 255)
            d.ellipse([xs[i] - r, ys[i] - r * 0.92, xs[i] + r, ys[i] + r * 0.92], fill=c)
    comp(img, ov)
    # scales + dorsal spikes
    ov, d = overlay(img)
    for i in range(0, n_seg - 1, 2):
        if zs[i] > 0.10:
            r = br[i]
            d.arc([xs[i] - r * 0.62, ys[i] - r * 0.15, xs[i] + r * 0.62, ys[i] + r * 0.75],
                  200, 340, fill=(190, 186, 174, 110), width=max(2, int(r * 0.10)))
    for i in range(0, n_seg - 1, 6):
        if zs[i] > 0.30:
            r = br[i]
            d.polygon([(xs[i] - r * 0.25, ys[i] - r * 0.70), (xs[i] + r * 0.30, ys[i] - r * 0.80),
                       (xs[i] + r * 0.05, ys[i] - r * 1.28)], fill=(172, 168, 156, 210))
    comp(img, ov)
    # claws: curved talons gripping the pillar edge
    ov, d = overlay(img)
    jade_d = (186, 182, 170, 255)
    for k, frac in enumerate((0.30, 0.55, 0.80)):
        yy = y1 + (y0 - y1) * frac
        side = 1 if k % 2 == 0 else -1
        cxp = cx + side * pw * 0.40
        for toe in range(3):
            a = (toe - 1) * 0.55
            # talon: curved tapered shape wrapping toward the pillar
            bx = cxp + side * pw * 0.10
            by = yy + a * pw * 0.20
            tx = cx + side * pw * 0.52
            ty = yy + a * pw * 0.30
            d.line([(bx, by), (bx + side * pw * 0.16, by + a * pw * 0.10), (tx, ty)],
                   fill=jade_d, width=int(pw * 0.075))
            d.polygon([(tx, ty), (tx - side * pw * 0.16, ty - pw * 0.03), (tx - side * pw * 0.10, ty + pw * 0.06)],
                      fill=jade_d)
    comp(img, ov)
    # head
    if head:
        draw_dragon_head(img, cx - pw * 0.05, head_y_frac * LH, pw * 0.95)
    # pedestal
    if base_y_frac is not None:
        ov, d = overlay(img)
        draw_pedestal(d, cx, base_y_frac * LH, pw)
        comp(img, ov)
    return img

# ------------------------------------------------ cranes

def _wing_pts(sx, sy, ang, L, w0):
    dx, dy = math.cos(ang), math.sin(ang)
    px, py = -dy, dx
    tipx, tipy = sx + dx * L, sy + dy * L
    pts = [(sx - px * w0 * 0.45, sy - py * w0 * 0.45)]
    for t in (0.3, 0.6, 0.85, 1.0):
        bow = math.sin(t * math.pi) * L * 0.06
        pts.append((sx + dx * L * t - px * bow, sy + dy * L * t - py * bow))
    trail = [(0.62, 0.62), (0.70, 0.30), (0.78, 0.55), (0.86, 0.42), (0.93, 0.20), (1.0, 0.10)]
    for t, wfrac in trail:
        pts.append((sx + dx * L * t + px * w0 * wfrac, sy + dy * L * t + py * w0 * wfrac))
    pts.append((sx + px * w0 * 0.45, sy + py * w0 * 0.45))
    return pts

def gen_crane(pose):
    """Flying red-crowned crane, facing left. pose 0..1 (0=wings up, 1=wings down)."""
    CW, CH = 1600, 1120
    img = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = CW * 0.50, CH * 0.52
    body_len = 300
    ang = math.radians(-58 + pose * 116)
    # far wing (darker)
    d.polygon(_wing_pts(cx - 20, cy + 30, ang * 0.85 - 0.12, body_len * 0.98, 100),
              fill=(168, 176, 186, 255))
    # legs
    d.line([(cx + body_len * 0.30, cy + 26), (cx + body_len * 0.80, cy + 68)], fill=(40, 40, 44, 255), width=9)
    d.line([(cx + body_len * 0.30, cy + 34), (cx + body_len * 0.76, cy + 88)], fill=(40, 40, 44, 255), width=9)
    # tail
    d.polygon([(cx + body_len * 0.34, cy - 12), (cx + body_len * 0.74, cy + 8), (cx + body_len * 0.36, cy + 32)],
              fill=(36, 36, 40, 255))
    # body
    d.ellipse([cx - body_len * 0.52, cy - 62, cx + body_len * 0.50, cy + 62], fill=(248, 248, 246, 255))
    d.ellipse([cx - body_len * 0.40, cy + 6, cx + body_len * 0.44, cy + 66], fill=(208, 213, 220, 255))
    # neck
    d.line([(cx - body_len * 0.34, cy - 30), (cx - body_len * 0.62, cy - 96)], fill=(36, 36, 40, 255), width=24)
    # head
    d.ellipse([cx - body_len * 0.72, cy - 126, cx - body_len * 0.46, cy - 88], fill=(248, 248, 246, 255))
    d.ellipse([cx - body_len * 0.70, cy - 136, cx - body_len * 0.54, cy - 112], fill=(196, 40, 32, 255))
    d.polygon([(cx - body_len * 0.70, cy - 114), (cx - body_len * 1.08, cy - 98), (cx - body_len * 0.68, cy - 94)],
              fill=(70, 70, 76, 255))
    # near wing
    d.polygon(_wing_pts(cx, cy - 24, ang, body_len * 1.12, 112), fill=(250, 250, 248, 255))
    # wing shading
    dx, dy = math.cos(ang), math.sin(ang)
    px, py = -dy, dx
    L = body_len * 1.12
    bx, by = cx, cy - 24
    d.polygon([(bx + dx * L * 0.15 + px * 60, by + dy * L * 0.15 + py * 60),
               (bx + dx * L * 0.55 + px * 55, by + dy * L * 0.55 + py * 55),
               (bx + dx * L * 0.60 - px * 20, by + dy * L * 0.60 - py * 20),
               (bx + dx * L * 0.20 - px * 25, by + dy * L * 0.20 - py * 25)],
              fill=(222, 226, 232, 255))
    # black primaries
    for k in range(3):
        t0 = 0.64 + k * 0.11
        x0 = bx + dx * L * t0
        y0 = by + dy * L * t0
        x1 = bx + dx * L * (t0 + 0.17)
        y1 = by + dy * L * (t0 + 0.17)
        w0, w1 = 112 * (1 - t0 * 0.5), 112 * (1 - (t0 + 0.17) * 0.5)
        d.polygon([(x0 + px * w0 * 0.55, y0 + py * w0 * 0.55), (x1 + px * w1 * 0.30, y1 + py * w1 * 0.30),
                   (x1 - px * w1 * 0.30, y1 - py * w1 * 0.30), (x0 - px * w0 * 0.55, y0 - py * w0 * 0.55)],
                  fill=(36, 36, 40, 255))
    return img

# ------------------------------------------------ figures

def draw_figure(d, x, y, h, robe, robe_d, sash):
    w = h * 0.40
    hem = [(x - w * 0.52, y), (x - w * 0.30, y - h * 0.06), (x, y - h * 0.02),
           (x + w * 0.30, y - h * 0.06), (x + w * 0.52, y)]
    pts = [(x - w * 0.30, y - h * 0.70), (x + w * 0.30, y - h * 0.70),
           (x + w * 0.44, y - h * 0.30)] + hem + [(x - w * 0.44, y - h * 0.30)]
    d.polygon(pts, fill=robe)
    d.polygon([(x - w * 0.28, y - h * 0.68), (x - w * 0.66, y - h * 0.42),
               (x - w * 0.48, y - h * 0.24), (x - w * 0.24, y - h * 0.52)], fill=robe_d)
    d.polygon([(x + w * 0.28, y - h * 0.68), (x + w * 0.66, y - h * 0.42),
               (x + w * 0.48, y - h * 0.24), (x + w * 0.24, y - h * 0.52)], fill=robe_d)
    d.line([(x - w * 0.33, y - h * 0.50), (x + w * 0.33, y - h * 0.50)], fill=sash, width=int(h * 0.055))
    d.ellipse([x - h * 0.085, y - h * 0.99, x + h * 0.085, y - h * 0.76], fill=(28, 22, 18, 255))
    d.ellipse([x - h * 0.045, y - h * 1.06, x + h * 0.045, y - h * 0.94], fill=(28, 22, 18, 255))

def gen_figures():
    img = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    ov, d = overlay(img)
    h = 0.030 * LH
    draw_figure(d, 0.716 * LW, 0.748 * LH, h, (158, 34, 30, 255), (122, 24, 22, 255), (214, 178, 90, 255))
    draw_figure(d, 0.778 * LW, 0.758 * LH, h * 1.04, (240, 236, 226, 255), (206, 200, 188, 255), (150, 140, 120, 255))
    return comp(img, ov)

# ------------------------------------------------ platform

def gen_platform():
    img = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    P1 = (0.52 * LW, 0.700 * LH)
    P2 = (1.12 * LW, 0.840 * LH)
    P3 = (1.12 * LW, 1.12 * LH)
    P4 = (0.40 * LW, 0.900 * LH)
    quad = [P1, P2, P3, P4]
    mask = Image.new("L", (LW, LH), 0)
    md = ImageDraw.Draw(mask)
    md.polygon(quad, fill=255)
    vy = np.linspace(0, 1, LH)[:, None, None]
    top = np.array([158, 196, 222], np.float64)
    bot = np.array([232, 226, 214], np.float64)
    grad = np.broadcast_to(top * (1 - vy) + bot * vy, (LH, LW, 3)).copy()
    floor = to_img(grad).convert("RGBA")
    floor.putalpha(mask)
    img.alpha_composite(floor)
    ov, d = overlay(img)
    rng = np.random.default_rng(9)
    for i in range(14):
        x = rng.uniform(0.45, 1.05) * LW
        wdt = rng.uniform(20, 90)
        d.rectangle([x - wdt / 2, 0.72 * LH, x + wdt / 2, 1.05 * LH], fill=(255, 255, 255, 16))
    comp(img, ov)
    # pillar reflections
    ov, d = overlay(img)
    for cx_frac, pw_frac in ((0.675, 0.088), (0.965, 0.095)):
        cx = cx_frac * LW
        pw = pw_frac * LW
        base_y = 0.700 + (cx_frac - 0.52) / 0.60 * 0.14 * LH
        refl_h = 0.16 * LH
        n = 26
        pts_top, pts_bot = [], []
        for i in range(n + 1):
            t = i / n
            x = cx - pw / 2 + t * pw
            bump = abs(math.sin(t * math.pi * 5)) * pw * 0.18
            pts_top.append((x, base_y + bump * 0.3))
            pts_bot.append((x, base_y + refl_h - bump))
        d.polygon(pts_top + pts_bot[::-1], fill=(110, 120, 132, 52))
    comp(img, ov)
    # figure reflections
    ov, d = overlay(img)
    for fx, fy in ((0.716, 0.748), (0.778, 0.758)):
        x, y = fx * LW, fy * LH
        d.polygon([(x - 26, y), (x + 26, y), (x + 14, y + 90), (x - 14, y + 90)], fill=(85, 92, 104, 44))
    comp(img, ov)
    img = img.filter(ImageFilter.GaussianBlur(2))
    ov, d = overlay(img)
    d.line([P4, P3], fill=(216, 200, 160, 255), width=int(0.006 * LW))
    d.line([P1, P4], fill=(190, 176, 142, 220), width=int(0.004 * LW))
    # front face
    face = [(P4[0], P4[1]), (P3[0], P3[1]), (P3[0], LH), (P4[0], LH)]
    d.polygon(face, fill=(148, 142, 130, 255))
    d.polygon(face, outline=(120, 114, 104, 255), width=3)
    band_top = min(P4[1], P3[1]) + 6
    band_bot = band_top + 0.032 * LH
    d.rectangle([P4[0], band_top, P3[0], band_bot], fill=(130, 124, 112, 255))
    n = 16
    for i in range(n):
        t = (i + 0.5) / n
        x = P4[0] + (P3[0] - P4[0]) * t
        yc = band_top + (band_bot - band_top) * 0.5
        r = (band_bot - band_top) * 0.30
        d.arc([x - r, yc - r, x + r, yc + r], 0, 360, fill=(96, 90, 80, 255), width=4)
        d.arc([x - r * 0.55, yc - r * 0.55, x + r * 0.55, yc + r * 0.55], 0, 360,
              fill=(188, 182, 168, 255), width=3)
    comp(img, ov)
    return img

# ------------------------------------------------ rays & mist

def gen_rays():
    img = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    sx, sy = 0.30 * LW, 0.145 * LH
    for i in range(7):
        ang = math.radians(40 + i * 8.5 + (i % 2) * 3)
        L = LH * 1.25
        w0, w1 = 0.010 * LW, 0.055 * LW
        x1, y1 = sx + math.cos(ang) * L, sy + math.sin(ang) * L
        px, py = -math.sin(ang), math.cos(ang)
        d.polygon([(sx + px * w0, sy + py * w0), (x1 + px * w1, y1 + py * w1),
                   (x1 - px * w1, y1 - py * w1), (sx - px * w0, sy - py * w0)],
                  fill=(255, 244, 214, 24))
    return img.filter(ImageFilter.GaussianBlur(16))

def gen_mist():
    w = LW + 800
    h = LH + 200
    n = fbm(w, h, 5, seed=31)
    ys = np.arange(h)[:, None]
    a = smoothstep(0.52, 0.85, n) * smoothstep(0.45, 0.72, ys / h)
    col = np.dstack([np.full((h, w, 3), 255), a * 110]).astype(np.uint8)
    return Image.fromarray(col, "RGBA")

# ------------------------------------------------ main

def main():
    print("generating layers ->", LDIR)
    save(gen_sky(), "sky")
    save(gen_clouds("clouds_back", seed=101, edge_frac=0.545, edge_var=0.045,
                    coverage=0.30, extra_w=400, shadow_str=1.6,
                    gap_x=0.25, gap_w=0.15, gap_alpha=0.35), "clouds_back")
    save(gen_palace(), "palace")
    streak = gen_waterfall_streak()
    save(gen_waterfall_static(streak), "waterfall")
    save(gen_clouds("clouds_mid", seed=202, edge_frac=0.62, edge_var=0.06,
                    coverage=0.36, extra_w=600, shadow_str=1.2,
                    gap_x=0.25, gap_w=0.17, gap_alpha=0.30), "clouds_mid")
    save(gen_platform(), "platform")
    save(gen_pillar("pillar_a", 0.675, 0.088, seed=1, head=True, head_y_frac=0.135,
                    base_y_frac=0.735), "pillar_a")
    save(gen_pillar("pillar_b", 0.965, 0.096, seed=2, head=True, head_y_frac=0.100,
                    base_y_frac=0.815), "pillar_b")
    save(gen_figures(), "figures")
    save(gen_clouds("clouds_front", seed=303, edge_frac=0.74, edge_var=0.06,
                    coverage=0.42, extra_w=1600, shadow_str=0.7, alpha_scale=0.9,
                    gap_x=0.25, gap_w=0.18, gap_alpha=0.55), "clouds_front")
    save(gen_rays(), "rays")
    save(gen_mist(), "mist")
    for i, pose in enumerate((0.0, 0.25, 0.5, 0.75, 1.0)):
        save(gen_crane(pose), f"crane_{i}")
    # static preview composite
    order = ["sky", "clouds_back", "palace", "waterfall", "clouds_mid", "clouds_front",
             "platform", "pillar_a", "pillar_b", "figures", "rays", "mist"]
    prev = Image.new("RGBA", (LW, LH), (0, 0, 0, 255))
    for name in order:
        prev.alpha_composite(Image.open(os.path.join(LDIR, name + ".png")))
    prev = prev.resize((W, H), Image.LANCZOS)
    prev.convert("RGB").save(os.path.join(HERE, os.pardir, "preview.png"))
    print("preview saved")

if __name__ == "__main__":
    main()
