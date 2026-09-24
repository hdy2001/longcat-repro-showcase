# -*- coding: utf-8 -*-
"""
应县木塔（佛宫寺释迦塔）参数化精准复刻建模脚本
总高 67.31m（含塔刹），底层直径 30.27m，台基高 4m，第一层总高 11.5m
外观五层六檐（副阶檐+五层檐），内九层（明五暗四），辽清宁二年（1056）
"""
import bpy, math, bmesh
from math import sin, cos, pi, radians
from mathutils import Vector

# ---------------- 场景重置 ----------------
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------------- 全局参数（单位：米） ----------------
N = 8
CORNER_PHASE = radians(22.5)   # 角柱位于 22.5°+k*45°，面心位于 k*45°

WALL_R   = [15.13, 14.35, 13.60, 12.85, 12.10]      # 各明层外墙外半径（F1..F5，逐层收分）
COL_R    = [w - 0.40 for w in WALL_R]                # 檐柱半径（柱身凸出墙面）
INNER_R  = [5.6, 4.8, 4.4, 4.0, 3.7]                 # 内槽柱半径
NEIWALL_IN  = [5.30, 4.50, 4.10, 3.70, 3.40]         # 内槽墙内半径
NEIWALL_OUT = [6.60, 5.60, 5.00, 4.50, 4.10]         # 内槽墙外半径
FLOOR_R  = [w - 0.95 for w in WALL_R]                # 楼层板半径

Z_PLAT   = 4.0            # 台基顶面
Z1_COL_T = 12.0           # 一层檐柱顶
Z1_EAVE  = 13.3           # 一层檐口
Z1_TOP   = 15.5           # 一层檐顶（第一层总高11.5m，自台基面起）
UNIT     = 10.45          # 上部单层单元高（平座+暗层+明层+斗栱+屋檐）
Z_F      = [15.5, 25.95, 36.40, 46.85, 57.30]        # 二~五层单元底标高
Z_APEX   = 57.30          # 塔顶（刹座底）
Z_TOP    = 67.31          # 塔刹顶（总高）

EAVE_R   = [19.43, 18.65, 17.90, 17.15, 16.40]       # 一~五层檐外缘半径
EAVE_Z   = [13.30, 23.15, 33.60, 44.05, 54.50]       # 各层檐口标高
EAVE_TOP_R = [13.85, 13.10, 12.35, 11.60, 5.50]      # 各层檐顶半径（五层为攒尖）
EAVE_TOP_Z = [15.50, 25.95, 36.40, 46.85, 57.30]
EAVE_LIFT  = [1.45, 1.30, 1.15, 1.00, 0.85]             # 翼角起翘

FUJI_R, FUJI_COL_T = 16.9, 5.55                      # 副阶
FUJI_EAVE_R, FUJI_EAVE_TOP_R, FUJI_EAVE_Z, FUJI_EAVE_TOP_Z = 18.2, 14.9, 6.6, 7.8

# ---------------- 材质 ----------------
def make_mat(name, color, rough=0.7, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    m.diffuse_color = (*color, 1.0)   # Workbench 视口显示色
    return m

M_DARK  = make_mat("wood_dark",  (0.45, 0.22, 0.10), 0.62)      # 红松木构
M_WALL  = make_mat("wood_wall",  (0.60, 0.33, 0.16), 0.68)      # 土朱墙体
M_DOOR  = make_mat("wood_door",  (0.42, 0.20, 0.09), 0.60)      # 隔扇门、窗
M_ROOF  = make_mat("roof_tile",  (0.38, 0.35, 0.30), 0.78)      # 灰瓦屋面
M_STONE = make_mat("stone",      (0.60, 0.58, 0.54), 0.80)      # 台基、柱础
M_METAL = make_mat("iron",       (0.24, 0.24, 0.28), 0.42, 0.9) # 塔刹、铁链、风铎
M_GOLD  = make_mat("gilt",       (0.78, 0.60, 0.20), 0.35, 0.65) # 佛像

# ---------------- 网格累积器 ----------------
class MB:
    def __init__(self):
        self.v, self.f = [], []
    def box(self, cx, cy, cz, sx, sy, sz, rz=0.0):
        c, s = cos(rz), sin(rz)
        hx, hy, hz = sx/2, sy/2, sz/2
        pts = [(-hx,-hy,-hz),(hx,-hy,-hz),(hx,hy,-hz),(-hx,hy,-hz),
               (-hx,-hy, hz),(hx,-hy, hz),(hx,hy, hz),(-hx,hy, hz)]
        b = len(self.v)
        for (x,y,z) in pts:
            self.v.append((cx + x*c - y*s, cy + x*s + y*c, cz + z))
        self.f += [(b+0,b+3,b+2,b+1),(b+4,b+5,b+6,b+7),
                   (b+0,b+1,b+5,b+4),(b+1,b+2,b+6,b+5),
                   (b+2,b+3,b+7,b+6),(b+3,b+0,b+4,b+7)]
    def cyl(self, cx, cy, cz, r, h, n=12, rz=0.0, r_top=None, cap=True):
        rt = r if r_top is None else r_top
        b = len(self.v)
        for i in range(n):
            a = rz + 2*pi*i/n
            self.v.append((cx + r*cos(a), cy + r*sin(a), cz - h/2))
        for i in range(n):
            a = rz + 2*pi*i/n
            self.v.append((cx + rt*cos(a), cy + rt*sin(a), cz + h/2))
        for i in range(n):
            j = (i+1) % n
            self.f.append((b+i, b+j, b+n+j, b+n+i))
        if cap:
            c0 = len(self.v); self.v.append((cx, cy, cz-h/2))
            c1 = len(self.v); self.v.append((cx, cy, cz+h/2))
            for i in range(n):
                j = (i+1) % n
                self.f.append((c0, b+j, b+i))
                self.f.append((c1, b+n+i, b+n+j))
    def tube(self, p0, p1, r, n=6):
        """两点之间的细圆柱（铁链等）"""
        d = Vector((p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]))
        L = d.length
        if L < 1e-6: return
        q = d.to_track_quat('Z', 'Y')
        b = len(self.v)
        base = len(self.v)
        for i in range(n):
            a = 2*pi*i/n
            self.v.append((p0[0] + r*cos(a), p0[1] + r*sin(a), p0[2]))
        for i in range(n):
            a = 2*pi*i/n
            lx, ly = r*cos(a), r*sin(a)
            g = Vector(p0) + q @ Vector((lx, ly, 0))
            self.v[base+i] = (g.x, g.y, g.z)
        top = len(self.v)
        for i in range(n):
            a = 2*pi*i/n
            lx, ly = r*cos(a), r*sin(a)
            g = Vector(p0) + q @ Vector((lx, ly, L))
            self.v.append((g.x, g.y, g.z))
        for i in range(n):
            j = (i+1) % n
            self.f.append((base+i, base+j, top+j, top+i))
        c0 = len(self.v); self.v.append(p0)
        c1 = len(self.v); self.v.append(p1)
        for i in range(n):
            j = (i+1) % n
            self.f.append((c0, base+j, base+i))
            self.f.append((c1, top+i, top+j))
    def prism(self, pts, z0, z1):
        n = len(pts)
        b = len(self.v)
        for (x,y) in pts: self.v.append((x, y, z0))
        for (x,y) in pts: self.v.append((x, y, z1))
        for i in range(n):
            j = (i+1) % n
            self.f.append((b+i, b+j, b+n+j, b+n+i))
        cx = sum(p[0] for p in pts)/n; cy = sum(p[1] for p in pts)/n
        c0 = len(self.v); self.v.append((cx, cy, z0))
        c1 = len(self.v); self.v.append((cx, cy, z1))
        for i in range(n):
            j = (i+1) % n
            self.f.append((c0, b+j, b+i))
            self.f.append((c1, b+n+i, b+n+j))
    def ring(self, r_out, r_in, z0, z1, phase=CORNER_PHASE):
        for k in range(N):
            a0 = phase + k*pi/4 - pi/8
            a1 = phase + k*pi/4 + pi/8
            P = lambda a, r: (r*cos(a), r*sin(a))
            self.prism([P(a0,r_out), P(a1,r_out), P(a1,r_in), P(a0,r_in)], z0, z1)
    def disc(self, r, z0, z1, phase=CORNER_PHASE):
        pts = [(r*cos(phase + k*pi/4 + pi/8), r*sin(phase + k*pi/4 + pi/8)) for k in range(N)]
        self.prism(pts, z0, z1)
    def obj(self, name, mat):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        me.update()
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(ob)
        me.materials.append(mat)
        print(f"  {name}: {len(me.vertices)} verts, {len(me.polygons)} faces")
        return ob

# ---------------- 屋面 ----------------
def corner_factor(th):
    cf = 0.0
    for k in range(N):
        d = th - CORNER_PHASE - k*pi/4
        v = cos(8*d)
        if v > cf: cf = v
    return cf*cf

def add_roof(mb, r_edge, z_edge, r_top, z_top, lift, seg=8, rings=12, thick=0.42):
    nt = N*seg
    def pt(i, j):
        t = i/rings
        th = 2*pi*j/nt
        r = r_top + (r_edge - r_top)*t
        z = z_top + (z_edge - z_top)*(t**1.55) + lift*(t**2.2)*corner_factor(th)
        return (r*cos(th), r*sin(th), z)
    for i in range(rings+1):
        for j in range(nt):
            mb.v.append(pt(i, j))
    def idx(i, j): return i*nt + (j % nt)
    for i in range(rings):
        for j in range(nt):
            mb.f.append((idx(i,j), idx(i,j+1), idx(i+1,j+1), idx(i+1,j)))
    base = len(mb.v)
    for i in range(rings+1):
        for j in range(nt):
            x, y, z = pt(i, j)
            mb.v.append((x, y, z - thick))
    def idx2(i, j): return base + i*nt + (j % nt)
    for i in range(rings):
        for j in range(nt):
            mb.f.append((idx2(i,j+1), idx2(i,j), idx2(i+1,j), idx2(i+1,j+1)))
    for j in range(nt):
        mb.f.append((idx(rings,j), idx2(rings,j), idx2(rings,j+1), idx(rings,j+1)))
        mb.f.append((idx(0,j+1), idx2(0,j+1), idx2(0,j), idx(0,j)))
    # 戗脊（8条角脊）
    for k in range(N):
        th = CORNER_PHASE + k*pi/4
        ts = [0.06 + 0.94*i/9 for i in range(10)]
        pts = []
        for t in ts:
            x, y, z = pt(int(round(t*rings)), int(round((th/(2*pi))*nt)) % nt)
            pts.append((x, y, z + 0.10))
        for a, b in zip(pts, pts[1:]):
            mx, my, mz = (a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2
            dx, dy = b[0]-a[0], b[1]-a[1]
            ln = math.hypot(dx, dy) + 0.10
            rz = math.atan2(dy, dx)
            mb.box(mx, my, mz + 0.05, ln, 0.30, 0.36, rz)

# ---------------- 墙体（带门窗洞口） ----------------
def wall_side_with_openings(mb, r_out, r_in, z0, z1, k, openings):
    """第k面墙（面心角 k*45°），openments=[(相对面心角度, 半宽linear, 底z, 顶z)]"""
    am = k*pi/4
    a0, a1 = am - pi/8, am + pi/8
    P = lambda a, r: (r*cos(a), r*sin(a))
    if not openings:
        mb.prism([P(a0,r_out), P(a1,r_out), P(a1,r_in), P(a0,r_in)], z0, z1)
        return
    cursor = a0
    for (da, hw, zb, zt) in sorted(openings):
        ac = am + radians(da)
        ha = hw / r_out
        lo, hi = ac - ha, ac + ha
        if lo > cursor + 1e-6:
            mb.prism([P(cursor,r_out), P(lo,r_out), P(lo,r_in), P(cursor,r_in)], z0, z1)
        if zb > z0 + 0.01:
            mb.prism([P(lo,r_out), P(hi,r_out), P(hi,r_in), P(lo,r_in)], z0, zb)
        if zt < z1 - 0.01:
            mb.prism([P(lo,r_out), P(hi,r_out), P(hi,r_in), P(lo,r_in)], zt, z1)
        cursor = hi
    if cursor < a1 - 1e-6:
        mb.prism([P(cursor,r_out), P(a1,r_out), P(a1,r_in), P(cursor,r_in)], z0, z1)

# ---------------- 门窗 ----------------
def add_door_leaf(mb, am, r_face, z0, w, h):
    """一扇格子门：边挺+横抹+格心棂条+裙板。局部x=面切向，y=径向"""
    t = (-sin(am), cos(am)); n = (cos(am), sin(am))
    def B(lt, lz, st, sr, sz):
        cx = r_face*n[0] + lt*t[0]; cy = r_face*n[1] + lt*t[1]
        mb.box(cx, cy, z0+lz, st, sr, sz, rz=am)
    B(-(w/2-0.05), h/2, 0.10, 0.16, h)      # 边挺
    B( (w/2-0.05), h/2, 0.10, 0.16, h)
    B(0, h-0.05, w-0.10, 0.14, 0.10)        # 上抹头
    B(0, h*0.55, w-0.10, 0.12, 0.08)        # 中抹头
    B(0, 0.35,    w-0.10, 0.14, 0.10)       # 下抹头
    B(0, 0.175,   w-0.20, 0.10, 0.35)       # 裙板
    zl0, zl1 = 0.40, h*0.52
    for i in range(3):                       # 格心竖棂
        lt = -w/2 + 0.10 + (w-0.20)*(i+0.5)/3
        B(lt, (zl0+zl1)/2, 0.05, 0.06, zl1-zl0)
    for i in range(4):                       # 格心横棂
        zl = zl0 + (zl1-zl0)*(i+0.5)/4
        B(0, zl, w-0.22, 0.05, 0.05)

def add_window(mb, am, r_face, z0, w, h):
    add_door_leaf(mb, am, r_face, z0, w, h)

# ---------------- 斗栱（简化双杪铺作） ----------------
BRACKET_BOXES = [
    (0, 0, 0.28, 0.70, 0.70, 0.56),     # 栌斗
    (0, 0, 0.72, 0.40, 1.70, 0.30),     # 华拱（径向）
    (0, 0, 0.72, 1.55, 0.32, 0.30),     # 泥道拱（切向）
    (0,  0.62, 0.95, 0.36, 0.36, 0.22), # 交互斗
    (0, -0.62, 0.95, 0.36, 0.36, 0.22),
    (0,  0.62, 1.06, 0.36, 2.10, 0.28), # 令拱
    (0, -0.13, 1.26, 0.30, 0.30, 0.20), # 散斗×3
    (0,  0.62, 1.26, 0.30, 0.30, 0.20),
    (0,  1.37, 1.26, 0.30, 0.30, 0.20),
    (0, 0.30, 1.38, 0.32, 1.10, 0.26),  # 耍头
    (0, 0.75, 1.56, 0.50, 1.70, 0.26),  # 撩檐枋
]

def place_one(mb, r, th, z_base, sc):
    rz = th - pi/2   # 局部y指向径向外侧
    c, s = cos(rz), sin(rz)
    bx, by = r*cos(th), r*sin(th)
    for (lx, ly, lz, sx, sy, sz) in BRACKET_BOXES:
        gx = bx + (lx*c - ly*s)*sc
        gy = by + (lx*s + ly*c)*sc
        mb.box(gx, gy, z_base + lz*sc, sx*sc, sy*sc, sz*sc, rz)

def add_brackets(mb, r, z_base, scale=0.72):
    for k in range(N):
        place_one(mb, r, CORNER_PHASE + k*pi/4, z_base, scale*1.22)  # 转角铺作
    for k in range(24):
        place_one(mb, r, k*pi/15, z_base, scale)                     # 柱头/补间铺作

# ---------------- 平座勾栏 ----------------
def add_balcony(mb, wall_r, z0):
    deck_in, deck_out = wall_r + 0.10, wall_r + 2.15
    rail_r = wall_r + 1.95
    for k in range(N):
        a0 = CORNER_PHASE + k*pi/4 - pi/8
        a1 = CORNER_PHASE + k*pi/4 + pi/8
        P = lambda a, r: (r*cos(a), r*sin(a))
        mb.prism([P(a0,deck_in), P(a1,deck_in), P(a1,deck_out), P(a0,deck_out)], z0-0.02, z0+0.20)
    post_angles = []
    for k in range(N):
        post_angles.append(CORNER_PHASE + k*pi/4)
        for da in (-7.5, 0, 7.5):
            post_angles.append(k*pi/4 + radians(da))
    for th in post_angles:
        x, y = rail_r*cos(th), rail_r*sin(th)
        mb.box(x, y, z0+0.70, 0.17, 0.17, 1.00, th)
        mb.box(x, y, z0+1.26, 0.26, 0.26, 0.12, th)
    for (zz, h, w) in [(z0+1.22, 0.13, 0.15), (z0+0.80, 0.11, 0.13), (z0+0.38, 0.15, 0.17)]:
        for k in range(N):
            am = k*pi/4
            L = 2*rail_r*sin(pi/8) + 0.24
            x, y = rail_r*cos(am), rail_r*sin(am)
            mb.box(x, y, zz, L, w, h, am + pi/2)

# ---------------- 佛像 ----------------
def add_buddha(mb, z_floor, scale):
    mb.cyl(0, 0, z_floor + 0.30*scale, 2.6*scale, 0.60*scale, n=8)
    mb.cyl(0, 0, z_floor + 0.90*scale, 2.2*scale, 0.60*scale, n=8)
    zb = z_floor + 1.20*scale
    mb.cyl(0, 0, zb + 0.55*scale, 1.15*scale, 1.10*scale, n=12, r_top=1.05*scale)
    mb.cyl(0, 0, zb + 1.65*scale, 0.85*scale, 1.30*scale, n=12)
    mb.cyl(0, 0, zb + 2.75*scale, 0.52*scale, 0.85*scale, n=12)
    mb.cyl(0, 0, zb + 3.30*scale, 0.22*scale, 0.45*scale, n=10)

# ================= 开始建模 =================
print("=== 应县木塔建模开始 ===")
b_stone = MB(); b_dark = MB(); b_wall = MB(); b_door = MB()
b_roof  = MB(); b_metal = MB(); b_gold = MB()

# ---------- 台基 ----------
print("[1] 台基")
b_stone.prism([(-20,-20),(20,-20),(20,20),(-20,20)], 0.0, 2.0)   # 下层方形（边长约40m）
b_stone.disc(17.735, 2.0, 4.0)                                    # 上层八角形（直径35.47m）
for k in range(4):                                                # 四面踏道
    am = k*pi/2
    n = (cos(am), sin(am))
    for i in range(3):
        h = 2.0*(i+1)/3
        cx = (20 + 0.35 + 0.7*(2-i))*n[0]
        cy = (20 + 0.35 + 0.7*(2-i))*n[1]
        b_stone.box(cx, cy, h/2, 8.0, 0.7, h, am)

# ---------- 副阶 ----------
print("[2] 副阶")
for k in range(24):
    th = k*pi/15
    x, y = FUJI_R*cos(th), FUJI_R*sin(th)
    b_dark.cyl(x, y, (Z_PLAT+FUJI_COL_T)/2, 0.42, FUJI_COL_T-Z_PLAT, n=12, r_top=0.36)
    b_stone.cyl(x, y, Z_PLAT+0.12, 0.55, 0.24, n=12)
b_dark.ring(FUJI_R+0.12, FUJI_R-0.45, FUJI_COL_T, FUJI_EAVE_Z-0.65)
add_brackets(b_dark, FUJI_R, FUJI_EAVE_Z-0.65, scale=0.40)
add_roof(b_roof, FUJI_EAVE_R, FUJI_EAVE_Z, FUJI_EAVE_TOP_R, FUJI_EAVE_TOP_Z, lift=0.7)

# ---------- 各明层 ----------
for fl in range(5):
    wall_r, col_r = WALL_R[fl], COL_R[fl]
    zb = Z_PLAT if fl == 0 else Z_F[fl-1]          # 本层地面
    col_t = Z1_COL_T if fl == 0 else zb + 2.65 + 3.7
    eave_z = Z1_EAVE if fl == 0 else zb + 7.65
    eave_r = EAVE_R[fl]
    top_r, top_z = EAVE_TOP_R[fl], EAVE_TOP_Z[fl]
    ming_z0 = zb if fl == 0 else zb + 2.65        # 明层墙起点
    print(f"[层{fl+1}] 地面{zb:.2f} 明层{ming_z0:.2f} 檐口{eave_z:.2f} 墙半径{wall_r}")

    if fl > 0:
        add_balcony(b_dark, wall_r, zb)
        b_wall.ring(wall_r-0.15, wall_r-0.85, zb+0.20, zb+2.65)   # 暗层
        b_dark.ring(wall_r-0.10, wall_r-0.70, zb+2.30, zb+2.65)   # 暗层顶环梁

    # 檐柱与内柱
    for i in range(24):
        th = i*pi/15
        x, y = col_r*cos(th), col_r*sin(th)
        h = col_t - zb
        b_dark.cyl(x, y, (zb+col_t)/2, 0.50 if fl==0 else 0.44, h, n=12,
                   r_top=0.40 if fl==0 else 0.36)
        b_stone.cyl(x, y, zb+0.14, 0.62 if fl==0 else 0.55, 0.28, n=12)
    for i in range(N):
        th = CORNER_PHASE + i*pi/4
        x, y = INNER_R[fl]*cos(th), INNER_R[fl]*sin(th)
        b_dark.cyl(x, y, (zb+col_t)/2, 0.52 if fl==0 else 0.46, col_t-zb, n=12, r_top=0.42)
    # 额枋与梁
    b_dark.ring(col_r+0.15, col_r-0.45, col_t-0.45, col_t)
    b_dark.ring(INNER_R[fl]+0.12, INNER_R[fl]-0.40, col_t-0.45, col_t)
    for i in range(N):
        am = CORNER_PHASE + i*pi/4
        t = (-sin(am), cos(am)); n = (cos(am), sin(am))
        p0 = (INNER_R[fl]*n[0], INNER_R[fl]*n[1])
        p1 = ((col_r-0.3)*n[0], (col_r-0.3)*n[1])
        mx, my = (p0[0]+p1[0])/2, (p0[1]+p1[1])/2
        L = math.hypot(p1[0]-p0[0], p1[1]-p0[1])
        b_dark.box(mx, my, col_t-0.72, L, 0.30, 0.42, am)
    # 楼层板
    b_dark.disc(FLOOR_R[fl], ming_z0, ming_z0+0.16)

    # 外墙（带门窗）
    if fl == 0:
        opens_d = [(da, 1.60, ming_z0, ming_z0+4.8) for da in (-15, 0, 15)]
        opens_w = [(-15, 1.10, ming_z0+1.4, ming_z0+4.6), (15, 1.10, ming_z0+1.4, ming_z0+4.6)]
    else:
        opens_d = [(0, 1.40, ming_z0, ming_z0+2.9)]
        opens_d += [(-15, 0.75, ming_z0+1.0, ming_z0+2.8), (15, 0.75, ming_z0+1.0, ming_z0+2.8)]
        opens_w = [(-15, 0.75, ming_z0+1.0, ming_z0+2.8), (15, 0.75, ming_z0+1.0, ming_z0+2.8)]
    for kk in range(N):
        op = opens_d if kk % 2 == 0 else opens_w
        wall_side_with_openings(b_wall, wall_r, wall_r-0.95, ming_z0, col_t-0.45, kk, op)

    # 内槽墙
    if fl == 0:
        for kk in range(N):
            am = kk*pi/4
            da = ((am*180/pi) - 270.0 + 180) % 360 - 180
            op = [(da, 1.2, ming_z0, ming_z0+3.0)] if abs(da) < 1 else []
            wall_side_with_openings(b_wall, NEIWALL_OUT[fl], NEIWALL_IN[fl], ming_z0, col_t-1.1, kk, op)
    else:
        b_wall.ring(NEIWALL_OUT[fl], NEIWALL_IN[fl], ming_z0, col_t-0.45)

    # 门窗扇
    for da, hw, zzt, zzt2 in opens_d:
        am = radians(da)
        if abs(da) < 1:
            for li in range(4):
                lt = -2*hw + (2*hw/4)*(2*li+1)
                add_door_leaf(b_door, am + math.asin(lt/wall_r), wall_r-0.30, zzt, 2*hw/4-0.06, zzt2-zzt)
        else:
            add_window(b_door, am, wall_r-0.30, zzt, 2*hw-0.10, zzt2-zzt)
    for da, hw, zzt, zzt2 in opens_w:
        add_window(b_door, radians(da), wall_r-0.30, zzt, 2*hw-0.10, zzt2-zzt)

    # 斗栱与屋檐
    add_brackets(b_dark, col_r, eave_z-1.30, scale=0.72)
    add_roof(b_roof, eave_r, eave_z, top_r, top_z, EAVE_LIFT[fl])

    # 佛像
    add_buddha(b_gold, zb if fl == 0 else ming_z0, 1.0 if fl == 0 else 0.62)

# ---------- 五层檐正脊、刹座与塔刹 ----------
print("[塔刹]")
b_roof.ring(6.1, 5.0, Z_APEX, Z_APEX+0.45)                 # 八角正脊
b_stone.disc(4.8, Z_APEX, Z_APEX+0.9)                      # 刹座（砖砌）
b_metal.cyl(0, 0, Z_APEX+1.12, 3.4, 0.45, n=16)            # 铁仰莲
b_metal.cyl(0, 0, Z_APEX+1.80, 2.2, 0.90, n=16, r_top=1.0) # 覆钵
z = Z_APEX + 2.25
for i in range(5):                                         # 五重相轮
    b_metal.cyl(0, 0, z + 0.28, 1.9 - 0.20*i, 0.56, n=16)
    z += 0.78
b_metal.cyl(0, 0, z + 0.45, 2.0, 0.90, n=16, r_top=0.5)    # 宝盖
b_metal.cyl(0, 0, z + 1.15, 1.0, 0.40, n=14)               # 圆光
b_metal.cyl(0, 0, z + 1.55, 0.55, 0.30, n=12)              # 仰月
b_metal.cyl(0, 0, z + 1.95, 0.55, 1.00, n=12, r_top=0.15)  # 宝珠
b_metal.cyl(0, 0, z + 3.20, 0.16, 1.50, n=8, r_top=0.0)    # 刹尖
b_metal.cyl(0, 0, (Z_APEX+Z_TOP)/2, 0.26, Z_TOP-Z_APEX, n=10)  # 刹杆

# ---------- 八条铁链 ----------
for k in range(N):
    th = CORNER_PHASE + k*pi/4
    p0 = (12.8*cos(th), 12.8*sin(th), 55.2)
    p2 = (0.30*cos(th), 0.30*sin(th), 63.8)
    pm = (5.0*cos(th), 5.0*sin(th), 57.6)
    pts = []
    for i in range(7):
        t = i/6
        x = (1-t)**2*p0[0] + 2*(1-t)*t*pm[0] + t**2*p2[0]
        y = (1-t)**2*p0[1] + 2*(1-t)*t*pm[1] + t**2*p2[1]
        zz = (1-t)**2*p0[2] + 2*(1-t)*t*pm[2] + t**2*p2[2]
        pts.append((x, y, zz))
    for a, b in zip(pts, pts[1:]):
        b_metal.tube(a, b, 0.05, n=6)

# ---------- 风铎（各檐角） ----------
eaves = [(FUJI_EAVE_R, FUJI_EAVE_Z, 0.4)] + list(zip(EAVE_R, EAVE_Z, EAVE_LIFT))
for (re_, ze, lf) in eaves:
    for k in range(N):
        th = CORNER_PHASE + k*pi/4
        x, y = re_*cos(th), re_*sin(th)
        zt = ze + lf
        b_metal.cyl(x, y, zt-0.42, 0.16, 0.32, n=8, r_top=0.05)
        b_metal.cyl(x, y, zt-0.66, 0.13, 0.20, n=8)

# ================= 生成对象 =================
print("=== 生成网格对象 ===")
objs = [
    b_stone.obj("taiji_platform", M_STONE),
    b_dark.obj("wood_structure", M_DARK),
    b_wall.obj("walls", M_WALL),
    b_door.obj("doors_windows", M_DOOR),
    b_roof.obj("roofs", M_ROOF),
    b_metal.obj("spire_iron", M_METAL),
    b_gold.obj("buddhas", M_GOLD),
]

# ================= 保存与导出 =================
import os
ROOT = "workspace"
here = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(here, "yixian_pagoda.blend"))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, "yingxian_pagoda.glb"),
                          export_format="GLB", export_apply=True)
sz = os.path.getsize(os.path.join(ROOT, "yingxian_pagoda.glb"))
print(f"GLB exported: {sz/1024/1024:.2f} MB")

# ================= 预览渲染（Workbench） =================
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'MATERIAL'
sc.display.shading.show_cavity = True
sc.render.resolution_x = 1100
sc.render.resolution_y = 850
world = bpy.data.worlds.new("W"); sc.world = world

def look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

cam_data = bpy.data.cameras.new("CAM"); cam = bpy.data.objects.new("CAM", cam_data)
bpy.context.collection.objects.link(cam); sc.camera = cam
cam.location = (80, -94, 48); look_at(cam, (0, 0, 28)); cam_data.lens = 42
sc.render.filepath = os.path.join(here, "preview_main.png")
bpy.ops.render.render(write_still=True)
cam.location = (2, -175, 32); look_at(cam, (0, 0, 30)); cam_data.lens = 55
sc.render.filepath = os.path.join(here, "preview_side.png")
bpy.ops.render.render(write_still=True)
cam.location = (0, -1, 150); look_at(cam, (0, 0, 0)); cam_data.type = 'ORTHO'; cam_data.ortho_scale = 75
sc.render.filepath = os.path.join(here, "preview_top.png")
bpy.ops.render.render(write_still=True)
print("=== 完成 ===")
