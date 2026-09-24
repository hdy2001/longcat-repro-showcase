#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天坛祈年殿 · 3D点云艺术视频生成器
- 从 inputs/img_00.jpg 提取发光粒子构建伪3D点云
- 黑底、银白/蓝金/翠绿配色切换、左侧竖排建筑名、结尾标语
- 纯 numpy + PIL 渲染, ffmpeg 编码
"""
import os, sys, time, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1920
FPS = 30
DURATION = 30.0
N_FRAMES = int(FPS * DURATION)
SEED = 42

CJK_FONT_CANDIDATES = [
    "/Library/Fonts/Arial Unicode.ttf",
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
]

def load_font(size):
    for p in CJK_FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()

# ---------------- 1. 粒子提取 ----------------
def extract_particles():
    img = np.asarray(Image.open("inputs/img_00.jpg").convert("RGB")).astype(np.float32)
    lum = img.mean(axis=2)
    yy, xx = np.mgrid[0:H, 0:W]
    mask = lum > 28.0
    # 去掉左侧竖排文字区域 与 右下角水印
    mask &= ~((xx < 250) & (yy < 660))
    mask &= ~((xx > 920) & (yy > 1780))
    weights = (lum * mask).astype(np.float64)
    weights /= weights.sum()

    N = 100000
    rng = np.random.default_rng(SEED)
    idx = rng.choice(H * W, size=N, p=weights.ravel())
    py, px = idx // W, idx % W
    bright = lum.ravel()[idx] / 255.0
    rgb = img.reshape(-1, 3)[idx] / 255.0

    # 世界坐标: x右 y上 z朝向观察者
    xs = (px - W * 0.52) / W
    ys = -(py - H * 560 / W) / W
    zs = bright * 0.50 + rng.normal(0.0, 0.030, N)
    # 轻微厚度挤出, 增强3D感
    zs = zs + rng.normal(0.0, 0.020, N)
    P = np.stack([xs, ys, zs], axis=1).astype(np.float32)

    # 开场时的散点位置(随机星云)
    P0 = np.stack([
        rng.uniform(-1.25, 1.25, N),
        rng.uniform(-0.95, 0.95, N),
        rng.uniform(-0.8, 1.1, N),
    ], axis=1).astype(np.float32)

    return P, P0, bright, rgb

# ---------------- 2. 配色方案 ----------------
def scheme_colors(t, depth, height, bright, rgb):
    """返回 (N,3) 浮点RGB, t为秒"""
    # 方案区间与交叉淡化
    # 银白 2.8-9.8 | 蓝金 9.8-16.8 | 翠绿 16.8-23.5
    def mix(a, b, f):
        f = np.clip(f, 0.0, 1.0)
        return a[None, :] * (1 - f[:, None]) + b[None, :] * f[:, None]

    n = bright.shape[0]
    f_bg = np.full(n, smoothstep(9.8, 11.2, t))   # 银白 -> 蓝金
    f_ge = np.full(n, smoothstep(16.8, 18.2, t))  # 蓝金 -> 翠绿

    # 银白: 近处亮白微蓝, 远处灰蓝
    silver = mix(np.array([0.62, 0.70, 0.92]), np.array([0.96, 0.98, 1.05]), 1 - depth)
    # 蓝金: 深蓝 -> 金 (按高度+深度混合)
    tg = np.clip(height * 0.62 + (1 - depth) * 0.38, 0, 1)
    bluegold = mix(np.array([0.05, 0.14, 0.92]), np.array([1.05, 0.68, 0.20]), tg)
    # 翠绿: 祖母绿 -> 青, 少量金色闪点
    emerald = mix(np.array([0.06, 0.42, 0.38]), np.array([0.16, 0.96, 0.55]), depth)
    gold_spark = (bright > 0.86).astype(np.float32)[:, None]
    emerald = emerald * (1 - 0.45 * gold_spark) + np.array([1.0, 0.72, 0.25])[None, :] * (0.45 * gold_spark)

    col = silver * (1 - f_bg[:, None]) + bluegold * f_bg[:, None]
    col = col * (1 - f_ge[:, None]) + emerald * f_ge[:, None]
    # 混入20%原图色彩, 保留艺术画作的色彩层次
    col = col * 0.80 + rgb * 0.20
    # 亮度调制 + 微闪烁
    shimmer = 0.88 + 0.12 * np.sin(t * 2.1 + SHIM_PHASE)
    col = col * (0.45 + 0.55 * bright)[:, None] * shimmer[:, None]
    return np.clip(col, 0.0, 1.2)

def smoothstep(a, b, t):
    f = np.clip((t - a) / (b - a), 0.0, 1.0)
    return f * f * (3 - 2 * f)

def ease_out_cubic(x):
    x = np.clip(x, 0, 1)
    return 1 - (1 - x) ** 3

# ---------------- 3. 相机与渲染 ----------------
FL = 1.62 * W  # 焦距(像素)

def camera(t):
    """返回 cam_pos(3), target(3)"""
    if t < 2.8:  # 形成期: 正面推近
        k = ease_out_cubic(t / 2.8)
        az = np.deg2rad(-24 + 24 * k)
        el = np.deg2rad(16 - 5 * k)
        dist = 3.2 - 1.0 * k
    elif t < 23.5:  # 展示期: 缓慢环绕(保持正面可辨识)
        tt = t - 2.8
        az = np.deg2rad(15 * np.sin(tt * 0.30) + 3 * np.sin(tt * 0.83))
        el = np.deg2rad(11 + 4 * np.sin(tt * 0.21))
        dist = 2.25 + 0.15 * np.sin(tt * 0.17)
    else:  # 结尾: 拉远
        k = ease_out_cubic((t - 23.5) / 2.5)
        az = np.deg2rad(3 * np.sin(20.7 * 0.83))
        el = np.deg2rad(11 + 6 * k)
        dist = 2.25 + 0.85 * k
    target = np.array([0.0, -0.18, 0.08])
    pos = target + dist * np.array([
        np.sin(az) * np.cos(el), np.sin(el), np.cos(az) * np.cos(el)])
    return pos, target

def render_points(P, col, alpha, cam_pos, target, frame_acc):
    """把点投影并累加到 frame_acc (3,H,W) float32"""
    fwd = target - cam_pos
    fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, np.array([0, 1, 0.0]))
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)

    v = P - cam_pos[None, :]
    zc = v @ fwd
    m = zc > 0.08
    if not m.any():
        return
    v, zc, col, alpha = v[m], zc[m], col[m], alpha[m]
    xc = v @ right
    yc = v @ up
    sx = W / 2 + xc / zc * FL
    sy = H / 2 - yc / zc * FL
    ix = np.round(sx).astype(np.int32)
    iy = np.round(sy).astype(np.int32)
    inb = (ix >= 0) & (ix < W - 1) & (iy >= 0) & (iy < H - 1)
    ix, iy, col, alpha, zc = ix[inb], iy[inb], col[inb], alpha[inb], zc[inb]

    # 近大远小: 尺寸与亮度衰减
    size_k = np.clip(1.6 / zc, 0.5, 2.6)
    a = alpha * size_k
    # 2x2 撒点
    for dx, dy, wgt in ((0, 0, 0.30), (1, 0, 0.22), (0, 1, 0.22), (1, 1, 0.26)):
        fx, fy = ix + dx, iy + dy
        flat = fy * W + fx
        for c in range(3):
            frame_acc[c] += np.bincount(flat, weights=col[:, c] * a * wgt,
                                        minlength=H * W).reshape(H, W)

# ---------------- 4. 文字层 ----------------
def vertical_name_layer(t, tint):
    """左侧竖排 '天坛祈年殿' — 返回 (文字层, 深色衬底层)"""
    layer = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(layer)
    font = load_font(76)
    text = "天坛祈年殿"
    x = 70
    y0 = 300
    spacing = 1.18
    for i, ch in enumerate(text):
        d.text((x, y0 + i * 76 * spacing), ch, font=font, fill=235)
    glow = layer.filter(ImageFilter.GaussianBlur(7))
    # 深色衬底: 压暗文字背后的粒子, 提升可读性
    halo = layer.filter(ImageFilter.GaussianBlur(16))
    return glow, halo, tint

def end_text_layer(t):
    """结尾 'AI+3D让创意无限可能' — 返回 (核心, 辉光, 透明度)"""
    a = smoothstep(26.6, 27.8, t)
    if a <= 0:
        return None, None, 0.0
    layer = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(layer)
    font = load_font(92)
    text = "AI+3D让创意无限可能"
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    x = (W - tw) / 2 - bbox[0]
    y = H * 0.50
    d.text((x, y), text, font=font, fill=255)
    core = layer.filter(ImageFilter.GaussianBlur(1.2))
    glow = layer.filter(ImageFilter.GaussianBlur(10))
    return core, glow, a

def corner_hud():
    """科技感边角"""
    layer = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(layer)
    L = 90
    m = 46
    for (cx, cy, sx, sy) in [(m, m, 1, 1), (W - m, m, -1, 1),
                             (m, H - m, 1, -1), (W - m, H - m, -1, -1)]:
        d.line([(cx, cy), (cx + sx * L, cy)], fill=110, width=3)
        d.line([(cx, cy), (cx, cy + sy * L)], fill=110, width=3)
    return layer

# ---------------- 5. 主流程 ----------------
def main():
    preview_only = "--preview" in sys.argv
    P, P0, bright, rgb = extract_particles()
    N = len(P)
    depth = np.clip((P[:, 2] - P[:, 2].min()) / (np.ptp(P[:, 2]) + 1e-6), 0, 1)
    height = np.clip((P[:, 1] - P[:, 1].min()) / (np.ptp(P[:, 1]) + 1e-6), 0, 1)
    global SHIM_PHASE
    SHIM_PHASE = np.random.default_rng(SEED + 1).uniform(0, 6.28, N).astype(np.float32)

    # 环境尘埃
    rng = np.random.default_rng(SEED + 2)
    M = 1600
    DUST = np.stack([rng.uniform(-0.9, 0.9, M), rng.uniform(-0.6, 0.8, M),
                     rng.uniform(-0.4, 0.8, M)], axis=1).astype(np.float32)

    hud = corner_hud()

    def render_frame(t):
        frame_acc = np.zeros((3, H, W), np.float32)
        cam_pos, target = camera(t)

        # 形成/消散插值
        if t < 2.8:
            k = ease_out_cubic(t / 2.8)
            Pcur = P0 * (1 - k) + P * k
            alpha = np.full(N, 1.0 * k, np.float32)
        elif t < 23.5:
            Pcur = P
            alpha = np.full(N, 1.0, np.float32)
        else:
            k = ease_out_cubic((t - 23.5) / 2.5)
            drift = np.stack([np.sin(SHIM_PHASE * 3) * 0.35,
                              np.full(N, 0.55),
                              np.cos(SHIM_PHASE * 2) * 0.3], axis=1).astype(np.float32)
            Pcur = P + drift * k
            alpha = np.full(N, 1.0 * (1 - 0.75 * k), np.float32)

        col = scheme_colors(t, depth, height, bright, rgb)
        render_points(Pcur, col, alpha, cam_pos, target, frame_acc)

        # 尘埃
        dcol = np.tile(np.array([0.75, 0.82, 0.95], np.float32), (M, 1))
        dcol = dcol * (0.25 + 0.35 * np.sin(t * 0.7 + np.arange(M))[:, None])
        dpos = DUST + np.stack([np.sin(t * 0.11 + np.arange(M)) * 0.05,
                                np.cos(t * 0.09 + np.arange(M)) * 0.04,
                                np.zeros(M)], axis=1).astype(np.float32)
        render_points(dpos, dcol, np.full(M, 0.30, np.float32), cam_pos, target, frame_acc)

        # 色调映射 + 辉光
        acc = frame_acc.transpose(1, 2, 0)  # H,W,3
        base = (1 - np.exp(-acc * 2.6))
        base8 = (np.clip(base, 0, 1) * 255).astype(np.uint8)
        img = Image.fromarray(base8, "RGB")
        b1 = np.asarray(img.filter(ImageFilter.GaussianBlur(3)), np.float32)
        b2 = np.asarray(img.filter(ImageFilter.GaussianBlur(10)), np.float32)
        comp = base8.astype(np.float32) * 0.40 + b1 * 0.85 + b2 * 0.25
        frame = np.clip(comp, 0, 255).astype(np.uint8)
        out = Image.fromarray(frame, "RGB")

        # 竖排建筑名 (2.8s - 25.8s)
        if 2.8 <= t < 25.8:
            fade = smoothstep(2.8, 3.6, t) * (1 - smoothstep(24.6, 25.8, t))
            tint = scheme_tint(t)
            glow, halo, _ = vertical_name_layer(t, tint)
            ga = np.asarray(glow, np.float32) / 255.0 * fade
            hd = np.asarray(halo, np.float32) / 255.0 * fade
            arr = np.asarray(out, np.float32)
            # 先压暗背景, 再叠加发光文字
            for c in range(3):
                arr[:, :, c] = np.clip(arr[:, :, c] - hd * 255.0 * 0.72, 0, None)
                arr[:, :, c] += ga * 255.0 * tint[c] * 1.15
            out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")

        # 结尾标语
        if t >= 26.2:
            core, glow, a = end_text_layer(t)
            if glow is not None:
                arr = np.asarray(out, np.float32)
                gc = np.asarray(core, np.float32) / 255.0 * a
                gg = np.asarray(glow, np.float32) / 255.0 * a
                # 金色辉光 + 亮金核心
                arr[:, :, 0] += gg * 255 * 0.85 + gc * 255 * 0.95
                arr[:, :, 1] += gg * 225 * 0.85 + gc * 215 * 0.95
                arr[:, :, 2] += gg * 170 * 0.85 + gc * 120 * 0.95
                out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
            # 压暗背景突出文字
            dk = 1 - 0.55 * smoothstep(26.2, 27.5, t)
            out = Image.fromarray((np.asarray(out, np.float32) * dk).astype(np.uint8), "RGB")

        # HUD 边角
        out = Image.fromarray(np.clip(
            np.asarray(out, np.float32) + np.asarray(hud, np.float32)[..., None] * 0.5,
            0, 255).astype(np.uint8), "RGB")
        return out

    def scheme_tint(t):
        f_bg = smoothstep(9.8, 11.2, t)
        f_ge = smoothstep(16.8, 18.2, t)
        silver = np.array([0.92, 0.95, 1.05])
        gold = np.array([1.0, 0.78, 0.38])
        mint = np.array([0.45, 1.0, 0.72])
        c = silver * (1 - f_bg) + gold * f_bg
        c = c * (1 - f_ge) + mint * f_ge
        return c

    if preview_only:
        for name, t in [("preview_form", 1.6), ("preview_silver", 6.0),
                        ("preview_bluegold", 13.5), ("preview_emerald", 20.5),
                        ("preview_end", 28.5)]:
            fr = render_frame(t)
            arr = np.asarray(fr)
            print(f"{name}: left-region max {arr[380:800, 60:260].max()}, "
                  f"global max {arr.max()}")
            fr.save(f"{name}.png")
        return

    out_path = "天坛祈年殿_3D点云艺术.mp4"
    cmd = ["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-c:v", "libx264", "-preset", "medium", "-crf", "18",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", out_path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t0 = time.time()
    for i in range(N_FRAMES):
        t = i / FPS
        frame = render_frame(t)
        proc.stdin.write(frame.tobytes())
        if i % 30 == 0:
            el = time.time() - t0
            eta = el / (i + 1) * (N_FRAMES - i - 1)
            print(f"frame {i}/{N_FRAMES}  elapsed {el:.0f}s  eta {eta:.0f}s", flush=True)
    proc.stdin.close()
    proc.wait()
    print(f"done -> {out_path}  total {time.time()-t0:.0f}s")

if __name__ == "__main__":
    main()
