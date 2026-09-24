#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
应县木塔（佛宫寺释迦塔）程序化精准建模
- 总高 67.31m，八角平面，5 明层 + 4 暗层（共 9 个结构层）
- 首层副阶周匝，二至五层设平座勾栏
- 每层：立柱（外槽+内槽双环柱网）、阑额、梁架、斗拱铺作、外挑屋檐、瓦垄、垂脊、椽子
- 内部：各层楼梯（双跑+暗层）、暗层交叉斜撑
- 木构件：米黄/浅棕；瓦面：浅蓝灰
"""
import bpy, math, os
from math import sin, cos, tan, radians, pi, atan2, sqrt

A0 = -pi / 8          # 八角形整体旋转，使面心对准正交轴
TAU = 2 * pi

# ---------------- 场景清理 ----------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

# ---------------- 材质 ----------------
def make_mat(name, color, rough=0.85, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    m.diffuse_color = (*color, 1.0)
    return m

MAT_WOOD   = make_mat("木构件_米黄浅棕", (0.640, 0.470, 0.280))
MAT_WOODD  = make_mat("木构件_深棕",    (0.430, 0.310, 0.190))
MAT_TILE   = make_mat("瓦面_浅蓝灰",    (0.590, 0.675, 0.760))
MAT_STONE  = make_mat("台基_石",        (0.520, 0.520, 0.490))
MAT_IRON   = make_mat("塔刹_铁",        (0.230, 0.240, 0.260), rough=0.45, metallic=0.85)
MAT_GROUND = make_mat("地面",            (0.240, 0.280, 0.210))

# ---------------- 网格累积器（避免大量 bpy.ops，直接累积顶点/面） ----------------
class MB:
    def __init__(self, name, mat, parent):
        self.name, self.mat, self.parent = name, mat, parent
        self.v, self.f = [], []

    def add(self, verts, faces):
        off = len(self.v)
        self.v.extend(verts)
        for fc in faces:
            self.f.append(tuple(off + i for i in fc))

    @staticmethod
    def _rot(p, rx, ry, rz):
        x, y, z = p
        if rx: y, z = y*cos(rx)-z*sin(rx), y*sin(rx)+z*cos(rx)
        if ry: x, z = x*cos(ry)+z*sin(ry), -x*sin(ry)+z*cos(ry)
        if rz: x, y = x*cos(rz)-y*sin(rz), x*sin(rz)+y*cos(rz)
        return x, y, z

    def box(self, cx, cy, cz, sx, sy, sz, rz=0.0, rx=0.0, ry=0.0):
        pts = []
        for dx in (-.5, .5):
            for dy in (-.5, .5):
                for dz in (-.5, .5):
                    pts.append(self._rot((dx*sx, dy*sy, dz*sz), rx, ry, rz))
        verts = [(cx+p[0], cy+p[1], cz+p[2]) for p in pts]
        faces = [(0,3,2,1), (4,5,6,7), (0,4,7,3), (1,2,6,5), (0,1,5,4), (3,7,6,2)]
        self.add(verts, faces)

    def cyl(self, cx, cy, cz, r1, r2, h, n=12, rz=0.0, cap=True):
        vb, vt = [], []
        for i in range(n):
            a = rz + i * TAU / n
            vb.append((cx + r1*cos(a), cy + r1*sin(a), cz - h/2))
            vt.append((cx + r2*cos(a), cy + r2*sin(a), cz + h/2))
        verts = vb + vt
        faces = []
        for i in range(n):
            j = (i + 1) % n
            faces.append((i, j, n+j, n+i))
        if cap:
            faces.append(tuple(range(n-1, -1, -1)))
            faces.append(tuple(range(n, 2*n)))
        self.add(verts, faces)

    def beam(self, p1, p2, w, h=None):
        """方梁：从 p1 到 p2，宽 w，高 h（默认=w）"""
        h = w if h is None else h
        dx, dy, dz = p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2]
        L = sqrt(dx*dx + dy*dy + dz*dz)
        if L < 1e-6:
            return
        rz = atan2(dy, dx)
        pitch = atan2(dz, sqrt(dx*dx + dy*dy))
        self.box((p1[0]+p2[0])/2, (p1[1]+p2[1])/2, (p1[2]+p2[2])/2,
                 L, w, h, rz=rz, ry=-pitch)

    def ring_beam(self, r_mid, w, z, h, n=8, rz0=0.0):
        """正八边形环梁（分段盒子拼接，长轴沿切向）"""
        for i in range(n):
            a = rz0 + (i + 0.5) * TAU / n
            chord = 2 * (r_mid + w/2) * tan(pi/n) + 0.25
            self.box(r_mid*cos(a), r_mid*sin(a), z, chord, w, h, rz=a + pi/2)

    def ridge(self, pts, w, h):
        """沿折线的菱形截面脊（瓦垄/垂脊）"""
        for i in range(len(pts)-1):
            p, q = pts[i], pts[i+1]
            dx, dy, dz = q[0]-p[0], q[1]-p[1], q[2]-p[2]
            L = sqrt(dx*dx + dy*dy + dz*dz)
            if L < 1e-6:
                continue
            ux, uy = dx/L, dy/L
            sx, sy = -uy, ux
            sl = sqrt(sx*sx + sy*sy)
            if sl < 1e-6:
                sx, sy, sl = 1.0, 0.0, 1.0
            sx, sy = sx/sl*w/2, sy/sl*w/2
            verts = [
                (p[0]-sx, p[1]-sy, p[2]), (p[0]+sx, p[1]+sy, p[2]),
                (p[0]+sx, p[1]+sy, p[2]+h), (p[0]-sx, p[1]-sy, p[2]+h),
                (q[0]-sx, q[1]-sy, q[2]), (q[0]+sx, q[1]+sy, q[2]),
                (q[0]+sx, q[1]+sy, q[2]+h), (q[0]-sx, q[1]-sy, q[2]+h),
            ]
            faces = [(0,1,2,3), (4,7,6,5), (0,4,5,1), (1,5,6,2), (2,6,7,3), (3,7,4,0)]
            self.add(verts, faces)

    def roof(self, mb_wood, r_top, z_top, r_edge, z_edge, lift=0.45, out=0.35,
             rings=6, spacing=0.62, n=8):
        """八角攒尖/伞形屋檐：凹曲屋面 + 瓦垄 + 垂脊 + 角梁 + 椽子 + 檐口板"""
        ts = [i / rings for i in range(rings + 1)]

        def corner(i, t):
            r = r_top + (r_edge - r_top) * (t ** 0.85)
            z = z_top - (z_top - z_edge) * (t ** 1.7)
            a = A0 + i * TAU / n
            if t >= 1.0:
                r, z = r_edge + out, z_edge + lift
            return (r*cos(a), r*sin(a), z)

        # 屋面（单面，查看器中设 DoubleSide）
        for i in range(n):
            for j in range(rings):
                p00 = corner(i, ts[j]);   p10 = corner(i, ts[j+1])
                p01 = corner(i+1, ts[j]); p11 = corner(i+1, ts[j+1])
                self.add([p00, p10, p11, p01], [(0, 1, 2, 3)])
        # 檐口板（连檐瓦口）
        self.ring_beam(r_edge + out - 0.15, 0.28, z_edge + lift - 0.10, 0.16, n=n)
        # 瓦垄 + 椽子 + 垂脊
        chord = 2 * (r_edge + out) * sin(pi / n)
        nridge = max(4, int(chord / spacing))
        for i in range(n):
            for k in range(nridge):
                s = (k + 0.5) / nridge
                pts = []
                for t in ts:
                    c1, c2 = corner(i, t), corner(i+1, t)
                    pts.append(tuple(c1[m]*(1-s) + c2[m]*s for m in range(3)))
                self.ridge(pts, 0.13, 0.07)          # 瓦垄
                p1, p2 = corner(i, 0.04), corner(i+1, 0.04)
                q1 = tuple(p1[m]*(1-s) + p2[m]*s for m in range(3))
                e1, e2 = corner(i, 1.0), corner(i+1, 1.0)
                q2 = tuple(e1[m]*(1-s) + e2[m]*s for m in range(3))
                q1 = (q1[0]*0.985, q1[1]*0.985, q1[2]-0.16)
                q2 = (q2[0], q2[1], q2[2]-0.10)
                mb_wood.beam(q1, q2, 0.13)           # 椽子
            pts = [corner(i, t) for t in ts]
            self.ridge(pts, 0.26, 0.18)              # 垂脊
            mb_wood.beam(corner(i, 0.0), corner(i, 1.0), 0.22, 0.30)  # 角梁

    def bracket(self, x, y, z0, a, s=1.0):
        """斗拱铺作（简化五铺作：栌斗+华拱+横拱+散斗+令拱+耍头）"""
        c, sn = cos(a), sin(a)
        def B(dx, dy, dz, sx, sy, sz):
            self.box(x + dx*c - dy*sn, y + dx*sn + dy*c, z0 + dz,
                     sx*s, sy*s, sz*s, rz=a)
        B(0, 0, 0.28, 0.95, 0.95, 0.55)        # 栌斗
        B(0.18, 0, 0.72, 1.75, 0.42, 0.34)     # 华拱（径向出跳）
        B(0, 0, 0.72, 0.42, 1.75, 0.34)        # 横拱（切向）
        for dx, dy in ((0.72, 0), (-0.72, 0), (0, 0.72), (0, -0.72)):
            B(dx, dy, 1.02, 0.30, 0.30, 0.24)  # 散斗
        B(0, 0, 1.22, 0.36, 1.95, 0.30)        # 令拱
        B(-0.12, 0, 1.45, 1.35, 0.36, 0.30)    # 耍头

    def column(self, mb_stone, x, y, z0, h, r1, r2, n=12):
        self.cyl(x, y, z0 + h/2, r1, r2, h, n=n)
        if mb_stone is not None:
            mb_stone.cyl(x, y, z0 + 0.14, r1 + 0.16, r1 + 0.10, 0.28, n=10)

    def lattice(self, a, r, z0, z1, w, mull=7):
        """格子门窗：框 + 竖棂 + 横棂"""
        c, s = cos(a), sin(a)
        def P(dx, dy, dz):
            return (r*c - dx*s + dy*c, r*s + dx*c + dy*s, dz)
        h = z1 - z0
        for dx in (-w/2, w/2):
            self.box(*P(dx, 0, z0 + h/2), 0.14, 0.16, h, rz=a)
        for dz in (z0 + 0.07, z1 - 0.07):
            self.box(*P(0, 0, dz), w + 0.14, 0.16, 0.14, rz=a)
        for i in range(1, mull):
            dx = -w/2 + w * i / mull
            self.box(*P(dx, 0, z0 + h/2), 0.07, 0.10, h - 0.28, rz=a)
        for j in range(1, 4):
            dz = z0 + h * j / 4
            self.box(*P(0, 0, dz), w - 0.2, 0.10, 0.07, rz=a)

# ---------------- 分组空物体（用于查看器分层拆解） ----------------
GROUPS = ["台基", "副阶", "一层", "暗层1", "二层", "暗层2", "三层",
          "暗层3", "四层", "暗层4", "五层", "塔刹"]
empties = {}
for i, g in enumerate(GROUPS):
    e = bpy.data.objects.new(f"{i}_{g}", None)
    scene.collection.objects.link(e)
    empties[g] = e
e = bpy.data.objects.new("地面", None)
scene.collection.objects.link(e)
empties["地面"] = e

mbs = []
def new_mb(key, mat):
    mb = MB(f"{key}_{mat.name}", mat, empties[key])
    mbs.append(mb)
    return mb

# ================= 地面 =================
gnd = new_mb("地面", MAT_GROUND)
gnd.box(0, 0, -0.25, 240, 240, 0.5)

# ================= 台基 =================
st = new_mb("台基", MAT_STONE)
st.box(0, 0, 0.6, 34, 34, 1.2)                              # 方形基座
st.cyl(0, 0, 2.0, 16.4, 15.8, 1.6, n=8, rz=A0)              # 八角二层台

# ================= 副阶（首层抱厦） =================
pw = new_mb("副阶", MAT_WOOD)
pt = new_mb("副阶", MAT_TILE)
ps = new_mb("副阶", MAT_STONE)
for k in range(24):
    a = A0 + k * TAU / 24
    x, y = 13.4 * cos(a), 13.4 * sin(a)
    pw.column(ps, x, y, 2.8, 3.2, 0.30, 0.26)
    pw.bracket(x, y, 6.0, a)
    am = a + TAU / 48
    pw.bracket(13.4*cos(am), 13.4*sin(am), 6.0, am, s=0.85)
pw.ring_beam(14.12, 0.3, 7.62, 0.26, n=8)                   # 撩檐枋
pt.roof(pw, 14.3, 7.8, 15.9, 6.3, lift=0.40, out=0.35, rings=5)

# ================= 楼梯 =================
def build_stairs(wood, ang, z0, z1):
    """双跑楼梯 + 休息平台 + 径向短跑，连接本层地面与上层平座"""
    total = z1 - z0
    fA = total * 0.42
    fB = total * 0.42
    fC = total - fA - fB
    nA = max(3, round(fA / 0.26))
    nB = max(3, round(fB / 0.26))
    nC = max(2, round(fC / 0.26))
    c, s = cos(ang), sin(ang)
    tx, ty = -s, c
    r = 6.0
    rz = ang + pi/2
    for i in range(nA):                                  # 第一跑（切向）
        d = 0.30 * (i + 0.5)
        wood.box(r*c + tx*d, r*s + ty*d, z0 + 0.26*(i+0.5), 0.32, 1.15, 0.26, rz=rz)
    runA = nA * 0.30
    pA = (r*c + tx*runA, r*s + ty*runA, z0 + fA)
    wood.box(pA[0] + tx*1.15, pA[1] + ty*1.15, pA[2] - 0.11, 2.4, 1.8, 0.22, rz=rz)  # 平台1
    bx, by = pA[0] + tx*2.3, pA[1] + ty*2.3
    for i in range(nB):                                  # 第二跑（反向）
        d = 0.30 * (i + 0.5)
        wood.box(bx - tx*d, by - ty*d, pA[2] + 0.26*(i+0.5), 0.32, 1.15, 0.26, rz=rz)
    runB = nB * 0.30
    pB = (bx - tx*runB, by - ty*runB, pA[2] + fB)
    wood.box(pB[0] - tx*1.0, pB[1] - ty*1.0, pB[2] - 0.11, 2.1, 1.8, 0.22, rz=rz)      # 平台2
    th = ang + pi                                        # 第三跑（径向向外，上平座）
    dx, dy = cos(th), sin(th)
    sx, sy = pB[0] - tx*2.0, pB[1] - ty*2.0
    for i in range(nC):
        d = 0.32 * (i + 0.5)
        wood.box(sx + dx*d, sy + dy*d, pB[2] + 0.26*(i+0.5), 0.32, 1.15, 0.26, rz=th)

# ================= 明层 =================
def build_story(key, base_z, col_h, n_out, r_out, r_in, col_r,
                roof_pars, balcony, lattice_mode, stair_ang, next_base):
    wood = new_mb(key, MAT_WOOD)
    tile = new_mb(key, MAT_TILE)
    stone = new_mb(key, MAT_STONE)
    top_z = base_z + col_h

    if balcony:  # 平座：楼板 + 支承 + 勾栏栏杆
        for i in range(8):
            a = A0 + (i + 0.5) * TAU / 8
            chord = 2 * 9.6 * sin(pi/8) + 0.3
            wood.box(9.6*cos(a), 9.6*sin(a), base_z - 0.13, chord, 2.9, 0.26, rz=a + pi/2)
        for k in range(16):
            a = A0 + k * TAU / 16
            wood.box(9.3*cos(a), 9.3*sin(a), base_z - 0.45, 2.9, 0.24, 0.30, rz=a)
        rr = 10.8
        wood.ring_beam(rr, 0.18, base_z + 1.02, 0.14, n=8)   # 寻杖
        wood.ring_beam(rr, 0.15, base_z + 0.55, 0.12, n=8)   # 盆唇
        wood.ring_beam(rr, 0.22, base_z + 0.07, 0.14, n=8)   # 地栿
        for k in range(24):
            a = A0 + k * TAU / 24
            wood.box(rr*cos(a), rr*sin(a), base_z + 0.55, 0.13, 0.13, 1.05, rz=a)

    # 外槽柱 + 柱头铺作 + 补间铺作
    for k in range(n_out):
        a = A0 + k * TAU / n_out
        x, y = r_out * cos(a), r_out * sin(a)
        wood.column(stone, x, y, base_z, col_h, col_r, col_r * 0.88)
        wood.bracket(x, y, top_z, a)
        am = a + TAU / n_out / 2
        wood.bracket(r_out*cos(am), r_out*sin(am), top_z, am, s=0.85)
    wood.ring_beam(r_out + 0.72, 0.3, top_z + 1.62, 0.26, n=8)   # 撩檐枋

    # 内槽柱
    for k in range(8):
        a = A0 + k * TAU / 8
        x, y = r_in * cos(a), r_in * sin(a)
        wood.column(stone, x, y, base_z, col_h, col_r * 1.15, col_r)

    # 阑额（内外槽柱顶环带）+ 径向梁架
    wood.ring_beam(r_out, 0.28, top_z - 0.35, 0.30, n=8)
    wood.ring_beam(r_in, 0.26, top_z - 0.35, 0.30, n=8)
    for k in range(16):
        a = A0 + k * TAU / 16
        wood.beam((r_in*cos(a), r_in*sin(a), top_z + 0.1),
                  (r_out*cos(a), r_out*sin(a), top_z + 0.1), 0.32, 0.50)

    # 墙体 / 格子门窗
    apo = r_out * cos(pi/8)
    chord = 2 * r_out * sin(pi/8)
    for i in range(8):
        a = A0 + (i + 0.5) * TAU / 8
        c, s = cos(a), sin(a)
        tx, ty = -s, c
        z0, z1 = base_z + 0.45, top_z - 0.55
        if n_out == 24:
            bays = (-0.25, 0.25)
            pw_ = chord * 0.5 - 0.75
        else:
            bays = (0.0,)
            pw_ = chord - 0.75
        for sb in bays:
            cx = apo * c + tx * chord * sb
            cy = apo * s + ty * chord * sb
            use_lattice = (lattice_mode == "all") or (lattice_mode == "cardinal" and i % 2 == 0)
            if use_lattice:
                h = z1 - z0
                def P(dx, dy, dz):
                    return (cx - dx*s + dy*c, cy + dx*c + dy*s, dz)
                for dxx in (-pw_/2, pw_/2):
                    wood.box(*P(dxx, 0, z0 + h/2), 0.14, 0.16, h, rz=a)
                for dz in (z0 + 0.07, z1 - 0.07):
                    wood.box(*P(0, 0, dz), pw_ + 0.14, 0.16, 0.14, rz=a)
                for mi in range(1, 7):
                    dxx = -pw_/2 + pw_ * mi / 7
                    wood.box(*P(dxx, 0, z0 + h/2), 0.07, 0.10, h - 0.28, rz=a)
                for mj in range(1, 4):
                    wood.box(*P(0, 0, z0 + h*mj/4), pw_ - 0.2, 0.10, 0.07, rz=a)
            else:
                wood.box(cx, cy, (z0 + z1)/2, pw_, 0.22, z1 - z0, rz=a)

    # 屋檐（斗拱之上）
    tile.roof(wood, *roof_pars)

    # 楼梯
    if stair_ang is not None:
        build_stairs(wood, stair_ang, base_z, next_base)

# —— 五个明层（竖向尺寸按 67.31m 总高分配） ——
build_story("一层", 2.80, 8.0, 24, 10.6, 4.6, 0.34,
            (11.35, 12.60, 14.90, 11.70), False, "cardinal", radians(30), 14.66)
build_story("二层", 14.66, 7.4, 16, 9.0, 4.2, 0.30,
            (9.90, 23.86, 13.40, 22.96), True, "all", radians(120), 25.92)
build_story("三层", 25.92, 7.0, 16, 9.0, 4.2, 0.30,
            (9.50, 34.72, 12.60, 33.82), True, "all", radians(210), 36.78)
build_story("四层", 36.78, 6.6, 16, 9.0, 4.2, 0.30,
            (9.10, 45.18, 11.80, 44.28), True, "all", radians(300), 47.24)
build_story("五层", 47.24, 6.2, 16, 9.0, 4.2, 0.30,
            (0.80, 59.20, 12.20, 55.24), True, "all", None, None)

# ================= 暗层（交叉斜撑 + 环带，无窗） =================
def build_mezz(key, z0, z1):
    wood = new_mb(key, MAT_WOOD)
    h = z1 - z0
    for k in range(16):
        a = A0 + k * TAU / 16
        wood.column(None, 9.0*cos(a), 9.0*sin(a), z0, h, 0.26, 0.22)
    for k in range(8):
        a = A0 + k * TAU / 8
        wood.column(None, 4.2*cos(a), 4.2*sin(a), z0, h, 0.28, 0.24)
    wood.ring_beam(9.0, 0.26, z1 - 0.30, 0.30, n=8)
    wood.ring_beam(4.2, 0.24, z1 - 0.30, 0.30, n=8)
    wood.ring_beam(9.0, 0.26, z0 + 0.30, 0.30, n=8)
    for i in range(8):
        a = A0 + (i + 0.5) * TAU / 8
        c, s = cos(a), sin(a)
        wood.beam((4.2*c, 4.2*s, z0 + 0.2), (9.0*c, 9.0*s, z1 - 0.4), 0.18)   # 斜撑
        wood.beam((9.0*c, 9.0*s, z0 + 0.2), (4.2*c, 4.2*s, z1 - 0.4), 0.18)
        wood.beam((4.2*c, 4.2*s, z0 + h*0.5), (9.0*c, 9.0*s, z0 + h*0.5), 0.16)  # 系杆

build_mezz("暗层1", 10.80, 14.40)
build_mezz("暗层2", 22.06, 25.66)
build_mezz("暗层3", 32.92, 36.52)
build_mezz("暗层4", 43.38, 46.98)

# ================= 塔刹 =================
ir = new_mb("塔刹", MAT_IRON)
ir.cyl(0, 0, 59.55, 1.00, 0.55, 0.70, n=12)      # 刹座
ir.cyl(0, 0, 60.25, 0.75, 0.40, 0.70, n=12)      # 覆钵
z = 60.70
for _ in range(7):                                # 相轮（七重）
    ir.cyl(0, 0, z, 0.62, 0.62, 0.11, n=12)
    z += 0.19
ir.cyl(0, 0, 62.30, 0.10, 0.10, 2.20, n=8)        # 刹杆
ir.cyl(0, 0, 63.45, 0.28, 0.04, 0.60, n=10)       # 宝珠
for i in range(8):                                # 铁链（刹杆→屋角）
    a = A0 + i * TAU / 8
    ir.beam((0.5*cos(a), 0.5*sin(a), 61.6),
            (11.9*cos(a), 11.9*sin(a), 55.8), 0.05)

# ================= 生成网格对象 =================
for mb in mbs:
    mesh = bpy.data.meshes.new(mb.name)
    mesh.from_pydata(mb.v, [], mb.f)
    mesh.update()
    obj = bpy.data.objects.new(mb.name, mesh)
    scene.collection.objects.link(obj)
    obj.parent = mb.parent
    mesh.materials.append(mb.mat)

tris = sum(len(mb.f) for mb in mbs)
print(f"[pagoda] 网格数 {len(mbs)}，总面数 {tris}，顶点 {sum(len(mb.v) for mb in mbs)}")

# ================= 导出 GLB =================
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pagoda.glb")
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=False)
print(f"[pagoda] 已导出 {out} ({os.path.getsize(out)/1e6:.1f} MB)")
