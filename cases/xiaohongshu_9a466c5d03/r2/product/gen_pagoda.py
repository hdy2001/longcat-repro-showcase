#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
应县木塔（佛宫寺释迦塔）Blender 程序化精准建模
辽清宁二年(1056) · 总高67.31m · 八角形平面 · 明五暗四共九重 · 内外两圈柱网
输出: yingxian_pagoda.blend + /tmp/pagoda.glb
"""
import bpy
import math
from math import cos, sin, pi, radians
from mathutils import Vector, Matrix

# ---------------- 清理场景 ----------------
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------------- 材质 ----------------
def make_mat(name, color, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m

M_WOOD  = make_mat("木构米黄",  (0.72, 0.58, 0.38), 0.62)          # 梁架/斗拱/楼板/平座
M_RED   = make_mat("柱红棕",    (0.40, 0.20, 0.12), 0.55)          # 柱子/栏杆
M_LATT  = make_mat("格子门窗",  (0.66, 0.50, 0.30), 0.60)          # 格子门/棂窗
M_ROOF  = make_mat("屋顶灰蓝",  (0.27, 0.35, 0.46), 0.45)          # 瓦面
M_RIDGE = make_mat("瓦当垂脊",  (0.22, 0.28, 0.36), 0.50)          # 瓦当/垂脊
M_STONE = make_mat("台基石",    (0.56, 0.55, 0.52), 0.90)          # 台基
M_IRON  = make_mat("刹铁",      (0.20, 0.21, 0.24), 0.35, 0.90)    # 塔刹/铁链
M_GOLD  = make_mat("佛像金",    (0.78, 0.60, 0.26), 0.30, 0.75)    # 佛像
M_DOOR  = make_mat("门板",      (0.58, 0.40, 0.22), 0.60)          # 隔扇门
MATS = [M_WOOD, M_RED, M_LATT, M_ROOF, M_RIDGE, M_STONE, M_IRON, M_GOLD, M_DOOR]
I_WOOD, I_RED, I_LATT, I_ROOF, I_RIDGE, I_STONE, I_IRON, I_GOLD, I_DOOR = range(9)

N = 8                       # 八角
CORNER = radians(22.5)      # 角柱方位角 22.5°+45°k（面朝四正四隅）
COL_ANG = [radians(7.5) + i * radians(15) for i in range(24)]   # 外槽24柱
IN_ANG  = [CORNER + k * pi / 4 for k in range(8)]               # 内槽8柱

def corner_factor(th):
    """角部起翘权重：角=1，面中=0"""
    return max(cos(8 * (th - (CORNER + k * pi / 4))) for k in range(8))

# ---------------- MeshBuilder ----------------
BOX_FACES = [(0, 3, 2, 1), (4, 5, 6, 7), (1, 2, 6, 5), (0, 4, 7, 3), (2, 3, 7, 6), (0, 1, 5, 4)]

class MB:
    def __init__(self):
        self.v = []; self.f = []; self.fm = []; self.fs = []
    def face(self, idx, mi, smooth=False):
        self.f.append(tuple(idx)); self.fm.append(mi); self.fs.append(smooth)
    def box8(self, corners, mi, smooth=False):
        base = len(self.v)
        self.v.extend([tuple(c) for c in corners])
        for fc in BOX_FACES:
            self.face([base + i for i in fc], mi, smooth)
    def add_box(self, cx, cy, cz, sx, sy, sz, rz=0.0, ry=0.0, rx=0.0, mi=I_WOOD, smooth=False):
        R = Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X')
        ctr = Vector((cx, cy, cz))
        cs = []
        for dx in (-1, 1):
            for dy in (-1, 1):
                for dz in (-1, 1):
                    cs.append(R @ Vector((dx * sx / 2, dy * sy / 2, dz * sz / 2)) + ctr)
        self.box8(cs, mi, smooth)
    def beam(self, p1, p2, w, h, mi=I_WOOD, smooth=False):
        p1, p2 = Vector(p1), Vector(p2)
        d = p2 - p1
        if d.length < 1e-6:
            return
        d.normalize()
        side = d.cross(Vector((0, 0, 1)))
        if side.length < 1e-6:
            side = Vector((1, 0, 0))
        side.normalize()
        up = side.cross(d).normalized()
        cs = []
        for p in (p1, p2):
            for s in (-1, 1):
                for u in (-1, 1):
                    cs.append(p + side * (s * w / 2) + up * (u * h / 2))
        self.box8(cs, mi, smooth)
    def cyl(self, cx, cy, cz, r, h, n=12, rz=0.0, ry=0.0, rx=0.0, r2=None, mi=I_RED, smooth=True, caps=True):
        r2 = r if r2 is None else r2
        R = Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X')
        ctr = Vector((cx, cy, cz))
        base = len(self.v)
        for i in range(n):
            a = 2 * pi * i / n
            self.v.append(tuple(R @ Vector((r * cos(a), r * sin(a), -h / 2)) + ctr))
        for i in range(n):
            a = 2 * pi * i / n
            self.v.append(tuple(R @ Vector((r2 * cos(a), r2 * sin(a), h / 2)) + ctr))
        for i in range(n):
            j = (i + 1) % n
            self.face([base + i, base + j, base + n + j, base + n + i], mi, smooth)
        if caps:
            self.face([base + n + i for i in range(n)], mi, False)
            self.face([base + i for i in reversed(range(n))], mi, False)
    def rod(self, p1, p2, r, n=6, mi=I_IRON):
        p1, p2 = Vector(p1), Vector(p2)
        d = p2 - p1
        L = d.length
        if L < 1e-6:
            return
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        R = q.to_matrix().to_4x4()
        ctr = (p1 + p2) / 2
        base = len(self.v)
        for i in range(n):
            a = 2 * pi * i / n
            self.v.append(tuple(R @ Vector((r * cos(a), r * sin(a), -L / 2)) + ctr))
        for i in range(n):
            a = 2 * pi * i / n
            self.v.append(tuple(R @ Vector((r * cos(a), r * sin(a), L / 2)) + ctr))
        for i in range(n):
            j = (i + 1) % n
            self.face([base + i, base + j, base + n + j, base + n + i], mi, True)
        self.face([base + n + i for i in range(n)], mi, False)
        self.face([base + i for i in reversed(range(n))], mi, False)
    def torus(self, cx, cy, cz, R, r, nmaj=28, nmin=8, rz=0.0, mi=I_IRON):
        base = len(self.v)
        for i in range(nmaj):
            a = 2 * pi * i / nmaj
            for j in range(nmin):
                b = 2 * pi * j / nmin
                p = Vector(((R + r * cos(b)) * cos(a), (R + r * cos(b)) * sin(a), r * sin(b)))
                self.v.append(tuple(Matrix.Rotation(rz, 4, 'Z') @ p + Vector((cx, cy, cz))))
        for i in range(nmaj):
            for j in range(nmin):
                self.face([base + i * nmin + j,
                           base + ((i + 1) % nmaj) * nmin + j,
                           base + ((i + 1) % nmaj) * nmin + (j + 1) % nmin,
                           base + i * nmin + (j + 1) % nmin], mi, True)
    def sphere(self, cx, cy, cz, r, nu=14, nv=8, mi=I_GOLD):
        base = len(self.v)
        for j in range(nv + 1):
            phi = pi * j / nv
            for i in range(nu):
                th = 2 * pi * i / nu
                self.v.append((cx + r * sin(phi) * cos(th), cy + r * sin(phi) * sin(th), cz + r * cos(phi)))
        def idx(i, j):
            return base + j * nu + i % nu
        for j in range(nv):
            for i in range(nu):
                self.face([idx(i, j), idx(i, j + 1), idx(i + 1, j + 1), idx(i + 1, j)], mi, True)

    # ---- 八角棱柱（实心或环带）----
    def oct_prism(self, z0, z1, r_out, r_in=None, mi=I_STONE):
        r_in = 0.0 if r_in is None else r_in
        base = len(self.v)
        if r_in <= 0:  # 实心: [外z0(8), 外z1(8)]
            for z in (z0, z1):
                for k in range(N):
                    a = CORNER + k * pi / 4
                    self.v.append((r_out * cos(a), r_out * sin(a), z))
            self.face([base + 8 + k for k in range(N)], mi, False)              # 顶
            self.face([base + k for k in reversed(range(N))], mi, False)       # 底
            for k in range(N):
                k1 = (k + 1) % N
                self.face([base + k, base + k1, base + 8 + k1, base + 8 + k], mi, False)
        else:  # 环带: [外z0, 内z0, 外z1, 内z1]
            for z in (z0, z1):
                for k in range(N):
                    a = CORNER + k * pi / 4
                    self.v.append((r_out * cos(a), r_out * sin(a), z))
                for k in range(N):
                    a = CORNER + k * pi / 4
                    self.v.append((r_in * cos(a), r_in * sin(a), z))
            for k in range(N):
                k1 = (k + 1) % N
                self.face([base + 16 + k, base + 16 + k1, base + 24 + k1, base + 24 + k], mi, False)  # 顶环
                self.face([base + k1, base + k, base + 8 + k, base + 8 + k1], mi, False)              # 底环
                self.face([base + k, base + 16 + k, base + 16 + k1, base + k1], mi, False)             # 外壁
                self.face([base + 8 + k1, base + 24 + k1, base + 24 + k, base + 8 + k], mi, False)    # 内壁
    def oct_ring_beam(self, z, r_mid, width, height, mi=I_RED):
        """八边形环梁（8根弦杆）"""
        chord = 2 * r_mid * sin(pi / N)
        for k in range(N):
            a = CORNER + pi / N + k * pi / 4   # 边中点方位
            self.add_box(r_mid * cos(a), r_mid * sin(a), z, chord + 0.35, width, height, rz=a + pi / 2, mi=mi)

    # ---- 斗拱铺作（双杪双昂，局部+X朝外）----
    def bracket(self, x, y, z0, rz, s=1.0):
        def box(lx, ly, lz, sx, sy, sz, ry=0.0, mi=I_WOOD):
            R = Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y')
            p = R @ Vector((lx * s, ly * s, lz * s)) + Vector((x, y, z0))
            self.add_box(p.x, p.y, p.z, sx * s, sy * s, sz * s, rz=rz, ry=ry, mi=mi)
        box(0, 0, 0.11, 0.34, 0.34, 0.22)                 # 栌斗
        box(0.28, 0, 0.30, 0.85, 0.22, 0.18)               # 华拱一跳
        box(0.28, 0, 0.41, 0.20, 0.78, 0.16)               # 横拱
        box(0.28, 0.27, 0.52, 0.15, 0.15, 0.10)            # 散斗
        box(0.28, -0.27, 0.52, 0.15, 0.15, 0.10)
        box(0.52, 0, 0.56, 1.05, 0.22, 0.18)               # 华拱二跳
        box(0.52, 0, 0.67, 0.20, 0.98, 0.16)               # 横拱
        box(0.52, 0.40, 0.78, 0.15, 0.15, 0.10)            # 散斗
        box(0.52, -0.40, 0.78, 0.15, 0.15, 0.10)
        box(0.55, 0, 0.90, 1.10, 0.18, 0.17, ry=0.40)      # 下昂（斜向下出跳）
        box(0.78, 0, 1.02, 0.15, 0.15, 0.10)               # 交互斗
        box(0.42, 0, 1.04, 0.85, 0.18, 0.15)               # 耍头
        box(0.72, 0, 1.12, 0.62, 0.16, 0.12)               # 衬方头
        box(0.95, 0, 1.08, 0.18, 0.66, 0.13)               # 令拱
        box(0.95, 0.26, 1.17, 0.13, 0.13, 0.09)            # 散斗
        box(0.95, -0.26, 1.17, 0.13, 0.13, 0.09)
        box(1.00, 0, 1.22, 0.50, 0.16, 0.13)               # 撩檐槫

    # ---- 屋顶（瓦垄+起翘+瓦当+垂脊）----
    def roof_point(self, P, th, t):
        r_e, z_e, r_t, z_t, curl = P
        u = 1.0 - t
        r = r_e + (r_t - r_e) * t
        z = z_e + (z_t - z_e) * t
        cf = corner_factor(th)
        z += curl * (u ** 2.6) * (0.55 + 1.3 * max(cf, 0.0) ** 2)
        return r, z
    def roof(self, P, n_per_side=12, steps=12, thick=0.10, rib_amp=0.065,
             wadang=True, hips=True, mat_roof=I_ROOF, mat_ridge=I_RIDGE):
        r_e, z_e, r_t, z_t, curl = P
        n_ang = N * n_per_side
        def pt(i, j, top=True):
            th = 2 * pi * i / n_ang
            t = j / steps
            r, z = self.roof_point(P, th, t)
            z += rib_amp * (0.5 - 0.5 * cos(n_ang * th)) * (0.55 + 0.45 * (1 - t))
            if not top:
                z -= thick
            return (r * cos(th), r * sin(th), z)
        base = len(self.v)
        for j in range(steps + 1):
            for i in range(n_ang):
                self.v.append(pt(i, j))
        def idx(i, j):
            return base + j * n_ang + i % n_ang
        for j in range(steps):
            for i in range(n_ang):
                self.face([idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)], mat_roof, False)
        base2 = len(self.v)
        for j in range(steps + 1):
            for i in range(n_ang):
                self.v.append(pt(i, j, top=False))
        def idx2(i, j):
            return base2 + j * n_ang + i % n_ang
        for j in range(steps):
            for i in range(n_ang):
                self.face([idx2(i, j + 1), idx2(i + 1, j + 1), idx2(i + 1, j), idx2(i, j)], mat_roof, False)
        for i in range(n_ang):
            am = 2 * pi * (i + 0.5) / n_ang
            ro, zo = 2 * r_e * cos(am), z_e - 0.05
            self.face([idx(i, 0), idx2(i, 0), idx2(i + 1, 0), idx(i + 1, 0)], mat_ridge, False)   # 檐口缘
            rt = 2 * r_t * cos(am)
            self.face([idx(i, steps), idx(i + 1, steps), idx2(i + 1, steps), idx2(i, steps)], mat_ridge, False)  # 顶缘
        if wadang:
            for k in range(n_ang):
                th = 2 * pi * (k + 0.5) / n_ang
                r, z = self.roof_point(P, th, 0.0)
                cx, cy = (r + 0.07) * cos(th), (r + 0.07) * sin(th)
                self.cyl(cx, cy, z + 0.02, 0.085, 0.055, n=6, rz=th, ry=pi / 2, mi=mat_ridge)
        if hips:
            for k in range(N):
                th = CORNER + k * pi / 4
                pts = []
                for j in range(steps + 1):
                    t = j / steps
                    r, z = self.roof_point(P, th, t)
                    pts.append(((r + 0.05) * cos(th), (r + 0.05) * sin(th), z + 0.09))
                for a, b in zip(pts, pts[1:]):
                    self.beam(a, b, 0.17, 0.15, mi=mat_ridge)

# ---------------- 分组与尺寸数据 ----------------
GROUPS = {i: [] for i in range(18)}
def emit(mb, name, gi):
    me = bpy.data.meshes.new(name)
    me.from_pydata(mb.v, [], mb.f)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for m in MATS:
        me.materials.append(m)
    for i, p in enumerate(me.polygons):
        p.material_index = mb.fm[i]
        p.use_smooth = mb.fs[i]
    GROUPS[gi].append(ob)
    return ob

# 明层: (名称, z底, z顶, 外柱半径, 内柱半径, 佛像高)
MING = [
    ("明层一", 0.9, 8.1, 11.9, 4.6, 4.4),
    ("明层二", 12.6, 18.9, 11.0, 4.3, 3.0),
    ("明层三", 23.2, 29.1, 10.1, 4.0, 2.8),
    ("明层四", 33.2, 38.7, 9.2, 3.7, 2.8),
    ("明层五", 42.6, 48.1, 8.4, 3.4, 2.8),
]
# 暗层: (名称, z底, z顶, 外柱半径, 内柱半径)
AND = [
    ("暗层一", 8.1, 12.6, 11.0, 4.3),
    ("暗层二", 18.9, 23.2, 10.1, 4.0),
    ("暗层三", 29.1, 33.2, 9.2, 3.7),
    ("暗层四", 38.7, 42.6, 8.4, 3.4),
]
# 檐: (名称, r檐口, r斗拱, z斗拱底, 朵数, 缩放, r顶, z顶, 起翘)
EAVES = [
    ("副阶檐", 15.14, 13.00, 5.20, 48, 1.15, 12.05, 7.50, 0.70),
    ("一层檐", 14.00, 12.35, 8.40, 48, 1.05, 11.15, 10.72, 0.65),
    ("二层檐", 13.00, 11.35, 19.20, 44, 1.00, 10.25, 21.35, 0.60),
    ("三层檐", 12.00, 10.35, 29.40, 40, 0.95, 9.35, 31.44, 0.55),
    ("四层檐", 11.00, 9.35, 39.00, 36, 0.90, 8.55, 40.97, 0.50),
    ("五层檐", 9.90, 8.25, 48.40, 32, 0.85, 7.60, 50.16, 0.45),
]
TOP = ("攒尖顶", 8.75, 50.30, 0.85, 56.70, 1.10)  # r口, z口, r顶, z顶, 起翘
FLOOR_H = 0.22   # 楼板厚

# ================= 建模 =================
# ---------- L00 台基 ----------
mb = MB()
mb.oct_prism(0.0, 0.45, 16.9, mi=I_STONE)
mb.oct_prism(0.45, 0.90, 16.0, mi=I_STONE)
emit(mb, "L00_台基", 0)

# ---------- L01 副阶（围廊 + 副阶檐）----------
mb = MB()
r_fj = 12.6
for a in COL_ANG:
    mb.cyl(r_fj * cos(a), r_fj * sin(a), 0.9 + 2.15, 0.30, 4.3, n=14, mi=I_RED)
mb.oct_ring_beam(4.35, r_fj, 0.28, 0.50, mi=I_WOOD)   # 阑额
r_p = r_fj - 0.12
d_bay = 2 * r_fj * sin(radians(7.5))
for i in range(24):
    am = COL_ANG[i] + radians(7.5)
    door = i in (23, 5, 11, 17)
    z0, z1 = 1.0, 4.35
    w = d_bay - 0.62
    if door:
        op = r_p - 0.02
        ow = 1.8
        for sgn in (-1, 1):  # 门梃 + 门楣
            jx = op * cos(am) - sgn * (ow / 2) * sin(am)
            jy = op * sin(am) + sgn * (ow / 2) * cos(am)
            mb.add_box(jx, jy, (z0 + z1) / 2, 0.12, 0.10, z1 - z0, rz=am, mi=I_WOOD)
        mb.add_box(op * cos(am), op * sin(am), z1 - 0.08, ow + 0.12, 0.10, 0.16, rz=am, mi=I_WOOD)
    else:
        for frac in (0.2, 0.4, 0.6, 0.8):
            mb.add_box(r_p * cos(am), r_p * sin(am), z0 + (z1 - z0) * frac, w - 0.1, 0.06, 0.055, rz=am, mi=I_LATT)
        for frac in (0.15, 0.85):
            mb.add_box(r_p * cos(am), r_p * sin(am), z0 + (z1 - z0) * frac, 0.07, 0.07, z1 - z0 - 0.2, rz=am, mi=I_LATT)
nm, r_e, r_b, z_b, ns, bs, r_t, z_t, curl = EAVES[0]
for j in range(ns):
    th = radians(7.5) + j * radians(7.5)
    mb.bracket(r_b * cos(th), r_b * sin(th), z_b, th, s=bs)
for k in range(96):
    th = 2 * pi * (k + 0.5) / 96
    mb.beam(((r_b + 0.3) * cos(th), (r_b + 0.3) * sin(th), z_b + 1.1),
            ((r_e + 0.12) * cos(th), (r_e + 0.12) * sin(th), z_b + 1.55), 0.10, 0.09, mi=I_WOOD)
P = (r_e, z_b + bs * 1.3 + 0.05, r_t, z_t, curl)
mb.roof(P)
emit(mb, "L01_副阶_围廊斗拱檐", 1)

# ---------- 明层 + 平座 + 檐 + 暗层 ----------
def build_ming(idx, name, z0, z1, r_out, r_in, buddha_h):
    gi_m = 2 + idx * 3          # 明层组号
    gi_e = gi_m + 1            # 檐组号
    mb = MB()
    # 外槽24柱
    for a in COL_ANG:
        mb.cyl(r_out * cos(a), r_out * sin(a), (z0 + z1) / 2, 0.34 if idx == 0 else 0.30,
               z1 - z0, n=14, mi=I_RED)
    # 内槽8柱
    for a in IN_ANG:
        mb.cyl(r_in * cos(a), r_in * sin(a), (z0 + z1) / 2, 0.30, z1 - z0, n=14, mi=I_RED)
    # 阑额/普拍方/内槽阑额
    mb.oct_ring_beam(z1 - 0.60, r_out, 0.30, 0.55, mi=I_WOOD)
    mb.oct_ring_beam(z1 - 0.10, r_out, 0.36, 0.16, mi=I_WOOD)
    mb.oct_ring_beam(z1 - 0.50, r_in, 0.26, 0.42, mi=I_WOOD)
    # 格子门（24间，4面设门）
    r_p = r_out - 0.12
    d_bay = 2 * r_out * sin(radians(7.5))
    door_ys = {23, 5, 11, 17}
    for i in range(24):
        am = COL_ANG[i] + radians(7.5)
        pz0, pz1 = z0 + 0.50, z1 - 0.85
        w = d_bay - 0.62
        if i in door_ys:
            op = r_p
            ow = 1.7
            for sgn in (-1, 1):  # 门梃 + 门楣
                jx = op * cos(am) - sgn * (ow / 2) * sin(am)
                jy = op * sin(am) + sgn * (ow / 2) * cos(am)
                mb.add_box(jx, jy, (pz0 + pz1) / 2, 0.14, 0.12, pz1 - pz0, rz=am, mi=I_LATT)
            mb.add_box(op * cos(am), op * sin(am), pz1 - 0.10, ow + 0.14, 0.12, 0.20, rz=am, mi=I_LATT)
            for sgn in (-1, 1):  # 两扇隔扇门虚掩
                hinge = Vector((op * cos(am) - sgn * (ow / 2) * sin(am),
                                op * sin(am) + sgn * (ow / 2) * cos(am), 0))
                R = Matrix.Rotation(am + sgn * radians(24), 4, 'Z')
                ctr = hinge + R @ Vector((ow / 2, 0, 0))
                mb.add_box(ctr.x, ctr.y, (pz0 + pz1) / 2, ow, 0.05, pz1 - pz0 - 0.15,
                           rz=am + sgn * radians(24), mi=I_DOOR)
        else:
            for frac in (0.18, 0.36, 0.54, 0.72, 0.90):
                mb.add_box(r_p * cos(am), r_p * sin(am), pz0 + (pz1 - pz0) * frac,
                           w - 0.08, 0.06, 0.055, rz=am, mi=I_LATT)
            for frac in (0.25, 0.5, 0.75):
                mb.add_box(r_p * cos(am), r_p * sin(am), pz0 + (pz1 - pz0) * frac,
                           0.065, 0.065, (pz1 - pz0) * 0.16, rz=am, mi=I_LATT)
    # 梁架（8根放射梁 + 内外环梁）
    zb = z0 - 0.55
    for a in IN_ANG:
        mb.beam(((r_in - 0.5) * cos(a), (r_in - 0.5) * sin(a), zb),
                ((r_out + 0.15) * cos(a), (r_out + 0.15) * sin(a), zb), 0.34, 0.50, mi=I_WOOD)
    mb.oct_ring_beam(zb, r_in, 0.28, 0.42, mi=I_WOOD)
    mb.oct_ring_beam(zb, r_out, 0.30, 0.46, mi=I_WOOD)
    # 楼板
    mb.oct_prism(z0 - FLOOR_H, z0, r_out + 0.40, r_in - 0.35, mi=I_WOOD)
    # 楼梯（盘旋而上，双跑 + 休息板）
    if idx < 4:
        z_next = MING[idx + 1][1]
        rise = z_next - z0
        r_s = r_out - 1.35
        a_start = 0.6 + idx * 2.4
        riser, run = 0.19, 0.30
        n1 = int(rise * 0.55 / riser)
        n2 = int(rise * 0.45 / riser)
        arc1 = n1 * run / r_s
        arc2 = n2 * run / r_s
        z_mid = z0 + rise * 0.55
        for i in range(n1):
            t = (i + 0.5) / n1
            a = a_start + arc1 * t
            z = z0 + rise * 0.55 * t
            mb.add_box(r_s * cos(a), r_s * sin(a), z, 0.34, 1.05, 0.07, rz=a, mi=I_WOOD)
        for sgn in (-0.52, 0.52):
            mb.beam(((r_s + sgn) * cos(a_start), (r_s + sgn) * sin(a_start), z0 - 0.20),
                    ((r_s + sgn) * cos(a_start + arc1), (r_s + sgn) * sin(a_start + arc1), z_mid - 0.20),
                    0.09, 0.24, mi=I_WOOD)
        a_land = a_start + arc1 + 0.12
        mb.add_box(r_s * cos(a_land), r_s * sin(a_land), z_mid - 0.06, 2.4, 1.15, 0.12, rz=a_land, mi=I_WOOD)
        a2 = a_land + 0.10
        for i in range(n2):
            t = (i + 0.5) / n2
            a = a2 + arc2 * t
            z = z_mid + (z_next - z_mid) * t
            mb.add_box(r_s * cos(a), r_s * sin(a), z, 0.34, 1.05, 0.07, rz=a, mi=I_WOOD)
        for sgn in (-0.52, 0.52):
            mb.beam(((r_s + sgn) * cos(a2), (r_s + sgn) * sin(a2), z_mid - 0.20),
                    ((r_s + sgn) * cos(a2 + arc2), (r_s + sgn) * sin(a2 + arc2), z_next - 0.20),
                    0.09, 0.24, mi=I_WOOD)
    # 佛像
    if buddha_h > 0:
        s = buddha_h / 4.6
        zf = z0 + FLOOR_H
        mb.cyl(0, 0, zf + 0.36 * s, 1.55 * s, 0.72, n=16, mi=I_GOLD)
        mb.cyl(0, 0, zf + 0.72 + 0.85 * s, 0.52 * s, 1.7 * s, n=12, mi=I_GOLD)
        mb.add_box(0, 0, zf + 0.72 + 1.72 * s, 1.35 * s, 0.72 * s, 0.42 * s, mi=I_GOLD)
        mb.sphere(0, 0, zf + 0.72 + 1.7 * s + 0.42 * s + 0.30 * s, 0.30 * s, mi=I_GOLD)
        mb.sphere(0, 0, zf + 0.72 + 1.7 * s + 0.42 * s + 0.60 * s, 0.12 * s, mi=I_GOLD)
    emit(mb, f"L{gi_m:02d}_{name}_柱网门窗梁架楼梯佛像", gi_m)
    # 平座（勾栏）
    mb = MB()
    r_balc = r_out + 1.25
    mb.oct_prism(z1, z1 + 0.30, r_balc, r_out - 0.30, mi=I_WOOD)
    r_post = r_out + 1.13
    per = 8 * 2 * r_post * sin(pi / N)
    n_post = int(per / 1.05)
    for i in range(n_post):
        a = 2 * pi * i / n_post
        mb.cyl(r_post * cos(a), r_post * sin(a), z1 + 0.30 + 0.51, 0.045, 1.02, n=6, mi=I_RED)
    mb.oct_ring_beam(z1 + 0.30 + 1.02, r_post, 0.10, 0.09, mi=I_RED)
    mb.oct_ring_beam(z1 + 0.30 + 0.52, r_post, 0.07, 0.06, mi=I_RED)
    emit(mb, f"L{gi_m:02d}_{name}_平座勾栏", gi_m)
    # 檐
    nm, r_e, r_b, z_b, ns, bs, r_t, z_t, curl = EAVES[idx + 1]
    mb = MB()
    for j in range(ns):
        th = 2 * pi * j / ns + radians(3.0)
        mb.bracket(r_b * cos(th), r_b * sin(th), z_b, th, s=bs)
    z_e = z_b + bs * 1.3 + 0.05
    for k in range(96):
        th = 2 * pi * (k + 0.5) / 96
        mb.beam(((r_b + 0.35) * cos(th), (r_b + 0.35) * sin(th), z_b + 1.05 * bs),
                ((r_e + 0.14) * cos(th), (r_e + 0.14) * sin(th), z_e + 0.10), 0.10, 0.09, mi=I_WOOD)  # 椽
        mb.beam(((r_e - (r_e - r_b) * 0.42) * cos(th), (r_e - (r_e - r_b) * 0.42) * sin(th), z_e + 0.16),
                ((r_e + 0.16) * cos(th), (r_e + 0.16) * sin(th), z_e + 0.10), 0.075, 0.06, mi=I_WOOD)  # 飞子
    mb.roof((r_e, z_e, r_t, z_t, curl))
    emit(mb, f"L{gi_e:02d}_{nm}_斗拱椽瓦顶", gi_e)

def build_an(idx, name, z0, z1, r_out, r_in):
    gi = 3 + idx * 3 + 1
    mb = MB()
    for a in COL_ANG:
        mb.cyl(r_out * cos(a), r_out * sin(a), (z0 + z1) / 2, 0.26, z1 - z0, n=12, mi=I_RED)
    for a in IN_ANG:
        mb.cyl(r_in * cos(a), r_in * sin(a), (z0 + z1) / 2, 0.26, z1 - z0, n=12, mi=I_RED)
    mb.oct_ring_beam(z1 - 0.45, r_out, 0.26, 0.45, mi=I_WOOD)
    mb.oct_ring_beam(z1 - 0.45, r_in, 0.24, 0.40, mi=I_WOOD)
    # 直棂窗
    r_p = r_out - 0.12
    d_bay = 2 * r_out * sin(radians(7.5))
    for i in range(24):
        am = COL_ANG[i] + radians(7.5)
        w = d_bay - 0.66
        for frac in (0.30, 0.72):
            mb.add_box(r_p * cos(am), r_p * sin(am), z0 + (z1 - z0) * frac, w, 0.06, 0.055, rz=am, mi=I_LATT)
        for frac in (0.2, 0.37, 0.54, 0.71, 0.88):
            mb.add_box(r_p * cos(am), r_p * sin(am), z0 + (z1 - z0) * frac, 0.055, 0.06, (z1 - z0) * 0.14, rz=am, mi=I_LATT)
    # 斜撑：外槽24根螺旋斜撑 + 内槽8组X撑
    for i in range(24):
        a1 = COL_ANG[i]
        a2 = COL_ANG[(i + 1) % 24]
        mb.beam((r_out * cos(a1), r_out * sin(a1), z0 + 0.25),
                (r_out * cos(a2), r_out * sin(a2), z1 - 0.25), 0.15, 0.19, mi=I_RED)
    for k in range(8):
        a1 = IN_ANG[k]
        a2 = IN_ANG[(k + 1) % 8]
        mb.beam((r_in * cos(a1), r_in * sin(a1), z0 + 0.25),
                (r_in * cos(a2), r_in * sin(a2), z1 - 0.25), 0.12, 0.15, mi=I_RED)
        mb.beam((r_in * cos(a2), r_in * sin(a2), z0 + 0.25),
                (r_in * cos(a1), r_in * sin(a1), z1 - 0.25), 0.12, 0.15, mi=I_RED)
    emit(mb, f"L{gi:02d}_{name}_斜撑直棂窗", gi)

for i, mdat in enumerate(MING):
    build_ming(i, *mdat)
for i, adat in enumerate(AND):
    build_an(i, *adat)

# ---------- L16 攒尖顶 ----------
nm, r_e, z_e, r_t, z_t, curl = TOP
mb = MB()
mb.oct_prism(z_e - 0.5, z_e, 8.75, 7.45, mi=I_WOOD)   # 顶平台
mb.roof((r_e, z_e, r_t, z_t, curl))
mb.cyl(0, 0, z_t + 0.30, 0.60, 0.60, n=8, mi=I_RIDGE)  # 宝顶座
mb.sphere(0, 0, z_t + 0.75, 0.30, mi=I_GOLD)           # 宝珠
emit(mb, "L16_攒尖顶_宝顶", 16)

# ---------- L17 塔刹 ----------
mb = MB()
z_base = z_t
mb.cyl(0, 0, z_base + 0.35, 0.72, 0.70, n=12, r2=0.18, mi=I_IRON)          # 宝盖
mb.cyl(0, 0, (z_base + 66.9) / 2, 0.11, 66.9 - z_base, n=10, mi=I_IRON)    # 刹杆
for i in range(7):                                                            # 七重相轮
    R = 0.60 - 0.055 * i
    mb.torus(0, 0, z_base + 1.35 + i * 0.92, R, 0.05, mi=I_IRON)
mb.sphere(0, 0, z_base + 7.95, 0.30, mi=I_IRON)                              # 宝珠
z_spike0 = z_base + 8.45                                                     # 刹尖
mb.cyl(0, 0, (z_spike0 + 67.31) / 2, 0.09, 67.31 - z_spike0, n=8, r2=0.015, mi=I_IRON)
for k in range(8):                                                            # 铁链
    th = CORNER + k * pi / 4
    mb.rod((0.13 * cos(th), 0.13 * sin(th), z_base + 3.6),
           (8.45 * cos(th), 8.45 * sin(th), z_e + 0.25), r=0.02, n=5)
emit(mb, "L17_塔刹_刹杆相轮宝珠", 17)

# ---------------- 导出 ----------------
bpy.ops.export_scene.gltf(filepath="/tmp/pagoda.glb", export_format="GLB", use_selection=False)
bpy.ops.wm.save_as_mainfile(filepath="workspace/yingxian_pagoda.blend")

tot_v = tot_f = 0
for objs in GROUPS.values():
    for ob in objs:
        tot_v += len(ob.data.vertices)
        tot_f += len(ob.data.polygons)
print(f"OK 物体数={sum(len(v) for v in GROUPS.values())} 顶点={tot_v} 面={tot_f}")
