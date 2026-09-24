#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
庆余年2 大婚凤冠 —— 程序化 3D 建模 + 渲染
半透明琥珀金感光树脂材质 / 可 3D 打印（水密壳体）
运行: blender --background --python build_fengcrown.py -- [--preview]
"""
import bpy, bmesh, math, sys, os
import numpy as np
from mathutils import Vector

TAU = math.tau
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = "--preview" in argv
OUTDIR = os.path.dirname(os.path.abspath(__file__))

# ============================================================
# 场景重置
# ============================================================
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 0.01   # 1 BU = 1 cm

VERTS, FACES = [], []

def add_mesh(verts, faces):
    off = len(VERTS)
    VERTS.extend([tuple(map(float, v)) for v in verts])
    FACES.extend([[int(i) + off for i in f] for f in faces])

# ============================================================
# 基础几何生成器（全部输出封闭壳体，保证可打印）
# ============================================================
def uv_sphere(radius, seg=14, rings=9, scale=(1.0, 1.0, 1.0)):
    """标准 UV 球，极点在 ±Z，封闭流形。"""
    r = float(radius)
    verts = [(0.0, 0.0, r)]
    for ri in range(1, rings):
        phi = math.pi * ri / rings
        for s in range(seg):
            th = TAU * s / seg
            verts.append((r * math.sin(phi) * math.cos(th),
                          r * math.sin(phi) * math.sin(th),
                          r * math.cos(phi)))
    verts.append((0.0, 0.0, -r))
    bot = len(verts) - 1
    faces = []
    for s in range(seg):
        faces.append([0, 1 + (s + 1) % seg, 1 + s])
    for ri in range(rings - 2):
        a = 1 + ri * seg
        b = 1 + (ri + 1) * seg
        for s in range(seg):
            s2 = (s + 1) % seg
            faces.append([a + s, a + s2, b + s2, b + s])
    a = 1 + (rings - 2) * seg
    for s in range(seg):
        faces.append([a + s, a + (s + 1) % seg, bot])
    v = np.array(verts) * np.array(scale)
    return v.tolist(), faces

def add_sphere(center, radius, scale=(1, 1, 1), seg=14, rings=9):
    v, f = uv_sphere(radius, seg, rings, scale)
    v = np.array(v) + np.asarray(center, float)
    add_mesh(v, f)

def catmull_rom(cps, samples=10):
    """Catmull-Rom 样条采样，返回 (N,3)。"""
    P = np.asarray(cps, float)
    if len(P) == 2:
        t = np.linspace(0, 1, samples * 4)[:, None]
        return P[0] * (1 - t) + P[1] * t
    ext = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = ext[i], ext[i + 1], ext[i + 2], ext[i + 3]
        for s in range(samples):
            t = s / samples
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t +
                              (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-1])
    return np.array(out)

def rot_from_to(a, b):
    """旋转矩阵，把单位向量 a 转到 b。"""
    a = np.asarray(a, float); b = np.asarray(b, float)
    a /= np.linalg.norm(a); b /= np.linalg.norm(b)
    v = np.cross(a, b); c = float(np.dot(a, b))
    if c < -0.99999:
        return -np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx * (1.0 / (1.0 + c))

def sweep(points, radii, sides=10, cap=True, closed=False):
    """沿折线扫掠圆截面（平行传输标架），封闭管。closed=True 时首尾环相连。"""
    pts = np.asarray(points, float)
    n_orig = len(pts)
    # 去重
    keep = [0]
    for i in range(1, n_orig):
        if np.linalg.norm(pts[i] - pts[keep[-1]]) > 1e-7:
            keep.append(i)
    pts = pts[keep]
    n = len(pts)
    if n < 2:
        return
    if np.isscalar(radii):
        radii = np.full(n, float(radii))
    else:
        radii = np.asarray(radii, float)
        if len(radii) == n_orig:
            radii = radii[keep]
        elif len(radii) != n:
            # 长度不匹配时在采样点上线性插值
            radii = np.interp(np.linspace(0, 1, n),
                              np.linspace(0, 1, len(radii)), radii)
    tang = np.zeros_like(pts)
    tang[1:-1] = pts[2:] - pts[:-2]
    tang[0] = pts[1] - pts[0]
    tang[-1] = pts[-1] - pts[-2]
    tn = np.linalg.norm(tang, axis=1, keepdims=True)
    tn[tn < 1e-12] = 1.0
    tang /= tn
    t0 = tang[0]
    ref = np.array([0, 0, 1.0]) if abs(t0[2]) < 0.9 else np.array([1.0, 0, 0])
    nrm = ref - t0 * np.dot(ref, t0)
    nrm /= np.linalg.norm(nrm)
    rings = []
    for i in range(n):
        if i > 0:
            a, b = tang[i - 1], tang[i]
            axis = np.cross(a, b)
            s = np.linalg.norm(axis)
            if s > 1e-9:
                axis /= s
                ang = math.atan2(s, float(np.dot(a, b)))
                vx = np.array([[0, -axis[2], axis[1]],
                               [axis[2], 0, -axis[0]],
                               [-axis[1], axis[0], 0]])
                R = np.eye(3) + math.sin(ang) * vx + (1 - math.cos(ang)) * (vx @ vx)
                nrm = R @ nrm
            nrm = nrm - tang[i] * np.dot(nrm, tang[i])
            ln = np.linalg.norm(nrm)
            if ln < 1e-9:
                ref = np.array([0, 0, 1.0]) if abs(tang[i][2]) < 0.9 else np.array([1.0, 0, 0])
                nrm = ref - tang[i] * np.dot(ref, tang[i])
                ln = np.linalg.norm(nrm)
            nrm /= ln
        binorm = np.cross(tang[i], nrm)
        r = max(float(radii[i]), 1e-4)
        ring = []
        for k in range(sides):
            a = TAU * k / sides
            ring.append(pts[i] + r * (math.cos(a) * nrm + math.sin(a) * binorm))
        rings.append(ring)
    verts = [p for ring in rings for p in ring]
    faces = []
    for i in range(n - 1):
        a, b = i * sides, (i + 1) * sides
        for k in range(sides):
            k2 = (k + 1) % sides
            faces.append([a + k, a + k2, b + k2, b + k])
    if closed:
        a, b = (n - 1) * sides, 0
        for k in range(sides):
            k2 = (k + 1) % sides
            faces.append([a + k, a + k2, b + k2, b + k])
    elif cap:
        c0 = len(verts); verts.append(tuple(pts[0]))
        c1 = len(verts); verts.append(tuple(pts[-1]))
        for k in range(sides):
            k2 = (k + 1) % sides
            faces.append([c0, k2, k])
            faces.append([c1, (n - 1) * sides + k, (n - 1) * sides + k2])
    add_mesh(verts, faces)

def lathe(profile, seg=16):
    """绕 Z 轴旋转成型（profile: [(r,z)...]，r=0 处自动收极点）。"""
    verts, faces = [], []
    rings = []
    poles = {}
    n = len(profile)
    for i, (r, z) in enumerate(profile):
        if r < 1e-6:
            poles[i] = len(verts)
            verts.append((0.0, 0.0, float(z)))
            rings.append(None)
        else:
            ring = []
            for s in range(seg):
                a = TAU * s / seg
                ring.append(len(verts))
                verts.append((r * math.cos(a), r * math.sin(a), float(z)))
            rings.append(ring)
    for i in range(n - 1):
        ra, rb = rings[i], rings[i + 1]
        if ra is None and rb is None:
            continue
        if ra is None:
            for s in range(seg):
                faces.append([poles[i], rb[s], rb[(s + 1) % seg]])
        elif rb is None:
            for s in range(seg):
                faces.append([poles[i + 1], ra[(s + 1) % seg], ra[s]])
        else:
            for s in range(seg):
                s2 = (s + 1) % seg
                faces.append([ra[s], ra[s2], rb[s2], rb[s]])
    add_mesh(verts, faces)

def teardrop(length, radius, seg=14):
    """泪滴形吊坠（尖头朝 +Z）。"""
    L, R = float(length), float(radius)
    N = 12
    profile = []
    for i in range(N + 1):
        t = i / N
        r = R * (math.sin(math.pi * min(t * 1.18, 1.0)) ** 0.65) * (1 - 0.42 * t)
        profile.append((r, -L / 2 + L * t))
    lathe(profile, seg)

def leaf_mesh(length, width, thick, bend=0.0):
    """叶片/羽毛：沿 +Z 的透镜形，两端尖，可弯弧。"""
    v, f = uv_sphere(1.0, 12, 8)
    v = np.array(v)
    t = (v[:, 2] + 1) / 2                      # 0..1 沿长度
    taper = np.sin(math.pi * t) ** 0.72
    nx = v[:, 1] * width / 2 * taper           # 宽 -> X
    ny = v[:, 0] * thick / 2 * taper           # 厚 -> Y
    nz = v[:, 2] * length / 2                  # 长 -> Z
    nz = nz + bend * length * (np.sin(math.pi * t) ** 1.4)
    verts = np.stack([nx, ny, nz], axis=1)
    return verts, f

def add_leaf(root, direction, length, width, thick, bend=0.0, roll=0.0):
    """在 root 处沿 direction 放置一片叶子（宽面垂直于长度与参考上方向）。"""
    d = np.asarray(direction, float)
    d /= np.linalg.norm(d)
    up = np.array([0, 0, 1.0])
    h = np.cross(d, up)
    if np.linalg.norm(h) < 1e-6:
        h = np.array([1.0, 0, 0])
    h /= np.linalg.norm(h)
    t = np.cross(d, h)
    M = np.stack([h, t, d], axis=1)
    if abs(roll) > 1e-6:
        c, s = math.cos(roll), math.sin(roll)
        R = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
        M = M @ R
    v, f = leaf_mesh(length, width, thick, bend)
    v = v @ M.T + np.asarray(root, float)
    add_mesh(v, f)

def spiral_pts(center, normal, r0, r1, turns, n=44, phase=0.0):
    """平面螺旋线（卷草/云纹），法向为 normal。"""
    nrm = np.asarray(normal, float)
    nrm /= np.linalg.norm(nrm)
    ref = np.array([0, 0, 1.0]) if abs(nrm[2]) < 0.9 else np.array([1.0, 0, 0])
    u = np.cross(nrm, ref); u /= np.linalg.norm(u)
    v = np.cross(nrm, u)
    pts = []
    for i in range(n + 1):
        t = i / n
        ang = phase + turns * TAU * t
        r = r0 + (r1 - r0) * t
        pts.append(np.asarray(center, float) + r * (math.cos(ang) * u + math.sin(ang) * v))
    return pts

def add_tube_curve(ctrl, radius, samples=10, sides=8, cap=True):
    pts = catmull_rom(ctrl, samples)
    sweep(pts, radius, sides=sides, cap=cap)

# ============================================================
# 装饰构件
# ============================================================
def add_bead(center, radius, scale=(1, 1, 1), seg=12, rings=8):
    add_sphere(center, radius, scale, seg, rings)

def add_flower(center, normal, size, petals=6):
    """六瓣花：花瓣为小叶，中心珠。"""
    nrm = np.asarray(normal, float); nrm /= np.linalg.norm(nrm)
    ref = np.array([0, 0, 1.0]) if abs(nrm[2]) < 0.9 else np.array([1.0, 0, 0])
    u = np.cross(nrm, ref); u /= np.linalg.norm(u)
    v = np.cross(nrm, u)
    for i in range(petals):
        a = TAU * i / petals
        d = math.cos(a) * u + math.sin(a) * v
        add_leaf(np.asarray(center) + d * size * 0.55, d, size * 0.95,
                 size * 0.42, size * 0.16, bend=size * 0.12)
    add_bead(center, size * 0.26)

def scroll_unit(origin, X, Y, Z, size, flip=1, stem_r=0.10, phase=0.0):
    """
    卷草纹单元：S 形主茎 + 上下涡卷 + 叶片 + 中心珠。
    X: 面板横向, Z: 面板上向, Y: 面板法向。flip=-1 镜像。
    """
    O = np.asarray(origin, float)
    X = np.asarray(X, float); Y = np.asarray(Y, float); Z = np.asarray(Z, float)
    def M(p):
        p = np.asarray(p, float)
        if p.ndim == 1:
            return O + p[0] * X + p[1] * Y + p[2] * Z
        return O + p[:, 0:1] * X + p[:, 1:2] * Y + p[:, 2:3] * Z
    s = size
    # 主茎（S 形）
    stem = catmull_rom([(0, 0, 0),
                        (0.22 * s * flip, 0.04, 0.34 * s),
                        (-0.18 * s * flip, 0.06, 0.66 * s),
                        (0.02 * s * flip, 0.08, 1.0 * s)], 8)
    sweep(M(stem), stem_r * (1.15 - 0.35 * np.linspace(0, 1, len(stem))), sides=8)
    top = M((0.02 * s * flip, 0.08, 1.0 * s))
    bot = M((0, 0, 0))
    # 顶部双涡卷（向外翻）
    for k, sgn in enumerate((-1, 1)):
        c = top + sgn * 0.30 * s * flip * X + 0.02 * Y
        pts = spiral_pts(c, Y, 0.30 * s, 0.045 * s, 1.75, n=40,
                         phase=phase + (0 if sgn > 0 else math.pi * 0.9))
        sweep(M(pts), 0.085 * s ** 0.8 + 0.015, sides=7)
        add_bead(c, 0.09 * s + 0.02)
    # 底部双涡卷（向内卷）
    for sgn in (-1, 1):
        c = bot + sgn * 0.26 * s * flip * X - 0.16 * s * Z + 0.02 * Y
        pts = spiral_pts(c, Y, 0.24 * s, 0.04 * s, 1.6, n=36,
                         phase=phase + math.pi + (0 if sgn > 0 else 1.2))
        sweep(M(pts), 0.075 * s ** 0.8 + 0.015, sides=7)
        add_bead(c, 0.085 * s + 0.02)
    # 茎上叶片
    for t, sgn, ln in ((0.30, 1, 0.42), (0.52, -1, 0.38), (0.74, 1, 0.32)):
        idx = min(int(t * (len(stem) - 1)), len(stem) - 2)
        p0, p1 = stem[idx], stem[idx + 1]
        d = (p1 - p0); d = d / (np.linalg.norm(d) + 1e-9)
        side = np.cross(d, Y)
        side = side / (np.linalg.norm(side) + 1e-9) * sgn * flip
        ld = (d * 0.55 + side * 0.75)
        ld /= np.linalg.norm(ld)
        add_leaf(M(p0), ld, ln * s, ln * s * 0.34, ln * s * 0.10, bend=0.15 * s)
    # 中心珠
    add_bead(M((0, 0.02, 0.5 * s)), 0.11 * s + 0.02)

def build_dragon(origin, X, Y, Z, length=5.0, r=0.22, phase=0.0):
    """
    stylized 立体行龙：S 形身躯、双角、吻、四足爪、鬃刺、卷尾。
    X: 行进方向(头朝 +X), Z: 上, Y: 面板法向。
    """
    O = np.asarray(origin, float)
    X = np.asarray(X, float); Y = np.asarray(Y, float); Z = np.asarray(Z, float)
    def M(p):
        p = np.asarray(p, float)
        if p.ndim == 1:
            return O + p[0] * X + p[1] * Y + p[2] * Z
        return O + p[:, 0:1] * X + p[:, 1:2] * Y + p[:, 2:3] * Z
    n = 7
    spine = []
    for i in range(n):
        t = i / (n - 1)
        x = length * (t - 0.5)          # t=0 尾端, t=1 头端
        z = length * 0.24 * math.sin(t * math.pi * 1.25 + phase)
        y = 0.12 * math.sin(t * TAU + phase) * length * 0.1
        spine.append((x, y, z))
    pts = catmull_rom(spine, 9)
    ts = np.linspace(0, 1, len(pts))
    radii = r * (1.05 - 0.62 * (1 - ts) ** 1.6) + 0.025   # 头粗尾细
    sweep(M(pts), radii, sides=10)
    # 卷尾（尾端 t=0 处，在垂直于切线的平面内卷曲）
    tail_c = M(pts[0])
    tan = pts[1] - pts[0]; tan /= np.linalg.norm(tan)
    ref = np.array([0, 0, 1.0]) if abs(tan[2]) < 0.9 else np.array([1.0, 0, 0])
    u = np.cross(tan, ref); u /= np.linalg.norm(u)
    w = np.cross(tan, u)
    tpts = []
    for i in range(31):
        t = i / 30
        ang = phase + 1.4 * TAU * t
        rr = r * 0.9 * (1 - t) + 0.03
        tpts.append(tail_c + rr * (math.cos(ang) * u + math.sin(ang) * w))
    sweep(M(tpts), r * 0.5 * np.linspace(1, 0.25, 31) + 0.015, sides=7)
    # 头（+X 端）
    H = M(pts[-1])
    tanH = pts[-1] - pts[-2]; tanH /= np.linalg.norm(tanH)
    upH = Z - tanH * np.dot(Z, tanH)
    if np.linalg.norm(upH) < 1e-6:
        upH = Y - tanH * np.dot(Y, tanH)
    upH /= np.linalg.norm(upH)
    sideH = np.cross(tanH, upH)
    # 颅
    add_sphere(H + tanH * r * 0.35 + upH * r * 0.30, r * 1.05,
               scale=(1.15, 0.85, 0.8))
    # 吻部
    add_sphere(H + tanH * r * 1.25 + upH * r * 0.12, r * 0.72,
               scale=(1.5, 0.75, 0.55))
    # 鼻尖
    add_sphere(H + tanH * r * 1.85 + upH * r * 0.05, r * 0.30, scale=(1.2, 0.9, 0.7))
    # 双角（向后弯的叉角）
    for sgn in (-1, 1):
        hc = [H + upH * r * 0.55 + sideH * sgn * r * 0.45,
              H - tanH * r * 0.7 + upH * r * 1.15 + sideH * sgn * r * 0.55,
              H - tanH * r * 1.25 + upH * r * 1.75 + sideH * sgn * r * 0.42,
              H - tanH * r * 1.45 + upH * r * 2.05 + sideH * sgn * r * 0.22]
        add_tube_curve(M(hc), r * 0.34, samples=6, sides=6)
    # 眼
    for sgn in (-1, 1):
        add_sphere(H + tanH * r * 0.55 + sideH * sgn * r * 0.72 + upH * r * 0.42,
                   r * 0.22)
    # 眉须
    for sgn in (-1, 1):
        add_tube_curve(M([H + tanH * r * 0.9 + sideH * sgn * r * 0.5 + upH * r * 0.5,
                          H + tanH * r * 1.6 + sideH * sgn * r * 0.9 + upH * r * 0.75,
                          H + tanH * r * 2.0 + sideH * sgn * r * 1.15 + upH * r * 0.6]),
                      r * 0.16, samples=5, sides=6)
    # 颈部鬃刺
    for i in range(3):
        t = 0.72 + i * 0.11
        idx = min(int(t * (len(pts) - 1)), len(pts) - 2)
        p = M(pts[idx])
        tanp = pts[idx + 1] - pts[idx - 1]; tanp /= np.linalg.norm(tanp)
        up = Z - tanp * np.dot(Z, tanp)
        if np.linalg.norm(up) < 1e-6:
            up = Y
        up /= np.linalg.norm(up)
        add_leaf(p + up * r * 0.7, up - tanp * 0.4, r * 1.5, r * 0.5, r * 0.22)
    # 四肢（前二后二），带爪
    for t, sgn in ((0.78, 1), (0.70, -1), (0.38, 1), (0.28, -1)):
        idx = min(int(t * (len(pts) - 1)), len(pts) - 2)
        p = M(pts[idx])
        out = Y * sgn
        knee = p + out * r * 1.15 - Z * r * 0.55
        foot = knee + out * r * 0.35 - Z * r * 0.95
        add_tube_curve(M([p + out * r * 0.3, knee, foot]), r * 0.42, samples=5, sides=7)
        add_sphere(foot, r * 0.42, scale=(1.2, 1.0, 0.6))
        for cs in (-1, 0, 1):
            cd = tanH * 0.8 + out * cs * 0.45 - Z * 0.35
            cd /= np.linalg.norm(cd)
            sweep(M([foot, foot + cd * r * 0.55]), [r * 0.20, 0.015], sides=5)

def build_tassel2(top, length, sway=0.05):
    """流苏：帽 + 串珠绳 + 扁圆雕花牌 + 水滴坠（整体水密）。"""
    top = np.asarray(top, float)
    # 帽（在 top 处，两端收极点）
    prof = [(0.0, 0.36), (0.20, 0.33), (0.27, 0.18), (0.23, 0.04), (0.0, 0.0)]
    off = len(VERTS)
    lathe(prof, seg=12)
    for i in range(off, len(VERTS)):
        VERTS[i] = (VERTS[i][0] + top[0], VERTS[i][1] + top[1], VERTS[i][2] + top[2])
    L = float(length)
    # 绳
    ctrl = [top + np.array([0, 0, 0.02]),
            top + np.array([sway, 0.03, -L * 0.35]),
            top + np.array([-sway * 0.7, 0.05, -L * 0.7]),
            top + np.array([sway * 0.3, 0.04, -L])]
    add_tube_curve(ctrl, 0.055, samples=10, sides=6)
    # 珠
    for t, rr in ((0.10, 0.21), (0.20, 0.155), (0.30, 0.19)):
        p = top + np.array([sway * (1 - t), 0.04 * (1 - t), -L * t])
        add_bead(p, rr, seg=12, rings=8)
    # 扁圆雕花牌 ×2
    for t in (0.48, 0.70):
        p = top + np.array([sway * (1 - t) * 0.6, 0.03, -L * t])
        add_sphere(p, 0.40, scale=(1.0, 0.30, 1.25), seg=14, rings=9)
        # 牌面小花
        add_flower(p + np.array([0, 0.13, 0]), (0, 1, 0), 0.20)
        add_bead(p, 0.10, seg=10, rings=7)
    # 连接珠 + 水滴坠
    pb = top + np.array([sway * 0.2, 0.03, -L * 0.86])
    add_bead(pb, 0.17, seg=12, rings=8)
    td = top + np.array([sway * 0.3, 0.04, -L - 0.55])
    off = len(VERTS)
    teardrop(1.05, 0.30, seg=14)
    for i in range(off, len(VERTS)):
        VERTS[i] = (VERTS[i][0] + td[0], VERTS[i][1] + td[1], VERTS[i][2] + td[2])

# ============================================================
# 部件一：冠圈
# ============================================================
BAND_RX, BAND_RY = 8.0, 6.2
BAND_Z0 = -2.0

def band_h(th):
    d = abs((th - math.pi / 2 + math.pi) % TAU - math.pi)
    return 1.62 + 1.08 * math.exp(-(d / 0.55) ** 2) + 0.07 * math.sin(6 * th + 1.0)

def build_band():
    N, P = 140, 12
    rings = []
    for i in range(N):
        th = TAU * i / N
        cx, cy = BAND_RX * math.cos(th), BAND_RY * math.sin(th)
        nrm = np.array([BAND_RY * math.cos(th), BAND_RX * math.sin(th)])
        nrm /= np.linalg.norm(nrm)
        h = band_h(th)
        zc = BAND_Z0 + h / 2
        ring = []
        for k in range(P):
            a = TAU * k / P
            u = 0.16 * math.cos(a)
            z = zc + (h / 2) * math.sin(a)
            ring.append((cx + nrm[0] * u, cy + nrm[1] * u, z))
        rings.append(ring)
    verts = [p for ring in rings for p in ring]
    faces = []
    for i in range(N):
        a = i * P
        b = ((i + 1) % N) * P
        for k in range(P):
            k2 = (k + 1) % P
            faces.append([a + k, a + k2, b + k2, b + k])
    add_mesh(verts, faces)
    # 上沿 / 下沿管
    for dz, rr in ((None, 0.085), (BAND_Z0, 0.075)):
        pts = []
        for i in range(N):
            th = TAU * i / N
            cx, cy = BAND_RX * math.cos(th), BAND_RY * math.sin(th)
            z = band_h(th) + BAND_Z0 if dz is None else dz
            pts.append((cx, cy, z))
        sweep(pts, rr, sides=8, closed=True)
    # 顶沿珠（正面中央留空给拱板）
    for i in range(0, N, 10):
        th = TAU * i / N
        d = abs((th - math.pi / 2 + math.pi) % TAU - math.pi)
        if d < 0.62:
            continue
        cx, cy = BAND_RX * math.cos(th), BAND_RY * math.sin(th)
        add_bead((cx, cy, band_h(th) + BAND_Z0 + 0.02), 0.15, seg=12, rings=8)
    # 正面下沿垂珠短穗
    for deg in range(22, 159, 14):
        th = math.radians(deg)
        cx, cy = BAND_RX * math.cos(th), BAND_RY * math.sin(th)
        p0 = np.array([cx, cy, BAND_Z0 + 0.05])
        p1 = p0 + np.array([0.03, 0.02, -0.42])
        add_tube_curve([p0, (p0 + p1) / 2, p1], 0.045, samples=5, sides=6)
        add_bead(p1 + np.array([0, 0, -0.10]), 0.13, seg=10, rings=7)

# ============================================================
# 部件二：正面镂空拱板 + 龙凤卷草纹
# ============================================================
def yarch(x):
    return BAND_RY * math.sqrt(max(0.03, 1 - (x / BAND_RX) ** 2)) - 0.25

def build_front_panel():
    # 外拱 / 内拱
    xs = np.linspace(-3.8, 3.8, 27)
    outer = [(x, yarch(x), 0.5 + 4.4 * max(0, 1 - (x / 3.8) ** 2) ** 0.85) for x in xs]
    sweep(outer, 0.24, sides=12)
    xs2 = np.linspace(-2.6, 2.6, 23)
    inner = [(x, yarch(x) + 0.06, 0.7 + 3.2 * max(0, 1 - (x / 2.6) ** 2) ** 0.9) for x in xs2]
    sweep(inner, 0.15, sides=10)
    # 放射肋
    for rx_ in (-2.3, -1.15, 1.15, 2.3):
        p_in = np.array([rx_, yarch(rx_) + 0.06, 0.7 + 3.2 * max(0, 1 - (rx_ / 2.6) ** 2) ** 0.9])
        p_out = np.array([rx_, yarch(rx_), 0.5 + 4.4 * max(0, 1 - (rx_ / 3.8) ** 2) ** 0.85])
        mid = (p_in + p_out) / 2 + np.array([0, 0.28, 0])
        add_tube_curve([p_in, mid, p_out], 0.115, samples=8, sides=7)
    X = np.array([1.0, 0, 0]); Y = np.array([0, 1.0, 0]); Z = np.array([0, 0, 1.0])
    # 卷草纹填充（对称布局）
    scroll_unit((0, yarch(0) + 0.10, 0.95), X, Y, Z, 2.05, flip=1, stem_r=0.11, phase=0.3)
    scroll_unit((-1.55, yarch(-1.55) + 0.12, 0.75), X, Y, Z, 1.55, flip=-1, phase=1.1)
    scroll_unit((1.55, yarch(1.55) + 0.12, 0.75), X, Y, Z, 1.55, flip=1, phase=0.7)
    scroll_unit((-3.05, yarch(-3.05) + 0.14, 0.85), X, Y, Z, 1.15, flip=-1, phase=1.9)
    scroll_unit((3.05, yarch(3.05) + 0.14, 0.85), X, Y, Z, 1.15, flip=1, phase=1.5)
    # 拱肩小花
    for sx in (-1, 1):
        add_flower((sx * 2.3, yarch(sx * 2.3) + 0.30, 2.55), (0, 1, 0), 0.52)
        add_flower((sx * 3.55, yarch(sx * 3.55) + 0.28, 1.05), (0, 1, 0), 0.46)
    # 双侧行龙（沿拱攀爬，头朝上朝中）
    for sx in (-1, 1):
        base = np.array([sx * 2.15, yarch(sx * 2.15) + 0.10, 0.75])
        Xd = np.array([-sx * 0.55, 0, 1.0]); Xd /= np.linalg.norm(Xd)
        Zd = np.array([sx * 0.30, 0, 1.0]); Zd /= np.linalg.norm(Zd)
        Yd = np.cross(Xd, Zd); Yd /= np.linalg.norm(Yd)
        Zd = np.cross(Yd, Xd)
        build_dragon(base, Xd, Yd, Zd, length=3.1, r=0.155, phase=sx)
    # 拱顶栖凤座（云头）
    perch = np.array([0, yarch(0) - 0.1, 4.62])
    add_flower(perch + np.array([0, -0.15, 0.25]), (0, 1, 0.2), 0.85)
    for sx in (-1, 1):
        pts = spiral_pts(perch + np.array([sx * 0.5, -0.1, 0.1]), (0, 1, 0),
                         0.55, 0.08, 1.6, n=34, phase=sx * 1.2)
        sweep(pts, 0.10, sides=7)
    return perch

# ============================================================
# 部件三：顶部展翅凤鸟
# ============================================================
def build_phoenix(base):
    """base: 凤鸟栖座中心。凤朝 +Y（前方）。"""
    C = np.asarray(base, float) + np.array([0, -0.55, 0.85])   # 身体中心
    Yw = np.array([0, 1.0, 0]); Xw = np.array([1.0, 0, 0]); Zw = np.array([0, 0, 1.0])
    # 躯干（前倾）
    tilt = rot_from_to(np.array([0, 0, 1.0]), np.array([0, 0.35, 1.0]))
    v, f = uv_sphere(0.62, 18, 12, scale=(1.0, 0.72, 0.82))
    v = v @ tilt.T + C
    add_mesh(v, f)
    # 颈
    neck = catmull_rom([C + np.array([0, 0.30, 0.30]),
                        C + np.array([0, 0.62, 0.72]),
                        C + np.array([0, 0.78, 1.15])], 8)
    sweep(neck, [0.30, 0.26, 0.24], sides=10)
    # 头
    H = C + np.array([0, 0.86, 1.38])
    add_sphere(H, 0.40, scale=(1.0, 1.05, 0.92), seg=16, rings=10)
    # 喙（朝 +Y 的锥，基部收于极点埋入头部）
    beak_prof = [(0.0, -0.02), (0.17, 0.0), (0.14, 0.10), (0.05, 0.34), (0.0, 0.52)]
    off = len(VERTS)
    lathe(beak_prof, seg=12)
    Rb = rot_from_to(np.array([0, 0, 1.0]), np.array([0.12, 1.0, 0.18]))
    for i in range(off, len(VERTS)):
        p = np.array(VERTS[i]) @ Rb.T + H + np.array([0, 0.34, -0.02])
        VERTS[i] = tuple(p)
    # 眼
    for sgn in (-1, 1):
        add_sphere(H + np.array([sgn * 0.30, 0.16, 0.10]), 0.075, seg=10, rings=7)
    # 冠羽（三根后弯羽，带小叶尖）
    for i, (ln, ang) in enumerate(((0.85, 0.40), (1.10, 0.0), (0.85, -0.40))):
        d = np.array([math.sin(ang) * 0.5, -0.55, 1.0])
        d /= np.linalg.norm(d)
        pts = catmull_rom([H + np.array([0, -0.05, 0.32]),
                           H + d * ln * 0.5 + np.array([0, -0.1, 0.1]),
                           H + d * ln + np.array([0, -0.25, -0.15])], 8)
        sweep(pts, [0.075, 0.05, 0.018], sides=6)
        add_leaf(pts[-1], d, 0.35, 0.16, 0.06)
    # 翅膀：三排飞羽
    for sgn in (-1, 1):
        root = C + np.array([sgn * 0.55, 0.05, 0.35])
        # 肩羽隆起
        for j in range(3):
            add_sphere(root + np.array([sgn * (0.25 + j * 0.22), 0.15 - j * 0.08, 0.12 + j * 0.10]),
                       0.30 - j * 0.05, scale=(1.2, 0.8, 0.7), seg=12, rings=8)
        rows = [
            (4, 0.16, 0.42, 0.10),   # 排数, 长度系数, 宽系数, 前伸
            (5, 0.26, 0.48, 0.16),   # 中排
            (6, 0.40, 0.42, 0.22),   # 主飞羽
        ]
        for ri, (count, lscale, wscale, fwd) in enumerate(rows):
            for j in range(count):
                tj = j / (count - 1) if count > 1 else 0.5
                az = math.radians(45 - 105 * tj) - fwd
                el = math.radians(17 + 5 * tj) + ri * 2
                d = np.array([sgn * math.sin(az) * math.cos(el),
                              math.cos(az) * math.cos(el),
                              math.sin(el)])
                ln = lscale * (0.85 + 0.35 * tj) * 4.2
                rj = root + np.array([sgn * 0.12 * ri, -0.10 * ri, 0.16 * ri])
                add_leaf(rj + d * 0.15, d, ln, ln * wscale, 0.09, bend=0.10)
    # 长尾（四根，上扬后掠，带眼斑）
    for j, sgn in enumerate((-1, -0.35, 0.35, 1)):
        az = math.radians(8 + 10 * abs(sgn)) * (1 if sgn >= 0 else -1)
        el = math.radians(52 + 6 * abs(sgn))
        d = np.array([math.sin(az) * math.cos(el) * 0.9,
                      -math.cos(az) * math.cos(el) * 0.75,
                      math.sin(el)])
        d /= np.linalg.norm(d)
        ln = 3.8 + 1.1 * abs(sgn)
        tb = C + np.array([sgn * 0.18, -0.45, 0.30])
        mid = tb + d * ln * 0.45 + np.array([0, -0.15, 0.30])
        tip = tb + d * ln + np.array([0, -0.30, 0.45])
        pts = catmull_rom([tb, mid, tip], 10)
        sweep(pts, 0.075, sides=6)
        # 眼斑
        ep = tb + (tip - tb) * 0.62
        add_sphere(ep, 0.24, scale=(1.0, 0.55, 0.28), seg=12, rings=8)
        add_leaf(tb + (tip - tb) * 0.30, d, ln * 0.45, 0.30, 0.08)
    # 尾上覆羽
    for sgn in (-1, 1):
        d = np.array([sgn * 0.30, -0.55, 0.9])
        d /= np.linalg.norm(d)
        add_leaf(C + np.array([sgn * 0.2, -0.35, 0.45]), d, 2.2, 0.35, 0.08)

# ============================================================
# 部件四：两侧大翼板（镂空卷草 + 行龙）
# ============================================================
def panel_Y(x):
    ax = abs(x)
    if ax <= 8:
        return BAND_RY * math.sqrt(max(0.03, 1 - (ax / 8) ** 2))
    return 1.6 * math.exp(-((ax - 8) / 2.6) ** 2) + 0.15

# 翼板轮廓（局部 x-z 坐标，x>=0）
PANEL_TOP = [(3.6, 1.0), (4.9, 2.5), (6.4, 3.2), (8.0, 3.1), (9.4, 2.0),
             (10.4, 0.4), (11.05, -1.1), (11.35, -2.5)]
PANEL_BOT = [(11.35, -2.5), (10.9, -3.7), (9.4, -3.9), (7.9, -3.3), (6.3, -2.7),
             (4.8, -2.7), (3.6, -2.2)]

def panel_top_z(x):
    return float(np.interp(x, [p[0] for p in PANEL_TOP], [p[1] for p in PANEL_TOP]))

def panel_bot_z(x):
    return float(np.interp(x, [p[0] for p in PANEL_BOT], [p[1] for p in PANEL_BOT]))

def build_side_panel(s):
    def mp(x, z, dy=0.0):
        y = panel_Y(x) - 0.9 * max(0, (abs(x) - 8.5) / 2.6) ** 2 + dy
        return np.array([s * x, y, z])
    outline = PANEL_TOP + PANEL_BOT[1:]
    # 边缘框
    pts = [mp(x, z) for (x, z) in outline] + [mp(*outline[0])]
    sweep(pts, 0.22, sides=10, closed=True)
    # 边缘小连环卷
    for i, (x, z) in enumerate(outline[:-1]):
        x2, z2 = outline[i + 1]
        mx, mz = (x + x2) / 2, (z + z2) / 2
        pts = spiral_pts(mp(mx, mz, 0.12), (0, 1, 0), 0.28, 0.05, 1.5, n=26,
                         phase=i * 0.8)
        sweep(pts, 0.08, sides=6)
    # 主肋
    rib = [mp(4.2, 1.7, 0.05), mp(6.0, 2.1, 0.05), mp(8.0, 1.3, 0.05), mp(9.8, -0.5, 0.05)]
    add_tube_curve(rib, 0.14, samples=10, sides=8)
    X = np.array([1.0, 0, 0]); Y = np.array([0, 1.0, 0]); Z = np.array([0, 0, 1.0])
    # 卷云纹地毯：密集小螺旋 + 珠，填满整个翼板
    for ix in np.arange(4.1, 10.9, 0.85):
        zt, zb = panel_top_z(ix), panel_bot_z(ix)
        for iz in np.arange(zb + 0.6, zt - 0.35, 0.85):
            c = mp(ix, iz, 0.12)
            pts = spiral_pts(c, Y, 0.34, 0.045, 1.55, n=26,
                             phase=ix * 1.3 + iz * 2.1)
            sweep(pts, 0.068, sides=6)
            add_bead(c + Y * 0.02, 0.085, seg=10, rings=7)
    # 行龙（沿翼板）
    spine = [mp(4.6, 0.5, 0.14), mp(6.2, 1.3, 0.14), mp(8.0, 0.6, 0.14), mp(9.9, -1.3, 0.14)]
    Xd = np.array([1.0, 0, 0.25]); Xd /= np.linalg.norm(Xd)
    build_dragon(np.array(spine[0]), Xd, Y, Z, length=5.6, r=0.19, phase=s)
    # 大卷草单元（卷草纹层次感）
    scroll_unit(mp(5.6, 1.7, 0.18), X, Y, Z, 1.7, flip=1, stem_r=0.10, phase=0.5 * s)
    scroll_unit(mp(8.6, 1.4, 0.18), X, Y, Z, 1.5, flip=-1, stem_r=0.095, phase=1.3 * s)
    scroll_unit(mp(6.9, -1.5, 0.16), X, Y, Z, 1.3, flip=1, stem_r=0.09, phase=2.1 * s)
    scroll_unit(mp(9.7, -2.6, 0.16), X, Y, Z, 1.1, flip=-1, stem_r=0.085, phase=0.9 * s)
    # 花
    add_flower(mp(5.0, 2.7, 0.20), (0, 1, 0), 0.55)
    add_flower(mp(7.4, 2.6, 0.20), (0, 1, 0), 0.5)
    add_flower(mp(8.9, -3.0, 0.20), (0, 1, 0), 0.5)

# ============================================================
# 部件五：流苏 / 额前坠 / 背饰
# ============================================================
def build_all_tassels():
    # 长流苏：悬挂于两侧翼板下缘
    for s in (-1, 1):
        for k, x in enumerate((5.6, 6.35, 7.1, 7.85, 8.6)):
            z = -2.0 - 0.15 * (x - 5.6)
            top = np.array([s * x, panel_Y(x) - 0.55, z])
            build_tassel2(top, 6.2 + 0.55 * k + (0.4 if s > 0 else 0), sway=0.05 + 0.012 * k)
    # 短流苏：拱板两侧（面颊旁）
    for s in (-1, 1):
        for k, (x, z) in enumerate(((4.35, 0.35), (4.75, 0.05), (4.15, -0.15))):
            top = np.array([s * x, yarch(x) + 0.30, z])
            build_tassel2(top, 2.9 + 0.3 * k, sway=0.04)

def build_front_pendant():
    top = np.array([0, yarch(0) + 0.42, 4.30])
    add_tube_curve([top, top + np.array([0, 0.10, -0.55])], 0.06, samples=6, sides=6)
    add_bead(top + np.array([0, 0.12, -0.62]), 0.17, seg=12, rings=8)
    add_flower(top + np.array([0, 0.16, -1.15]), (0, 1, 0), 0.55)
    add_bead(top + np.array([0, 0.10, -1.75]), 0.20, seg=12, rings=8)
    td = top + np.array([0, 0.06, -2.45])
    off = len(VERTS)
    teardrop(1.0, 0.30, seg=14)
    for i in range(off, len(VERTS)):
        VERTS[i] = (VERTS[i][0] + td[0], VERTS[i][1] + td[1], VERTS[i][2] + td[2])
    # 额前小链（贴眉心）
    add_tube_curve([top + np.array([0, -0.05, 0.1]), top + np.array([0, -0.35, -0.25])],
                   0.05, samples=5, sides=6)

def build_back_ornament():
    c = np.array([0, -BAND_RY - 0.05, 0.4])
    add_flower(c, (0, -1, 0), 0.7)
    for sgn in (-1, 1):
        pts = spiral_pts(c + np.array([sgn * 0.55, 0, 0.15]), (0, -1, 0),
                         0.5, 0.07, 1.6, n=32, phase=sgn * 1.1)
        sweep(pts, 0.09, sides=7)
        add_bead(c + np.array([sgn * 0.55, 0, 0.15]), 0.12, seg=10, rings=7)

# ============================================================
# 装配
# ============================================================
import os
PARTS = set(os.environ.get("FC_PARTS", "band,front,phoenix,panel,tassels,pendant,back").split(","))
print("=== 开始构建凤冠 ===", flush=True)
if "band" in PARTS:
    build_band()
    print("冠圈完成", flush=True)
if "front" in PARTS:
    perch = build_front_panel()
    print("正面拱板完成", flush=True)
if "phoenix" in PARTS:
    build_phoenix(perch)
    print("凤鸟完成", flush=True)
if "panel" in PARTS:
    build_side_panel(1)
    build_side_panel(-1)
    print("侧翼完成", flush=True)
if "tassels" in PARTS:
    build_all_tassels()
    print("流苏完成", flush=True)
if "pendant" in PARTS:
    build_front_pendant()
    print("额坠完成", flush=True)
if "back" in PARTS:
    build_back_ornament()
    print("背饰完成", flush=True)

# ============================================================
# 生成网格对象 + 校验
# ============================================================
mesh = bpy.data.meshes.new("FengCrown")
mesh.from_pydata(VERTS, [], FACES)
mesh.update()
obj = bpy.data.objects.new("FengCrown_QingYunian2", mesh)
scene.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj
obj.select_set(True)

bm = bmesh.new()
bm.from_mesh(mesh)
boundary = sum(1 for e in bm.edges if len(e.link_faces) == 1)
nonman = sum(1 for e in bm.edges if len(e.link_faces) > 2)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(mesh)
bm.free()
mesh.update()
print(f"网格统计: 顶点数={len(mesh.vertices)} 面数={len(mesh.polygons)} "
      f"边界边={boundary} 非流形边={nonman}", flush=True)

# 缩放到米单位（1 BU = 1 cm → 0.01 m）
obj.scale = (0.01, 0.01, 0.01)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

# ============================================================
# 材质：半透明琥珀金感光树脂
# ============================================================
mat = bpy.data.materials.new("AmberResin")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]

def set_input(node, names, value):
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return True
    return False

set_input(bsdf, ["Base Color"], (1.0, 0.50, 0.10, 1.0))
set_input(bsdf, ["Roughness"], 0.15)
set_input(bsdf, ["IOR"], 1.47)
set_input(bsdf, ["Transmission Weight", "Transmission"], 0.62)
set_input(bsdf, ["Coat Weight", "Clearcoat"], 0.15)
set_input(bsdf, ["Coat Roughness", "Clearcoat Roughness"], 0.08)
set_input(bsdf, ["Subsurface Weight", "Subsurface"], 0.06)
# 体积吸收：薄处透亮、厚处深沉，珠宝光泽的关键
va = nt.nodes.new("ShaderNodeVolumeAbsorption")
va.inputs["Color"].default_value = (1.0, 0.48, 0.08, 1.0)
va.inputs["Density"].default_value = 0.35
nt.links.new(va.outputs["Volume"], nt.nodes["Material Output"].inputs["Volume"])
obj.data.materials.append(mat)

# ============================================================
# 灯光与影棚
# ============================================================
def add_light(name, type_, loc, energy, size, color=(1, 1, 1), target=(0, 0, 0)):
    ld = bpy.data.lights.new(name, type=type_)
    ld.energy = energy
    ld.color = color
    if type_ == 'AREA':
        ld.shape = 'DISK'
        ld.size = size
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    d = Vector(target) - Vector(loc)
    lo.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(lo)
    return lo

add_light("Key", 'AREA', (0.45, 0.62, 0.42), 85, 0.55, (1.0, 0.94, 0.84))
add_light("Rim", 'AREA', (-0.35, -0.62, 0.35), 110, 0.50, (0.85, 0.92, 1.0))
add_light("Fill", 'AREA', (-0.55, 0.45, 0.05), 30, 0.70, (1.0, 0.9, 0.78))
add_light("Front", 'AREA', (0.05, 0.80, -0.10), 25, 0.45, (1.0, 0.97, 0.9))
pl = bpy.data.lights.new("InnerGlow", type='POINT')
pl.energy = 0.6
pl.color = (1.0, 0.62, 0.25)
pl.shadow_soft_size = 0.05
plo = bpy.data.objects.new("InnerGlow", pl)
plo.location = (0, 0, 0.02)
scene.collection.objects.link(plo)

world = bpy.data.worlds.new("DarkWorld")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.012, 0.016, 1.0)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
scene.world = world

# ============================================================
# 相机与渲染
# ============================================================
cam_data = bpy.data.cameras.new("Camera")
cam_data.lens = 50
cam = bpy.data.objects.new("Camera", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

def look_at(o, target):
    d = Vector(target) - o.location
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

CENTER = (0, 0, -0.005)
VIEWS = {
    "front": (0.0, 0.62, 0.01),
    "side": (0.62, 0.0, 0.01),
    "45deg": (0.44, 0.44, 0.01),
    "top": (0.001, 0.0, 0.62),
}

# Cycles 设置
scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
gpu_ok = False
for ctype in ('METAL', 'CUDA', 'HIP', 'ONEAPI', 'OPTIX'):
    try:
        prefs.compute_device_type = ctype
        prefs.get_devices()
        found = False
        for d in prefs.devices:
            d.use = (d.type != 'CPU')
            found = found or (d.use and d.type == ctype)
        if found:
            gpu_ok = True
            print(f"使用 GPU 渲染: {ctype}", flush=True)
            break
    except Exception:
        continue
scene.cycles.device = 'GPU' if gpu_ok else 'CPU'
scene.cycles.samples = 48 if PREVIEW else 224
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.02
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.cycles.max_bounces = 12
scene.cycles.transmission_bounces = 8
scene.cycles.transparent_max_bounces = 12
scene.render.resolution_x = 800 if PREVIEW else 1600
scene.render.resolution_y = 600 if PREVIEW else 1200
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
try:
    scene.view_settings.look = 'AgX - Punchy'
except Exception:
    pass

os.makedirs(os.path.join(OUTDIR, "renders"), exist_ok=True)

if os.environ.get("FC_DIAG"):
    import bmesh as _bm
    _bmesh = _bm.new()
    _bmesh.from_mesh(mesh)
    _seen = set(); _comps = []
    for _v in _bmesh.verts:
        if _v.index in _seen: continue
        _stack=[_v]; _comp=[]; _seen.add(_v.index)
        while _stack:
            _cur=_stack.pop(); _comp.append(_cur)
            for _e in _cur.link_edges:
                _o=_e.other_vert(_cur)
                if _o.index not in _seen: _seen.add(_o.index); _stack.append(_o)
        _comps.append(_comp)
    _stray = []
    for _comp in _comps:
        _vs = np.array([tuple(_v.co) for _v in _comp])
        _c = _vs.mean(axis=0)
        if np.linalg.norm(_c) > 0.13 or len(_comp) < 40:
            _stray.append((np.linalg.norm(_c), len(_comp), _vs.min(axis=0), _vs.max(axis=0)))
    _stray.sort(key=lambda t: -t[0])
    print(f"DIAG: 组件数={len(_comps)} 离群={len(_stray)}", flush=True)
    for _d, _n, _mn, _mx in _stray[:20]:
        print(f"DIAG stray d={_d:.3f} n={_n} bbox=({_mn[0]:.3f},{_mn[1]:.3f},{_mn[2]:.3f})..({_mx[0]:.3f},{_mx[1]:.3f},{_mx[2]:.3f})", flush=True)
    _bmesh.free()

# 先保存模型文件（保证即使渲染出错也有产出）
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUTDIR, "fengcrown.blend"))
print("已保存 fengcrown.blend", flush=True)

# STL 导出（×10 → 1 单位 = 1mm）
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
try:
    bpy.ops.wm.stl_export(filepath=os.path.join(OUTDIR, "fengcrown.stl"),
                          export_selected_objects=True, global_scale=10.0)
except Exception as e:
    print("wm.stl_export 失败，尝试旧接口:", e, flush=True)
    bpy.ops.export_mesh.stl(filepath=os.path.join(OUTDIR, "fengcrown.stl"),
                           use_selection=True, global_scale=10.0)
print("已保存 fengcrown.stl", flush=True)

# GLB 导出（网页/手机端 360° 查看）
try:
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUTDIR, "fengcrown.glb"),
                              export_format='GLB')
    print("已保存 fengcrown.glb", flush=True)
except Exception as e:
    print("GLB 导出失败:", e, flush=True)

# 渲染四个视角
ONLY = None
for a in argv:
    if a.startswith("--only="):
        ONLY = a.split("=", 1)[1]
for name, loc in VIEWS.items():
    if ONLY and name != ONLY:
        continue
    cam.location = loc
    if name == "top":
        cam.rotation_euler = (0.0, 0.0, 0.0)
    else:
        look_at(cam, CENTER)
    scene.render.filepath = os.path.join(OUTDIR, "renders", f"render_{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"渲染完成: {name}", flush=True)

print("=== 全部完成 ===", flush=True)
