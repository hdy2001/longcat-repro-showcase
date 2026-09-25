#!/usr/bin/env python3
"""Crop black borders of Dunhuang zaojing images, enhance mineral-pigment colors,
normalize size, and save into assets/ for embedding into a single-file HTML."""
import os
import numpy as np
from PIL import Image, ImageEnhance

SRC = "inputs"
DST = "assets"
os.makedirs(DST, exist_ok=True)
MAX_SIDE = 1600


def find_content_box(arr: np.ndarray):
    """Return (left, top, right, bottom) of non-near-black content."""
    lum = arr.mean(axis=2)
    black_col = lum.max(axis=0) < 24      # column is bar if every pixel is near-black
    black_row = lum.max(axis=1) < 24
    cols = np.where(~black_col)[0]
    rows = np.where(~black_row)[0]
    if len(cols) == 0 or len(rows) == 0:
        return 0, 0, arr.shape[1], arr.shape[0]
    return int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1


for fname in sorted(os.listdir(SRC)):
    if not fname.lower().endswith(".jpg"):
        continue
    im = Image.open(os.path.join(SRC, fname)).convert("RGB")
    arr = np.asarray(im)
    l, t, r, b = find_content_box(arr)
    # trim 1px inside detected edge to kill any residual dark halo
    l2, t2 = min(l + 1, r - 1), min(t + 1, b - 1)
    r2, b2 = max(r - 1, l2 + 1), max(b - 1, t2 + 1)
    cropped = im.crop((l2, t2, r2, b2))
    w, h = cropped.size
    print(f"{fname}: {im.size} -> crop({l},{t},{r},{b}) -> {cropped.size}")

    # gentle mineral-color enrichment: deeper red / azurite / malachite / gold
    out = ImageEnhance.Color(cropped).enhance(1.22)
    out = ImageEnhance.Contrast(out).enhance(1.06)

    if max(w, h) > MAX_SIDE:
        scale = MAX_SIDE / max(w, h)
        out = out.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    out.save(os.path.join(DST, fname), quality=88, progressive=True, optimize=True)

print("done ->", DST)
