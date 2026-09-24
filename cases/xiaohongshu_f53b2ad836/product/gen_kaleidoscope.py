#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
敦煌藻井万花筒视频生成器
- 仰视窟顶视角：中心对称构图 + 固定八边形藻井外框
- 多种藻井图案（莲花藻井 / 宝相花 / 卷草忍冬 / 几何菱格）每 6 秒切换
- 旋转缩放嵌套：5 层同心环带，各层独立旋转方向/速度 + 径向呼吸缩放 + 全局推进
- 敦煌壁画配色：土红 / 石青 / 石绿 / 赭石 / 土黄金 / 铅白 / 深褐
输出: frames/*.png -> dunhuang_kaleidoscope.mp4
"""
import math
import os
import random
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

# ---------------- 配置 ----------------
W, H = 1080, 1920          # 竖屏 9:16
FPS = 24
DURATION = 36.0            # 秒
N_STYLES = 4
SWITCH_INTERVAL = 6.0      # 每种样式停留秒数
TRANS = 1.2                # 切换过渡秒数
R_MAX = 460.0              # 万花筒图案最大半径(像素)
CX, CY = W / 2, H / 2      # 画面中心
FRAMES_DIR = "frames"
OUT_VIDEO = "dunhuang_kaleidoscope.mp4"

# ---------------- 敦煌壁画调色板 ----------------
BG_HI   = (206, 162, 100)   # 地仗亮土黄
BG_MID  = (168, 122, 74)
BG_LO   = (104, 70, 44)
RED     = (168, 74, 50)     # 土红
RED_D   = (120, 48, 36)
BLUE    = (44, 88, 128)     # 石青
BLUE_D  = (30, 60, 92)
GREEN   = (62, 106, 76)     # 石绿
GREEN_D = (40, 74, 54)
GREEN_L = (96, 142, 100)
OCHRE   = (148, 98, 50)     # 赭石
GOLD    = (216, 164, 74)    # 土黄/金
GOLD_L  = (232, 190, 110)
WHITE   = (230, 220, 198)   # 铅白
DARK    = (42, 32, 24)      # 深褐
BLACK   = (24, 18, 14)

# ---------------- 画笔 ----------------
def petal_pts(r_in, r_out, half_w, n=18, bend=0.0):
    """花瓣轮廓点列（局部极坐标）：底部在 r_in、顶部在 r_out，半宽 half_w（弧度）"""
    pts = []
    for i in range(n + 1):
        t = i / n
        r = r_in + (r_out - r_in) * t
        w = half_w * (math.sin(math.pi * t) ** 0.8)
        pts.append((r, -w + bend * t))
    for i in range(n, -1, -1):
        t = i / n
        r = r_in + (r_out - r_in) * t
        w = half_w * (math.sin(math.pi * t) ** 0.8)
        pts.append((r, w + bend * t))
    return pts


def _xy(cx, cy, r, a):
    return (cx + r * math.cos(a), cy + r * math.sin(a))


def draw_beads(draw, cx, cy, rm, r_bead, count, ang, colors, outline=None, hl_alpha=110):
    """联珠纹：一排圆珠"""
    n_cols = len(colors)
    for k in range(count):
        a = ang + 2 * math.pi * k / count
        x, y = _xy(cx, cy, rm, a)
        col = colors[k % n_cols]
        draw.ellipse([x - r_bead, y - r_bead, x + r_bead, y + r_bead],
                     fill=col, outline=outline)
        hr = r_bead * 0.32
        hx, hy = x - r_bead * 0.38, y - r_bead * 0.38
        draw.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=(255, 246, 220, hl_alpha))


def draw_petals(draw, cx, cy, r_in, r_out, count, ang, color, outline,
                width=0.55, bend=0.0):
    """花瓣环：count 个花瓣均匀分布。width = 半宽占单元角的比例"""
    cell = 2 * math.pi / count
    half_w = cell * width / 2
    for k in range(count):
        base = ang + cell * k
        pts = petal_pts(r_in, r_out, half_w, bend=bend)
        xy = [_xy(cx, cy, r, a + base) for r, a in pts]
        draw.polygon(xy, fill=color, outline=outline)


def draw_lotus(draw, cx, cy, r_in, r_out, count, ang, cols, outline):
    """莲花：三层花瓣交错 + 花心 + 蕊"""
    cell = 2 * math.pi / count
    draw_petals(draw, cx, cy, r_in, r_out, count, ang, cols[0], outline, width=0.52)
    draw_petals(draw, cx, cy, r_in, r_out * 0.74, count, ang + cell / 2,
                cols[1], outline, width=0.55)
    draw_petals(draw, cx, cy, r_in, r_out * 0.48, count, ang,
                cols[2], outline, width=0.58)
    # 花心
    rr = r_out * 0.20
    cxr, cyr = _xy(cx, cy, 0, 0)
    draw.ellipse([cxr - rr, cyr - rr, cxr + rr, cyr + rr], fill=cols[2], outline=outline)
    # 蕊：放射状金点
    n_st = max(6, count // 2)
    for k in range(n_st):
        a = ang + 2 * math.pi * k / n_st
        x, y = _xy(cxr, cyr, rr * 0.55, a)
        sr = max(2.0, rr * 0.16)
        draw.ellipse([x - sr, y - sr, x + sr, y + sr], fill=cols[0])


def draw_tris(draw, cx, cy, r_in, r_out, count, ang, colors):
    """三角垂幔纹：正反交替三角"""
    cell = 2 * math.pi / count
    for k in range(count):
        a0 = ang + cell * k
        m = a0 + cell / 2
        col = colors[k % len(colors)]
        if k % 2 == 0:  # 顶点朝外
            xy = [_xy(cx, cy, r_in, a0), _xy(cx, cy, r_in, a0 + cell), _xy(cx, cy, r_out, m)]
        else:           # 顶点朝内
            xy = [_xy(cx, cy, r_out, a0), _xy(cx, cy, r_out, a0 + cell), _xy(cx, cy, r_in, m)]
        draw.polygon(xy, fill=col, outline=colors[(k + 1) % len(colors)])


def draw_zigzag(draw, cx, cy, r_in, r_out, count, ang, colors):
    """锯齿带"""
    cell = 2 * math.pi / count
    for k in range(count):
        a0 = ang + cell * k
        col = colors[k % len(colors)]
        xy = [_xy(cx, cy, r_in, a0), _xy(cx, cy, r_out, a0 + cell / 2),
              _xy(cx, cy, r_in, a0 + cell)]
        draw.polygon(xy, fill=col)


def draw_diamonds(draw, cx, cy, r_in, r_out, count, ang, colors):
    """菱格带（龟背纹）：竖菱形，顶点沿半径方向"""
    cell = 2 * math.pi / count
    rm = (r_in + r_out) / 2
    for k in range(count):
        a0 = ang + cell * k
        m = a0 + cell / 2
        col = colors[k % len(colors)]
        xy = [_xy(cx, cy, r_out, m), _xy(cx, cy, rm, a0 + cell * 0.18),
              _xy(cx, cy, r_in, m), _xy(cx, cy, rm, a0 + cell * 0.82)]
        draw.polygon(xy, fill=col, outline=colors[(k + 1) % len(colors)])


def draw_vine(draw, cx, cy, r_in, r_out, count, ang, color, outline, lw=11):
    """卷草纹：波状主茎 + 交替小叶 + 末端卷须螺旋"""
    cell = 2 * math.pi / count
    rm = (r_in + r_out) / 2
    half = (r_out - r_in) / 2
    n = 26
    for k in range(count):
        base = ang + cell * k
        # 波状主茎：极坐标 r = rm + half*sin(theta - base)
        pts = []
        for i in range(n + 1):
            th = base + cell * (i / n)
            r = rm + half * math.sin(th - base)
            pts.append(_xy(cx, cy, r, th))
        draw.line(pts, fill=color, width=lw, joint="curve")
        # 沿茎交替小叶
        for j in range(1, 5):
            ti = j / 5.0
            th = base + cell * ti
            r = rm + half * math.sin(th - base)
            px, py = _xy(cx, cy, r, th)
            sgn = 1 if j % 2 == 1 else -1
            la = th + sgn * 0.9
            for s in (-1, 1):
                a2 = la + s * 0.42
                L = half * 0.95
                tipx, tipy = px + L * math.cos(a2), py + L * math.sin(a2)
                bx, by = px + L * 0.45 * math.cos(la), py + L * 0.45 * math.sin(la)
                draw.polygon([(px, py), (bx, by), (tipx, tipy)], fill=color, outline=outline)
        # 末端卷须螺旋
        th_e = base + cell
        r_e = rm
        ex, ey = _xy(cx, cy, r_e, th_e)
        spiral = []
        turns = 2.2
        steps = 40
        for i in range(steps + 1):
            t = i / steps
            rr = lw * 1.5 * (1 - t * 0.85)
            aa = th_e + 1.2 + t * turns * 2 * math.pi
            spiral.append((ex + rr * math.cos(aa), ey + rr * math.sin(aa)))
        draw.line(spiral, fill=color, width=max(2, lw // 2), joint="curve")


def draw_leaf(draw, cx, cy, rm, size, count, ang, color, outline):
    """忍冬叶：掌状三瓣小叶"""
    cell = 2 * math.pi / count
    for k in range(count):
        base = ang + cell * k + cell / 2
        for s in (-1, 0, 1):
            a0 = base + s * 0.5
            pts = []
            steps = 8
            for i in range(steps + 1):
                t = i / steps
                r = rm + size * t
                w = size * 0.30 * math.sin(math.pi * t) ** 0.8
                pts.append(_xy(cx, cy, r, a0 - w / r))
            for i in range(steps, -1, -1):
                t = i / steps
                r = rm + size * t
                w = size * 0.30 * math.sin(math.pi * t) ** 0.8
                pts.append(_xy(cx, cy, r, a0 + w / r))
            draw.polygon(pts, fill=color, outline=outline)


# ---------------- 层定义 ----------------
# kind: beads / petals / lotus / tris / zigzag / diamonds / vine / leaf
# r_in/r_out 为 R_MAX 的比例；speed rad/s；zoom: (amp, period_s, phase)
def L(kind, r_in, r_out, speed, zoom, **kw):
    return dict(kind=kind, r_in=r_in, r_out=r_out, speed=speed, zoom=zoom, kw=kw)


def make_layers():
    Z = lambda amp, per, ph: (amp, per, ph)
    SP = (0.030, -0.050, 0.080, -0.120, 0.180)  # 统一转速 rad/s，方向交替
    return [
        # ---------- 样式 1：莲花藻井（土红/石绿/金） ----------
        [
            L("tris", 0.78, 1.00, SP[0], Z(0.03, 10, 0.0),
              count=38, colors=[RED, OCHRE, RED_D]),
            L("vine", 0.57, 0.78, SP[1], Z(0.06, 8, 1.3),
              count=10, color=GREEN, outline=GREEN_D, lw=14),
            L("petals", 0.40, 0.60, SP[2], Z(0.08, 12, 2.6),
              count=12, color=RED, outline=WHITE, width=0.42),
            L("petals", 0.26, 0.39, SP[3], Z(0.05, 9, 3.9),
              count=16, color=BLUE, outline=WHITE, width=0.46),
            L("lotus", 0.00, 0.28, SP[4], Z(0.10, 6.5, 5.2),
              count=8, cols=[GOLD, GOLD_L, RED], outline=RED_D),
        ],
        # ---------- 样式 2：宝相花（石青/金/白/红） ----------
        [
            L("diamonds", 0.78, 1.00, -SP[0], Z(0.03, 11, 0.7),
              count=26, colors=[BLUE, RED, WHITE]),
            L("petals", 0.55, 0.78, SP[1], Z(0.06, 9, 2.0),
              count=10, color=GOLD, outline=OCHRE, width=0.38),
            L("petals", 0.41, 0.57, -SP[2], Z(0.08, 13, 4.1),
              count=16, color=WHITE, outline=BLUE, width=0.40),
            L("beads", 0.30, 0.38, SP[3], Z(0.05, 7, 1.0),
              rm_override=0.34, r_bead=7.5, count=40,
              colors=[RED, GOLD], outline=RED_D),
            L("lotus", 0.00, 0.27, -SP[4], Z(0.10, 6.8, 3.3),
              count=10, cols=[RED, GOLD, GREEN], outline=GREEN_D),
        ],
        # ---------- 样式 3：卷草忍冬（赭石/绿/白/红） ----------
        [
            L("tris", 0.78, 1.00, SP[0], Z(0.03, 9.5, 2.2),
              count=42, colors=[GREEN, RED, GREEN_D]),
            L("vine", 0.58, 0.78, -SP[1], Z(0.06, 8.5, 0.4),
              count=8, color=OCHRE, outline=DARK, lw=15),
            L("leaf", 0.43, 0.58, SP[2], Z(0.08, 12.5, 5.0),
              rm_override=0.505, size=72, count=20,
              color=GREEN_L, outline=GREEN_D),
            L("petals", 0.26, 0.41, -SP[3], Z(0.05, 8.5, 2.9),
              count=12, color=WHITE, outline=GOLD, width=0.44),
            L("lotus", 0.00, 0.27, SP[4], Z(0.10, 6.2, 1.6),
              count=8, cols=[GOLD_L, GOLD, RED], outline=RED_D),
        ],
        # ---------- 样式 4：几何菱格（青/红/白/金） ----------
        [
            L("diamonds", 0.78, 1.00, SP[0], Z(0.03, 10.5, 4.4),
              count=22, colors=[BLUE, WHITE, RED]),
            L("zigzag", 0.62, 0.76, -SP[1], Z(0.06, 8.8, 3.1),
              count=34, colors=[RED, BLUE]),
            L("beads", 0.50, 0.585, SP[2], Z(0.05, 7.5, 5.6),
              rm_override=0.542, r_bead=8, count=64,
              colors=[GOLD, GOLD_L], outline=OCHRE),
            L("tris", 0.34, 0.48, -SP[3], Z(0.06, 9.8, 0.9),
              count=28, colors=[GREEN, WHITE, GREEN_D]),
            L("petals", 0.00, 0.28, SP[4], Z(0.11, 6.0, 2.4),
              count=10, color=BLUE, outline=GOLD_L, width=0.50),
        ],
    ]


# ---------------- 层绘制 ----------------
def draw_layer(canvas, spec, s_scale, t):
    """在 canvas 上以缩放 s_scale 绘制一层（径向缩放 + 角度偏移）"""
    draw = ImageDraw.Draw(canvas)
    kind = spec["kind"]
    kw = dict(spec["kw"])  # 拷贝，避免 pop 掉共享参数
    r_in = R_MAX * spec["r_in"] * s_scale
    r_out = R_MAX * spec["r_out"] * s_scale
    ang = spec["speed"] * t
    if kind == "beads":
        draw_beads(draw, CX, CY, kw.pop("rm_override") * R_MAX * s_scale,
                   kw.pop("r_bead") * s_scale, kw.pop("count"), ang,
                   kw.pop("colors"), kw.pop("outline", None))
    elif kind == "petals":
        draw_petals(draw, CX, CY, r_in, r_out, kw.pop("count"), ang,
                    kw.pop("color"), kw.pop("outline"), kw.pop("width", 0.55))
    elif kind == "lotus":
        draw_lotus(draw, CX, CY, r_in, r_out, kw.pop("count"), ang,
                   kw.pop("cols"), kw.pop("outline"))
    elif kind == "tris":
        draw_tris(draw, CX, CY, r_in, r_out, kw.pop("count"), ang, kw.pop("colors"))
    elif kind == "zigzag":
        draw_zigzag(draw, CX, CY, r_in, r_out, kw.pop("count"), ang, kw.pop("colors"))
    elif kind == "diamonds":
        draw_diamonds(draw, CX, CY, r_in, r_out, kw.pop("count"), ang, kw.pop("colors"))
    elif kind == "vine":
        draw_vine(draw, CX, CY, r_in, r_out, kw.pop("count"), ang,
                  kw.pop("color"), kw.pop("outline"), kw.pop("lw", 11))
    elif kind == "leaf":
        draw_leaf(draw, CX, CY, kw.pop("rm_override") * R_MAX * s_scale,
                  kw.pop("size") * s_scale, kw.pop("count"), ang,
                  kw.pop("color"), kw.pop("outline"))
    # 层缘细环线（跟随层缩放，模拟藻井叠涩分格）
    for rr in {round(r_in, 1), round(r_out, 1)}:
        draw.ellipse([CX - rr, CY - rr, CX + rr, CY + rr],
                     outline=(30, 20, 12, 130), width=2)


# ---------------- 背景（预渲染一次） ----------------
def build_background():
    """窟顶底色 + 做旧 + 固定八边形藻井框 + 上下装饰带 + 暗角"""
    bg = Image.new("RGBA", (W, H))
    arr = np.zeros((H, W, 3), dtype=np.float64)
    # 径向渐变（中心亮、四周暗）
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    d_n = np.clip(d / (0.75 * H), 0, 1)
    for i in range(3):
        arr[..., i] = BG_HI[i] * (1 - d_n) + BG_LO[i] * d_n
    # 云状斑驳（低频噪声）
    rng = random.Random(42)
    noise = np.zeros((H, W), dtype=np.float64)
    for _ in range(260):
        nx, ny = rng.uniform(0, W), rng.uniform(0, H)
        nr = rng.uniform(40, 220)
        amp = rng.uniform(-14, 10)
        dd = (xx - nx) ** 2 + (yy - ny) ** 2
        noise += amp * np.exp(-dd / (2 * nr * nr))
    for i in range(3):
        arr[..., i] += noise
    # 细斑点（壁画剥落）
    for _ in range(2600):
        sx, sy = rng.uniform(0, W), rng.uniform(0, H)
        sr = rng.uniform(1, 4.5)
        sa = rng.uniform(14, 60)
        x0, x1 = max(0, int(sx - sr * 2)), min(W, int(sx + sr * 2))
        y0, y1 = max(0, int(sy - sr * 2)), min(H, int(sy + sr * 2))
        patch = arr[y0:y1, x0:x1]
        patch[:, :, 0] = patch[:, :, 0] * (1 - sa / 255) + 60 * (sa / 255)
        patch[:, :, 1] = patch[:, :, 1] * (1 - sa / 255) + 44 * (sa / 255)
        patch[:, :, 2] = patch[:, :, 2] * (1 - sa / 255) + 32 * (sa / 255)
    # 裂纹（随机折线，深褐）
    crack = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(crack)
    for _ in range(46):
        px, py = rng.uniform(0, W), rng.uniform(0, H)
        pts = [(px, py)]
        a = rng.uniform(0, 2 * math.pi)
        for _s in range(rng.randint(3, 8)):
            a += rng.uniform(-0.9, 0.9)
            ln = rng.uniform(20, 90)
            px, py = px + ln * math.cos(a), py + ln * math.sin(a)
            pts.append((px, py))
        cd.line(pts, fill=(30, 20, 12, rng.randint(24, 60)), width=rng.randint(1, 3))
    bg = Image.alpha_composite(bg, Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA"))
    bg = Image.alpha_composite(bg, crack)

    # 中心柔光（仰视窟顶的灯光）
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(40, 0, -1):
        rr = i * 16
        gd.ellipse([CX - rr, CY - rr, CX + rr, CY + rr], fill=(255, 230, 170, 3))
    bg = Image.alpha_composite(bg, glow)

    # 固定八边形藻井外框（不旋转，模拟洞窟木构）
    R_FRAME = 585.0
    octo = []
    for k in range(8):
        a = math.pi / 8 + k * math.pi / 4  # 顶点朝上下左右
        octo.append(_xy(CX, CY, R_FRAME, a))
    octo_in = []
    for k in range(8):
        a = math.pi / 8 + k * math.pi / 4
        octo_in.append(_xy(CX, CY, R_FRAME - 26, a))
    frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.polygon(octo, fill=DARK + (255,))
    # 框内底色（稍亮的土黄）
    fd.polygon(octo_in, fill=BG_MID + (255,))
    # 框内环带：联珠 + 细线
    cxm, cym = CX, CY
    rm = R_FRAME - 60
    draw_beads(fd, cxm, cym, rm, 7, 40, 0.0, [WHITE, GOLD], outline=DARK)
    draw_beads(fd, cxm, cym, R_FRAME - 40, 4.5, 48, 0.0, [GOLD], outline=None)
    # 固定外环带（不旋转）：深色联珠 + 细线，填补框与旋转图案的空隙
    draw_beads(fd, cxm, cym, 495, 6, 44, 0.0, [OCHRE, GOLD], outline=DARK)
    for rr in (480, 510):
        fd.line([_xy(cxm, cym, rr, math.pi / 8 + k * math.pi / 4) for k in range(9)],
                fill=DARK + (200,), width=2)
    for rr, wd in ((R_FRAME - 14, 5), (R_FRAME - 22, 2), (R_FRAME - 34, 2), (R_FRAME - 70, 3)):
        fd.line([_xy(cxm, cym, rr, math.pi / 8 + k * math.pi / 4) for k in range(9)],
                fill=RED + (255,), width=wd)
    bg = Image.alpha_composite(bg, frame)

    # 上下装饰带：垂幔 + 菱格
    band = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bdr = ImageDraw.Draw(band)
    for yb, flip in ((0, 1), (H, -1)):
        y0 = yb if flip == 1 else yb - 300
        # 底带（深褐渐变）
        for i in range(300):
            al = 235 * (1 - i / 300) if flip == 1 else 235 * (i / 300)
            yy = yb + flip * i if flip == 1 else yb - i
            bdr.line([(0, yy), (W, yy)], fill=(58, 40, 26, int(al)))
        # 垂幔三角（朝画面中心）
        n_tri = 24
        tw = W / n_tri
        for k in range(n_tri):
            xa, xb = k * tw, (k + 1) * tw
            xm = (xa + xb) / 2
            y_deep = y0 + flip * 150
            col = [RED_D, OCHRE, GREEN_D][k % 3]
            bdr.polygon([(xa + 4, y0), (xb - 4, y0),
                         (xm, y_deep)], fill=col + (255,), outline=GOLD + (255,))
        # 菱格带
        for k in range(30):
            xa = k * (W / 30)
            bdr.polygon([(xa + 8, yb + flip * 236), (xa + W / 60, yb + flip * 258),
                         (xa + 8 + W / 30, yb + flip * 236),
                         (xa + W / 60, yb + flip * 214)],
                        outline=WHITE + (200,), width=3)
        # 金线
        bdr.line([(0, yb + flip * 300), (W, yb + flip * 300)], fill=GOLD + (255,), width=4)
    bg = Image.alpha_composite(bg, band)

    # 暗角
    vig = np.zeros((H, W), dtype=np.float64)
    dv = np.sqrt(((xx - CX) / (0.62 * W)) ** 2 + ((yy - CY) / (0.62 * H)) ** 2)
    vig = np.clip((dv - 0.55) / 0.75, 0, 1) ** 1.6
    varr = np.zeros((H, W, 4), dtype=np.uint8)
    varr[..., 0], varr[..., 1], varr[..., 2] = 20, 12, 8
    varr[..., 3] = (vig * 130).astype(np.uint8)
    bg = Image.alpha_composite(bg, Image.fromarray(varr, "RGBA"))
    return bg


# ---------------- 帧渲染 ----------------
LAYERS = make_layers()
STYLE_SEQ = [0, 1, 2, 3, 0, 1]


def style_state(t):
    """返回 (样式A, 样式B, 混合系数 p, 过渡中标记)。t 在切换点附近时返回两个样式"""
    k = int(t // SWITCH_INTERVAL)
    frac = (t - k * SWITCH_INTERVAL) / SWITCH_INTERVAL
    sa = STYLE_SEQ[min(k, len(STYLE_SEQ) - 1)]
    if frac * SWITCH_INTERVAL >= SWITCH_INTERVAL - TRANS and k + 1 < len(STYLE_SEQ):
        p = (t - (k + 1) * SWITCH_INTERVAL + TRANS) / TRANS
        sb = STYLE_SEQ[k + 1]
        return sa, sb, min(max(p, 0.0), 1.0), True
    return sa, sa, 0.0, False


def render_style(bg, si, t, s_extra, alpha_mul, rot_boost):
    """渲染一个样式到全画布，返回 RGBA 图像（整体 alpha 已乘 alpha_mul）"""
    layer_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for spec in LAYERS[si]:
        amp, period, ph = spec["zoom"]
        s = (1.0 + amp * math.sin(2 * math.pi * t / period + ph)) * s_extra
        # 旋转加速（过渡时“甩”的感觉）
        save_speed = spec["speed"]
        spec["speed"] = save_speed * rot_boost
        # 花瓣弯曲随时间摆动（扭曲感）
        if spec["kind"] == "petals":
            spec["kw"] = dict(spec["kw"], bend=0.35 * math.sin(2 * math.pi * t / 5.0 + ph))
        draw_layer(layer_img, spec, s, t)
        spec["speed"] = save_speed
        if spec["kind"] in ("petals", "lotus"):
            spec["kw"].pop("bend", None)
    # 整体 alpha
    if alpha_mul < 1.0:
        lut = [min(255, int(i * alpha_mul)) for i in range(256)]
        layer_img.putalpha(layer_img.getchannel("A").point(lut))
    return Image.alpha_composite(bg.copy(), layer_img)


def render_frame(t, bg):
    sa, sb, p, trans = style_state(t)
    g = 1.0 + 0.08 * math.sin(2 * math.pi * t / 14.0 + 1.0)  # 全局呼吸推进
    if trans:
        old = render_style(bg, sa, t, g * (1.0 + 0.25 * (1 - p)), 1.0 - p, 1.0 + 2.5 * (1 - p))
        new = render_style(bg, sb, t, g * (1.25 - 0.25 * p), p, 1.0 + 2.5 * p)
        frame = Image.alpha_composite(old, new)
        # 切换瞬间中心柔光脉冲
        pulse = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        pd = ImageDraw.Draw(pulse)
        a = int(70 * math.sin(math.pi * p))
        for i in range(30, 0, -1):
            rr = i * 22
            pd.ellipse([CX - rr, CY - rr, CX + rr, CY + rr], fill=(255, 236, 190, max(0, a) * 2))
        frame = Image.alpha_composite(frame, pulse)
    else:
        frame = render_style(bg, sa, t, g, 1.0, 1.0)
    return frame


def main():
    os.makedirs(FRAMES_DIR, exist_ok=True)
    print("预渲染背景...")
    bg = build_background()
    n_frames = int(FPS * DURATION)
    print(f"开始渲染 {n_frames} 帧 @{FPS}fps ...")
    for i in range(n_frames):
        t = i / FPS
        frame = render_frame(t, bg)
        frame.convert("RGB").save(os.path.join(FRAMES_DIR, f"{i:05d}.png"))
        if (i + 1) % 72 == 0 or i == n_frames - 1:
            print(f"  {i + 1}/{n_frames} 帧已渲染")
    print("帧渲染完成，合成视频...")
    cmd = [
        "ffmpeg", "-y", "-framerate", str(FPS),
        "-i", os.path.join(FRAMES_DIR, "%05d.png"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
        "-preset", "medium", "-movflags", "+faststart",
        OUT_VIDEO,
    ]
    subprocess.run(cmd, check=True)
    print(f"视频已生成: {OUT_VIDEO}")


if __name__ == "__main__":
    main()
