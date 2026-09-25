#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
应县木塔（佛宫寺释迦塔）Blender 参数化精准复刻
====================================================
数据来源：
- 维基百科「佛宫寺释迦塔」条目（梁思成1933年逐层相加测绘：通高67.31米）
- 陈明达《应县木塔》（文物出版社）经典测绘研究
关键数据：
  总高 67.31m | 台基高 4m（下层方形40m，上层八角形直径35.47m）
  底层塔身直径 30.27m | 内槽直径 10.25m | 塔刹高 12m
  外观5层，结构9层（5明层+4暗层）| 斗拱54种
"""
import bpy
import math
from math import pi, cos, sin, radians, sqrt
from mathutils import Vector

# ==================== 场景清理 ====================
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
    for block in list(coll):
        coll.remove(block)

# ==================== 材质 ====================
def make_mat(name, color, rough=0.8, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metallic
    # viewport 显示颜色（WORKBENCH 渲染用）
    m.diffuse_color = (*color, 1.0)
    return m

MAT_WOOD   = make_mat('Wood_Red',    (0.30, 0.09, 0.045), 0.70)  # 柱：红褐
MAT_WOOD2  = make_mat('Wood_Light',  (0.52, 0.32, 0.15),  0.75)  # 梁枋斗拱：浅木
MAT_WALL   = make_mat('Wall',        (0.76, 0.70, 0.58),  0.90)  # 墙：土黄白
MAT_ROOF   = make_mat('Roof',        (0.28, 0.31, 0.34),  0.85)  # 瓦：青灰
MAT_STONE  = make_mat('Stone',       (0.56, 0.54, 0.50),  0.90)  # 台基：石
MAT_IRON   = make_mat('Iron',        (0.16, 0.16, 0.18),  0.45, 0.85)  # 塔刹：铁
MAT_DOOR   = make_mat('Door',        (0.13, 0.055, 0.03), 0.75)  # 门扇：深木
MAT_GROUND = make_mat('Ground',      (0.42, 0.44, 0.40),  0.95)  # 地面

# ==================== 建筑参数（单位：米） ====================
N = 8                       # 八边形
ROT = -pi / 8               # 顶点偏移-22.5°，使8个面正对0°/45°/90°...（面6=南）

# 竖向标高（地面 z=0）—— 依据梁思成逐层相加测绘（总高67.31m）
Z_GROUND   = 0.0
Z_PLAT_TOP = 4.0            # 台基顶
# 一层（含副阶，总高11.5m）
Z_FUJIE_EAVE  = 8.5         # 副阶檐口
Z_M1_TOP      = 13.3        # 一层明层顶（暗层1底）
Z_M1_EAVE     = 14.5        # 一层主檐檐口
# 暗层1 → 二层
Z_D1_BOT, Z_D1_TOP = 13.3, 15.5     # 暗层1（明层1顶部）
Z_M2_EAVE    = 23.3         # 二层檐口
# 暗层2 → 三层
Z_D2_BOT, Z_D2_TOP = 23.3, 25.5     # 暗层2（明层2顶部）
Z_M3_EAVE    = 32.8         # 三层檐口
# 暗层3 → 四层
Z_D3_BOT, Z_D3_TOP = 32.8, 35.0     # 暗层3（明层3顶部）
Z_M4_EAVE    = 41.8         # 四层檐口
# 暗层4 → 五层
Z_D4_BOT, Z_D4_TOP = 41.8, 44.0     # 暗层4（明层4顶部）
Z_M5_EAVE    = 50.3         # 五层檐口（顶层檐）
Z_SHIKE_BOT  = 55.31        # 攒尖顶脊（刹座底）
Z_SPIRE_TOP  = 67.31        # 刹顶

# 明层数据：(明层层高, 外檐柱半径, 内槽柱半径)
MING = [
    (11.5, 15.135, 5.125),   # 一层（含副阶）
    (7.8,  13.90,  5.00),    # 二层
    (7.3,  12.70,  4.80),    # 三层
    (6.8,  11.60,  4.60),    # 四层
    (6.3,  10.60,  4.40),    # 五层
]
DARK_H = 2.2                 # 暗层层高
FUJIE_R = 17.0               # 副阶柱半径
FUJIE_EAVE_P = 3.2           # 副阶出檐
EAVE_P = [3.8, 3.4, 3.2, 3.0, 2.8]   # 各明层出檐深度
PINGZUO_W = 2.0              # 平座挑宽
RAIL_H = 1.1                 # 栏杆高

# ==================== 基础函数 ====================
def oct_pts(r, z, n=N, rot=ROT):
    """八边形顶点列表（逆时针）"""
    return [(r*cos(rot + 2*pi*k/n), r*sin(rot + 2*pi*k/n), z) for k in range(n)]

def oct_face_normal(i):
    """第i面（顶点i到i+1）的中心方向角"""
    return ROT + 2*pi*i/N + pi/N

def new_mesh_obj(name, verts, faces, mat=None, coll=None):
    me = bpy.data.meshes.new(name + '_mesh')
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(ob)
    if mat:
        ob.data.materials.append(mat)
    return ob

def add_cyl(name, r1, r2, z0, z1, n=12, mat=MAT_WOOD, loc=(0,0,0), coll=None):
    """圆/棱柱（r1底半径 r2顶半径，支持卷杀）"""
    bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r1, radius2=r2,
                                    depth=z1-z0, location=(loc[0], loc[1], (z0+z1)/2))
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(mat)
    if coll:
        for c in ob.users_collection:
            c.objects.unlink(ob)
        coll.objects.link(ob)
    return ob

def add_cube(name, loc, scale, mat=MAT_WOOD, rot_z=0.0, coll=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    if rot_z:
        ob.rotation_euler[2] = rot_z
    ob.data.materials.append(mat)
    if coll:
        for c in ob.users_collection:
            c.objects.unlink(ob)
        coll.objects.link(ob)
    return ob

def add_beam(name, p1, p2, w, h, mat=MAT_WOOD2):
    """方截面梁，p1→p2"""
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    mid = (p1 + p2) / 2
    bpy.ops.mesh.primitive_cube_add(size=1, location=mid)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (w/2, h/2, d.length/2)
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    ob.data.materials.append(mat)
    return ob

def get_collection(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c

# ==================== 台基 ====================
def build_platform():
    coll = get_collection('台基')
    # 下层：方形基座（边长40m），从地面到2.0m
    add_cube('台基_下层方形', (0, 0, 1.0), (20, 20, 1.0), MAT_STONE, coll=coll)
    # 上层：八角形（直径35.47m），从1.75m到4.0m（总高4m）
    r = 35.47/2
    add_cyl('台基_上层八角', r, r, 1.75, Z_PLAT_TOP, n=N, mat=MAT_STONE)
    # 月台（南东西三向，简化为三块石板）
    for ang, nm in [(pi, '西'), (pi*1.5, '南'), (0, '东')]:
        x, y = (r+1.5)*cos(ang), (r+1.5)*sin(ang)
        add_cube(f'月台_{nm}', (x, y, 2.2), (2.2, 1.6, 0.25), MAT_STONE, rot_z=ang)

# ==================== 柱子 ====================
def add_column_ring(name_prefix, radius, z0, z1, n_per_face, r_col, mat=MAT_WOOD,
                    taper=0.92, lean=0.0):
    """每面 n_per_face 根柱（含角柱共享），共 n_per_face*N 根"""
    coll = get_collection('柱网')
    count = n_per_face * N
    for k in range(count):
        # 角度：每面 n_per_face 等分（含两端角柱）
        face_i = k // n_per_face
        t = (k % n_per_face) / (n_per_face - 1) if n_per_face > 1 else 0.5
        a = ROT + 2*pi*face_i/N + (2*pi/N)*t
        x, y = radius*cos(a), radius*sin(a)
        ob = add_cyl(f'{name_prefix}_{k:03d}', r_col, r_col*taper, z0, z1, n=12, mat=mat)
        if lean:
            # 侧脚：柱脚外撇（绕切向轴旋转小角度）
            ob.rotation_euler[1] = lean * cos(a)
            ob.rotation_euler[0] = -lean * sin(a)
    return count

# ==================== 屋顶（凹曲屋面 + 檐口起翘） ====================
def create_roof(name, R_e, Z_e, R_r, Z_r, mat=MAT_ROOF, thick=0.3,
                sag=1.7, upturn=0.55, nseg=7, naround=9, collar=True):
    """八边形坡屋面：檐口起翘、凹曲（举折）、瓦垄凸条，带檐口厚度"""
    verts, faces = [], []
    for i in range(N):
        a0 = ROT + 2*pi*i/N
        a1 = ROT + 2*pi*(i+1)/N
        row = len(verts)
        for isg in range(nseg+1):
            s = isg / nseg
            for jg in range(naround+1):
                t = jg / naround
                a = a0 + (a1-a0)*t
                r = R_e + (R_r - R_e)*s
                z = Z_e + (Z_r - Z_e)*(s**sag)
                corner = abs(2*t - 1)**3
                z += upturn * corner * (1-s)**2
                # 瓦垄：沿径向的凸条（间隔列抬高）
                if jg % 2 == 0:
                    z += 0.07 * (1 - 0.5*s)
                verts.append((r*cos(a), r*sin(a), z))
    stride = naround + 1
    rowstride = stride * (nseg + 1)
    for i in range(N):
        b0, b1 = i*rowstride, ((i+1) % N)*rowstride
        for isg in range(nseg):
            for jg in range(naround):
                a = b0 + isg*stride + jg
                b, c, d = a+1, b1+isg*stride+jg+1, b1+isg*stride+jg
                faces.append((a, b, c, d))
    # 檐口翻边（向下加厚，形成封檐板效果）
    eave_start = len(verts)
    for i in range(N):
        a0 = ROT + 2*pi*i/N
        a1 = ROT + 2*pi*(i+1)/N
        for jg in range(naround+1):
            t = jg / naround
            a = a0 + (a1-a0)*t
            corner = abs(2*t - 1)**3
            z = Z_e + upturn*corner + (0.07 if jg % 2 == 0 else 0)
            verts.append((R_e*cos(a), R_e*sin(a), z))
            verts.append((R_e*cos(a), R_e*sin(a), z - thick))
    for i in range(N):
        b0, b1 = i*rowstride, ((i+1) % N)*rowstride
        for jg in range(naround):
            top_a, top_b = b0+jg, b0+jg+1
            bot_a, bot_b = eave_start + i*(naround+1)*2 + jg*2, eave_start + i*(naround+1)*2 + (jg+1)*2
            # 外翻边面
            faces.append((top_a, top_b, bot_b, bot_a))
            # 底面（檐口板）
            faces.append((bot_a, bot_b, bot_b+1, bot_a+1))
    # 屋脊封口（小八边形面）
    ridge_idx = len(verts)
    for k in range(N):
        a = ROT + 2*pi*k/N
        verts.append((R_r*cos(a), R_r*sin(a), Z_r))
    for k in range(N):
        a = (N-1)*rowstride + nseg*stride + k*(rowstride//N)  # 不对，直接算
    # 脊线顶点在每行 isg=nseg 处
    for i in range(N):
        b0 = i*rowstride + nseg*stride
        b1 = ((i+1) % N)*rowstride + nseg*stride
        faces.append((b0, b1, ridge_idx+(i+1) % N, ridge_idx+i))
    ob = new_mesh_obj(name, verts, faces, mat)
    return ob

# ==================== 斗拱层（整圈单物体） ====================
def create_bracket_ring(name, R, Z, H, mat=MAT_WOOD2):
    """整圈铺作层：栌斗+横栱+出跳，每面6朵"""
    verts, faces = [], []
    def box(cx, cy, cz, sx, sy, sz):
        base = len(verts)
        for dx in (-1, 1):
            for dy in (-1, 1):
                for dz in (-1, 1):
                    verts.append((cx+dx*sx/2, cy+dy*sy/2, cz+dz*sz/2))
        # 8顶点 → 6面
        f = [(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
        for q in f:
            faces.append(tuple(base+j for j in q))
    n_dou = 4  # 每面4朵（2柱头+2补间，简化）
    for i in range(N):
        a0 = ROT + 2*pi*i/N
        a1 = ROT + 2*pi*(i+1)/N
        for jd in range(n_dou):
            t = (jd + 0.5) / n_dou
            a = a0 + (a1-a0)*t
            r = R
            x, y = r*cos(a), r*sin(a)
            # 栌斗
            box(x, y, Z + H*0.25, 0.32, 0.32, H*0.5)
            # 横栱（沿切向）
            tang = a + pi/2
            dx, dy = cos(tang), sin(tang)
            box(x, y, Z + H*0.62, 1.0*dx if dx else 0.0, 1.0*dy if dy else 0.0, H*0.26)
            # 第二跳（沿径向出挑）
            out = 0.75
            box(x + cos(a)*out*0.5, y + sin(a)*out*0.5, Z + H*0.85, 0.6, 0.3, H*0.24)
            # 散斗
            box(x + cos(a)*out, y + sin(a)*out, Z + H*0.95, 0.26, 0.26, H*0.16)
    ob = new_mesh_obj(name, verts, faces, mat)
    return ob

# ==================== 平座 + 勾栏 ====================
def create_pingzuo(name, R_in, z_bot, mat=MAT_WOOD2, rail=True):
    """悬挑平座板 + 栏杆（望柱+扶手）"""
    R_out = R_in + PINGZUO_W
    coll = get_collection('平座')
    # 平座板（八边形环）
    v_bot = oct_pts(R_in, z_bot) + oct_pts(R_out, z_bot)
    v_top = oct_pts(R_in, z_bot+0.35) + oct_pts(R_out, z_bot+0.35)
    verts = v_bot + v_top
    faces = []
    for i in range(N):
        j = (i+1) % N
        # 顶面
        faces.append((N+i, N+j, j, i))
        # 外侧面
        faces.append((N+j, N+i+2*N if False else N+j, j, i))
    # 简化：直接用四边形环
    faces = []
    for i in range(N):
        j = (i+1) % N
        faces.append((N+i, N+j, j, i))                    # 顶面
        faces.append((2*N+i, 2*N+j, j+N, i+N))            # 底面
        faces.append((i, j, 2*N+j, 2*N+i))                # 内侧面
        faces.append((N+i, N+j, 2*N+j, 2*N+i))            # 外侧面
    new_mesh_obj(name + '_板', verts, faces, mat)
    if not rail:
        return
    # 栏杆：望柱 + 扶手 + 栏板
    rail_verts, rail_faces = [], []
    def rbox(cx, cy, cz, sx, sy, sz):
        base = len(rail_verts)
        for dx in (-1, 1):
            for dy in (-1, 1):
                for dz in (-1, 1):
                    rail_verts.append((cx+dx*sx/2, cy+dy*sy/2, cz+dz*sz/2))
        f = [(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
        for q in f:
            rail_faces.append(tuple(base+j for j in q))
    n_post = 5  # 每面5望柱
    for i in range(N):
        a0 = ROT + 2*pi*i/N
        a1 = ROT + 2*pi*(i+1)/N
        for jp in range(n_post):
            t = jp / (n_post-1) if n_post > 1 else 0.5
            a = a0 + (a1-a0)*t
            x, y = R_out*cos(a), R_out*sin(a)
            rbox(x, y, z_bot + 0.35 + RAIL_H/2, 0.14, 0.14, RAIL_H)
        # 扶手（通长）
        p1 = (R_out*cos(a0), R_out*sin(a0), z_bot+0.35+RAIL_H)
        p2 = (R_out*cos(a1), R_out*sin(a1), z_bot+0.35+RAIL_H)
        mid = ((p1[0]+p2[0])/2, (p1[1]+p2[1])/2, p1[2])
        rbox(mid[0], mid[1], mid[2], abs(p2[0]-p1[0])*1.05, 0.12, 0.12)
        # 栏板
        mid2 = ((p1[0]+p2[0])/2, (p1[1]+p2[1])/2, z_bot+0.35+RAIL_H*0.45)
        rbox(mid2[0], mid2[1], mid2[2], abs(p2[0]-p1[0])*0.95, 0.06, RAIL_H*0.5)
    new_mesh_obj(name + '_栏杆', rail_verts, rail_faces, mat)

# ==================== 内槽墙（一层厚墙） ====================
def create_inner_wall_m1():
    """一层内槽：直径10.25m净空，墙厚2.86m，南北开门"""
    coll = get_collection('墙体')
    r_in = 5.125
    th = 2.86
    z0, z1 = Z_PLAT_TOP, Z_M1_TOP
    # 每面一段墙（南面k=6、北面k=2 留门洞）
    for i in range(N):
        a0 = ROT + 2*pi*i/N
        a1 = ROT + 2*pi*(i+1)/N
        if i in (2, 6):  # 南北面：门两侧墙垛
            for t0, t1 in [(0.0, 0.32), (0.68, 1.0)]:
                am0, am1 = a0+(a1-a0)*t0, a0+(a1-a0)*t1
                verts = [
                    (r_in*cos(am0), r_in*sin(am0), z0), (r_in*cos(am1), r_in*sin(am1), z0),
                    (r_in*cos(am1), r_in*sin(am1), z1), (r_in*cos(am0), r_in*sin(am0), z1),
                    ((r_in+th)*cos(am0), (r_in+th)*sin(am0), z0), ((r_in+th)*cos(am1), (r_in+th)*sin(am1), z0),
                    ((r_in+th)*cos(am1), (r_in+th)*sin(am1), z1), ((r_in+th)*cos(am0), (r_in+th)*sin(am0), z1),
                ]
                faces = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(0,3,7,4),(1,5,6,2)]
                new_mesh_obj(f'一层内槽墙_{i}', verts, faces, MAT_WALL)
            # 门楣
            am = (a0+a1)/2
            add_cube(f'一层门楣_{i}', ((r_in+th/2)*cos(am), (r_in+th/2)*sin(am), z1+0.4),
                     (2.2, th+0.3, 0.8), MAT_WOOD2, rot_z=am+pi/2)
        else:
            am0, am1 = a0, a1
            verts = [
                (r_in*cos(am0), r_in*sin(am0), z0), (r_in*cos(am1), r_in*sin(am1), z0),
                (r_in*cos(am1), r_in*sin(am1), z1), (r_in*cos(am0), r_in*sin(am0), z1),
                ((r_in+th)*cos(am0), (r_in+th)*sin(am0), z0), ((r_in+th)*cos(am1), (r_in+th)*sin(am1), z0),
                ((r_in+th)*cos(am1), (r_in+th)*sin(am1), z1), ((r_in+th)*cos(am0), (r_in+th)*sin(am0), z1),
            ]
            faces = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(0,3,7,4),(1,5,6,2)]
            new_mesh_obj(f'一层内槽墙_{i}', verts, faces, MAT_WALL)
    # 外檐柱墙（内槽外2.38m，厚2.6m，南北开门）
    r_out_wall = r_in + th + 2.38 + 1.3
    th2 = 2.6
    for i in range(N):
        a0 = ROT + 2*pi*i/N
        a1 = ROT + 2*pi*(i+1)/N
        if i in (2, 6):
            for t0, t1 in [(0.0, 0.3), (0.7, 1.0)]:
                am0, am1 = a0+(a1-a0)*t0, a0+(a1-a0)*t1
                verts = [
                    ((r_out_wall-th2/2)*cos(am0), (r_out_wall-th2/2)*sin(am0), Z_PLAT_TOP),
                    ((r_out_wall-th2/2)*cos(am1), (r_out_wall-th2/2)*sin(am1), Z_PLAT_TOP),
                    ((r_out_wall-th2/2)*cos(am1), (r_out_wall-th2/2)*sin(am1), Z_FUJIE_EAVE+0.5),
                    ((r_out_wall-th2/2)*cos(am0), (r_out_wall-th2/2)*sin(am0), Z_FUJIE_EAVE+0.5),
                    ((r_out_wall+th2/2)*cos(am0), (r_out_wall+th2/2)*sin(am0), Z_PLAT_TOP),
                    ((r_out_wall+th2/2)*cos(am1), (r_out_wall+th2/2)*sin(am1), Z_PLAT_TOP),
                    ((r_out_wall+th2/2)*cos(am1), (r_out_wall+th2/2)*sin(am1), Z_FUJIE_EAVE+0.5),
                    ((r_out_wall+th2/2)*cos(am0), (r_out_wall+th2/2)*sin(am0), Z_FUJIE_EAVE+0.5),
                ]
                faces = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(0,3,7,4),(1,5,6,2)]
                new_mesh_obj(f'一层外墙_{i}', verts, faces, MAT_WALL)
        else:
            am0, am1 = a0, a1
            verts = [
                ((r_out_wall-th2/2)*cos(am0), (r_out_wall-th2/2)*sin(am0), Z_PLAT_TOP),
                ((r_out_wall-th2/2)*cos(am1), (r_out_wall-th2/2)*sin(am1), Z_PLAT_TOP),
                ((r_out_wall-th2/2)*cos(am1), (r_out_wall-th2/2)*sin(am1), Z_FUJIE_EAVE+0.5),
                ((r_out_wall-th2/2)*cos(am0), (r_out_wall-th2/2)*sin(am0), Z_FUJIE_EAVE+0.5),
                ((r_out_wall+th2/2)*cos(am0), (r_out_wall+th2/2)*sin(am0), Z_PLAT_TOP),
                ((r_out_wall+th2/2)*cos(am1), (r_out_wall+th2/2)*sin(am1), Z_PLAT_TOP),
                ((r_out_wall+th2/2)*cos(am1), (r_out_wall+th2/2)*sin(am1), Z_FUJIE_EAVE+0.5),
                ((r_out_wall+th2/2)*cos(am0), (r_out_wall+th2/2)*sin(am0), Z_FUJIE_EAVE+0.5),
            ]
            faces = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(0,3,7,4),(1,5,6,2)]
            new_mesh_obj(f'一层外墙_{i}', verts, faces, MAT_WALL)

# ==================== 明层门窗 ====================
def create_doors_windows(floor_idx, R, z0, z1):
    """二层以上：四正面(k=0,2,4,6)各4扇格子门，四斜面(k=1,3,5,7)各2扇+心柱"""
    coll = get_collection('门窗')
    h = z1 - z0
    for i in range(N):
        a0 = ROT + 2*pi*i/N
        a1 = ROT + 2*pi*(i+1)/N
        if i % 2 == 0:  # 正面：4扇门
            n_leaf = 4
        else:           # 斜面：2扇门+心柱
            n_leaf = 2
        for jl in range(n_leaf):
            t0 = jl/n_leaf + 0.03
            t1 = (jl+1)/n_leaf - 0.03
            am0, am1 = a0+(a1-a0)*t0, a0+(a1-a0)*t1
            rm = R - 0.15
            # 门扇（深色木板）
            verts = [
                (rm*cos(am0), rm*sin(am0), z0+0.3), (rm*cos(am1), rm*sin(am1), z0+0.3),
                (rm*cos(am1), rm*sin(am1), z1-0.6), (rm*cos(am0), rm*sin(am0), z1-0.6),
                ((rm-0.25)*cos(am0), (rm-0.25)*sin(am0), z0+0.3), ((rm-0.25)*cos(am1), (rm-0.25)*sin(am1), z0+0.3),
                ((rm-0.25)*cos(am1), (rm-0.25)*sin(am1), z1-0.6), ((rm-0.25)*cos(am0), (rm-0.25)*sin(am0), z1-0.6),
            ]
            faces = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(0,3,7,4),(1,5,6,2)]
            new_mesh_obj(f'门{floor_idx}_{i}_{jl}', verts, faces, MAT_DOOR)
            # 门框
            am = (am0+am1)/2
            add_cube(f'门框{floor_idx}_{i}_{jl}', (rm*cos(am), rm*sin(am), z1-0.5),
                     (0.35, 0.4, 0.7), MAT_WOOD2, rot_z=am+pi/2)
        # 斜面心柱
        if i % 2 == 1:
            am = (a0+a1)/2
            add_cyl(f'心柱{floor_idx}_{i}', 0.28, 0.24, z0, z1, n=10, mat=MAT_WOOD)
            # 心柱位置
            ob = bpy.context.active_object
            ob.location.x, ob.location.y = R*cos(am), R*sin(am)
    # 阑额（柱顶联系枋，整圈）
    add_cyl(f'阑额{floor_idx}', R+0.12, R+0.12, z1-0.55, z1, n=N, mat=MAT_WOOD2)

# ==================== 暗层斜撑 ====================
def create_dark_floor(idx, R_out, R_in, z0, z1):
    """暗层：矮柱 + X形斜撑（抗震关键结构）"""
    coll = get_collection('暗层')
    # 外檐矮柱
    add_column_ring(f'暗层{idx}外柱', R_out, z0, z1, 3, 0.32, mat=MAT_WOOD)
    # 内柱
    add_column_ring(f'暗层{idx}内柱', R_in, z0, z1, 1, 0.32, mat=MAT_WOOD)
    # 每面X形斜撑（2根交叉梁）
    for i in range(N):
        a0 = ROT + 2*pi*i/N
        a1 = ROT + 2*pi*(i+1)/N
        am = (a0+a1)/2
        p_out_b = (R_out*cos(a0), R_out*sin(a0), z0+0.15)
        p_out_t = (R_out*cos(a1), R_out*sin(a1), z1-0.15)
        p_in_b = (R_in*cos(a0), R_in*sin(a0), z0+0.15)
        p_in_t = (R_in*cos(a1), R_in*sin(a1), z1-0.15)
        add_beam(f'斜撑{idx}_{i}a', p_out_b, p_in_t, 0.22, 0.18, MAT_WOOD2)
        add_beam(f'斜撑{idx}_{i}b', p_out_t, p_in_b, 0.22, 0.18, MAT_WOOD2)
        # 面中心垂直短柱
        add_cyl(f'暗层{idx}面柱{i}', 0.26, 0.22, z0, z1, n=10, mat=MAT_WOOD,
                loc=(R_out*cos(am), R_out*sin(am), 0))

# ==================== 楼梯 ====================
def create_stairs():
    """一层西南回廊内木楼梯（上下两跑）"""
    coll = get_collection('楼梯')
    # 西南斜面(k=5, 225°)附近
    a = ROT + 2*pi*5/N + pi/N  # 面5中心
    r_mid = 11.0
    x0, y0 = r_mid*cos(a), r_mid*sin(a)
    # 第一跑
    steps = 8
    rise = (Z_PLAT_TOP + 2.2 - Z_PLAT_TOP) / steps
    run = 0.28
    for s in range(steps):
        z = Z_PLAT_TOP + s * rise
        d = s * run
        x = x0 + d*cos(a+pi/2)
        y = y0 + d*sin(a+pi/2)
        add_cube(f'踏步1_{s}', (x, y, z), (0.9, run, 0.09), MAT_WOOD2)
    # 第二跑（折返）
    for s in range(steps):
        z = Z_PLAT_TOP + 2.2 + s * rise
        d = (steps-1-s) * run
        x = x0 + d*cos(a+pi/2) + 1.1*cos(a-pi/2)
        y = y0 + d*sin(a+pi/2) + 1.1*sin(a-pi/2)
        add_cube(f'踏步2_{s}', (x, y, z), (0.9, run, 0.09), MAT_WOOD2)
    # 扶手梁
    add_beam('楼梯扶手1', (x0, y0, Z_PLAT_TOP+1.0),
             (x0+steps*run*cos(a+pi/2), y0+steps*run*sin(a+pi/2), Z_PLAT_TOP+3.2),
             0.1, 0.1, MAT_WOOD2)

# ==================== 塔刹 ====================
def create_spire():
    coll = get_collection('塔刹')
    z0 = Z_SHIKE_BOT
    # 刹座：砖基座 + 铁仰莲
    add_cyl('刹座基座', 3.2, 2.8, z0, z0+1.0, n=N, mat=MAT_STONE)
    add_cyl('刹座仰莲', 2.8, 2.2, z0+1.0, z0+1.6, n=N, mat=MAT_IRON)
    # 覆钵
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=2.0,
                                         location=(0, 0, z0+2.4))
    ob = bpy.context.active_object
    ob.name = '覆钵'
    ob.scale = (1, 1, 0.75)
    ob.data.materials.append(MAT_IRON)
    # 五重相轮
    for i in range(5):
        r = 2.3 - i*0.28
        add_cyl(f'相轮{i+1}', r, r*0.92, z0+3.2+i*1.15, z0+3.2+i*1.15+0.5,
                n=16, mat=MAT_IRON)
    # 圆光
    z_ring = z0 + 3.2 + 5*1.15 + 0.4
    bpy.ops.mesh.primitive_torus_add(major_radius=1.1, minor_radius=0.22,
                                     major_segments=16, minor_segments=8,
                                     location=(0, 0, z_ring))
    ob = bpy.context.active_object
    ob.name = '圆光'
    ob.data.materials.append(MAT_IRON)
    # 宝盖（伞盖）
    add_cyl('宝盖', 1.9, 0.9, z_ring+0.5, z_ring+1.5, n=12, mat=MAT_IRON)
    # 宝珠
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=0.55,
                                         location=(0, 0, z_ring+2.1))
    ob = bpy.context.active_object
    ob.name = '宝珠'
    ob.data.materials.append(MAT_IRON)
    # 刹杆
    add_cyl('刹杆', 0.18, 0.18, z0, Z_SPIRE_TOP, n=8, mat=MAT_IRON)
    # 8条铁链（宝盖→檐角）
    z_chain0 = z_ring + 1.0
    for k in range(N):
        a = ROT + 2*pi*k/N + pi/N
        p1 = (1.6*cos(a), 1.6*sin(a), z_chain0)
        p2 = (13.6*cos(a), 13.6*sin(a), Z_M5_EAVE + 0.4)
        add_beam(f'铁链{k}', p1, p2, 0.06, 0.06, MAT_IRON)

# ==================== 一层佛像（内部） ====================
def create_buddha():
    coll = get_collection('佛像')
    z0 = Z_PLAT_TOP
    # 座
    add_cyl('佛座', 2.2, 1.8, z0, z0+1.5, n=8, mat=MAT_WOOD2)
    # 身（圆柱）
    add_cyl('佛身', 1.1, 0.85, z0+1.5, z0+7.5, n=12, mat=MAT_WOOD2)
    # 头
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.85,
                                         location=(0, 0, z0+8.4))
    ob = bpy.context.active_object
    ob.name = '佛头'
    ob.data.materials.append(MAT_WOOD2)
    # 背光（简化圆环板）
    add_cyl('背光', 2.6, 2.6, z0+4.0, z0+9.0, n=16, mat=MAT_WOOD2)
    ob = bpy.context.active_object
    ob.scale = (1, 0.25, 1)

# ==================== 主构建 ====================
def build():
    build_platform()

    # ---- 一层（明层1，总高11.5m） ----
    # 副阶柱（24根，每面3间）
    add_column_ring('副阶柱', FUJIE_R, Z_PLAT_TOP, Z_FUJIE_EAVE-1.0, 3, 0.42)
    # 副阶阑额
    add_cyl('副阶阑额', FUJIE_R+0.1, FUJIE_R+0.1, Z_FUJIE_EAVE-1.3, Z_FUJIE_EAVE-1.0,
            n=N, mat=MAT_WOOD2)
    # 副阶斗拱圈
    create_bracket_ring('副阶斗拱', FUJIE_R+0.35, Z_FUJIE_EAVE-1.0, 1.0)
    # 副阶檐（下檐）
    create_roof('副阶檐', FUJIE_R+FUJIE_EAVE_P, Z_FUJIE_EAVE, 15.9, 10.5,
                upturn=0.5)

    # 一层明层柱（檐柱24根，每面3间；内槽柱8根）
    add_column_ring('一层檐柱', MING[0][1], Z_PLAT_TOP, Z_M1_TOP, 3, 0.50)
    add_column_ring('一层内槽柱', MING[0][2], Z_PLAT_TOP, Z_M1_TOP, 1, 0.42)
    # 内槽墙+外墙
    create_inner_wall_m1()
    # 一层阑额
    add_cyl('一层阑额', MING[0][1]+0.12, MING[0][1]+0.12, Z_M1_TOP-0.55, Z_M1_TOP,
            n=N, mat=MAT_WOOD2)
    # 一层斗拱圈
    create_bracket_ring('一层斗拱', MING[0][1]+0.4, Z_M1_TOP, 1.2)
    # 一层主檐（上檐）
    create_roof('一层主檐', MING[0][1]+EAVE_P[0], Z_M1_EAVE, 13.9, 15.5, upturn=0.65)
    # 一层大门（开在外檐柱墙门洞处，半径12.5m，南北两面）
    r_wall = 5.125 + 2.86 + 2.38 + 1.3  # 外墙中心半径
    for i in (2, 6):  # 北、南
        a0 = ROT + 2*pi*i/N
        a1 = ROT + 2*pi*(i+1)/N
        am = (a0+a1)/2
        # 门扇（双扇大门）
        for t0, t1 in [(0.32, 0.5), (0.5, 0.68)]:
            am0, am1 = a0+(a1-a0)*t0, a0+(a1-a0)*t1
            verts = [
                (r_wall*cos(am0), r_wall*sin(am0), Z_PLAT_TOP),
                (r_wall*cos(am1), r_wall*sin(am1), Z_PLAT_TOP),
                (r_wall*cos(am1), r_wall*sin(am1), Z_FUJIE_EAVE+0.5),
                (r_wall*cos(am0), r_wall*sin(am0), Z_FUJIE_EAVE+0.5),
                ((r_wall-0.2)*cos(am0), (r_wall-0.2)*sin(am0), Z_PLAT_TOP),
                ((r_wall-0.2)*cos(am1), (r_wall-0.2)*sin(am1), Z_PLAT_TOP),
                ((r_wall-0.2)*cos(am1), (r_wall-0.2)*sin(am1), Z_FUJIE_EAVE+0.5),
                ((r_wall-0.2)*cos(am0), (r_wall-0.2)*sin(am0), Z_FUJIE_EAVE+0.5),
            ]
            faces = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(0,3,7,4),(1,5,6,2)]
            new_mesh_obj(f'一层大门_{i}_{t0}', verts, faces, MAT_DOOR)
        # 门框
        add_cube(f'一层门框_{i}', (r_wall*cos(am), r_wall*sin(am), Z_FUJIE_EAVE+0.9),
                 (0.5, 0.5, 0.9), MAT_WOOD2, rot_z=am+pi/2)
    # 楼梯
    create_stairs()
    # 佛像
    create_buddha()

    # ---- 暗层1（明层1顶部）+ 二层 ----
    create_dark_floor(1, MING[1][1], MING[1][2], Z_D1_BOT, Z_D1_TOP)
    # 二层柱
    add_column_ring('二层外柱', MING[1][1], Z_D1_TOP, Z_M2_EAVE-1.2, 3, 0.46)
    add_column_ring('二层内柱', MING[1][2], Z_D1_TOP, Z_M2_EAVE-1.2, 1, 0.40)
    add_cyl('二层阑额', MING[1][1]+0.12, MING[1][1]+0.12, Z_M2_EAVE-1.75, Z_M2_EAVE-1.2,
            n=N, mat=MAT_WOOD2)
    create_bracket_ring('二层斗拱', MING[1][1]+0.4, Z_M2_EAVE-1.2, 1.2)
    # 二层平座（悬挑，在暗层1顶部/明层2柱脚处）
    create_pingzuo('二层平座', MING[1][1], Z_D1_TOP)
    # 二层门窗
    create_doors_windows(2, MING[1][1], Z_D1_TOP, Z_M2_EAVE-1.75)
    # 二层檐
    create_roof('二层檐', MING[1][1]+EAVE_P[1], Z_M2_EAVE, 12.7, 25.5, upturn=0.6)

    # ---- 暗层2 + 三层 ----
    create_dark_floor(2, MING[2][1], MING[2][2], Z_D2_BOT, Z_D2_TOP)
    add_column_ring('三层外柱', MING[2][1], Z_D2_TOP, Z_M3_EAVE-1.2, 3, 0.44)
    add_column_ring('三层内柱', MING[2][2], Z_D2_TOP, Z_M3_EAVE-1.2, 1, 0.38)
    add_cyl('三层阑额', MING[2][1]+0.12, MING[2][1]+0.12, Z_M3_EAVE-1.75, Z_M3_EAVE-1.2,
            n=N, mat=MAT_WOOD2)
    create_bracket_ring('三层斗拱', MING[2][1]+0.4, Z_M3_EAVE-1.2, 1.2)
    create_pingzuo('三层平座', MING[2][1], Z_D2_TOP)
    create_doors_windows(3, MING[2][1], Z_D2_TOP, Z_M3_EAVE-1.75)
    create_roof('三层檐', MING[2][1]+EAVE_P[2], Z_M3_EAVE, 11.6, 35.0, upturn=0.55)

    # ---- 暗层3 + 四层 ----
    create_dark_floor(3, MING[3][1], MING[3][2], Z_D3_BOT, Z_D3_TOP)
    add_column_ring('四层外柱', MING[3][1], Z_D3_TOP, Z_M4_EAVE-1.2, 3, 0.42)
    add_column_ring('四层内柱', MING[3][2], Z_D3_TOP, Z_M4_EAVE-1.2, 1, 0.36)
    add_cyl('四层阑额', MING[3][1]+0.12, MING[3][1]+0.12, Z_M4_EAVE-1.75, Z_M4_EAVE-1.2,
            n=N, mat=MAT_WOOD2)
    create_bracket_ring('四层斗拱', MING[3][1]+0.4, Z_M4_EAVE-1.2, 1.2)
    create_pingzuo('四层平座', MING[3][1], Z_D3_TOP)
    create_doors_windows(4, MING[3][1], Z_D3_TOP, Z_M4_EAVE-1.75)
    create_roof('四层檐', MING[3][1]+EAVE_P[3], Z_M4_EAVE, 10.6, 44.0, upturn=0.5)

    # ---- 暗层4 + 五层 ----
    create_dark_floor(4, MING[4][1], MING[4][2], Z_D4_BOT, Z_D4_TOP)
    add_column_ring('五层外柱', MING[4][1], Z_D4_TOP, Z_M5_EAVE-1.2, 3, 0.40)
    add_column_ring('五层内柱', MING[4][2], Z_D4_TOP, Z_M5_EAVE-1.2, 1, 0.34)
    add_cyl('五层阑额', MING[4][1]+0.12, MING[4][1]+0.12, Z_M5_EAVE-1.75, Z_M5_EAVE-1.2,
            n=N, mat=MAT_WOOD2)
    create_bracket_ring('五层斗拱', MING[4][1]+0.4, Z_M5_EAVE-1.2, 1.2)
    create_pingzuo('五层平座', MING[4][1], Z_D4_TOP)
    create_doors_windows(5, MING[4][1], Z_D4_TOP, Z_M5_EAVE-1.75)
    # 五层檐 + 攒尖顶（脊收小）
    create_roof('五层檐攒尖', MING[4][1]+EAVE_P[4], Z_M5_EAVE, 2.8, Z_SHIKE_BOT, upturn=0.45)

    # ---- 塔刹 ----
    create_spire()

    # ---- 地面 ----
    add_cube('地面', (0, 0, -0.5), (60, 60, 0.5), MAT_GROUND)

# ==================== 相机与灯光 ====================
def setup_camera():
    coll = get_collection('相机')
    # 相机（拉远看全塔，总高67m）
    bpy.ops.object.camera_add(location=(80, -80, 38))
    cam = bpy.context.active_object
    cam.name = '主相机'
    # 看向塔中心 (0,0,32)
    direction = Vector((0, 0, 32)) - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 52
    bpy.context.scene.camera = cam
    # 灯光
    bpy.ops.object.light_add(type='SUN', location=(30, -30, 60))
    sun = bpy.context.active_object
    sun.name = '阳光'
    sun.data.energy = 3.0
    sun.rotation_euler = (radians(50), 0, radians(35))
    bpy.ops.object.light_add(type='AREA', location=(-30, -20, 40))
    area = bpy.context.active_object
    area.name = '补光'
    area.data.energy = 800
    area.data.size = 30
    direction = Vector((0, 0, 28)) - area.location
    area.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

# ==================== 渲染设置 ====================
def setup_render():
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.render.resolution_x = 900
    sc.render.resolution_y = 1200
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    # 世界背景
    world = bpy.data.worlds.new('世界') if not bpy.data.worlds else bpy.data.worlds[0]
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (0.75, 0.78, 0.82, 1.0)
    bg.inputs[1].default_value = 1.0

# ==================== 执行 ====================
if __name__ == '__main__':
    build()
    setup_camera()
    setup_render()
    # 保存
    import os
    out_dir = os.path.dirname(os.path.abspath(__file__))
    blend_path = os.path.join(out_dir, '应县木塔.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f'已保存: {blend_path}')
    # 统计
    n_obj = len(bpy.data.objects)
    n_tri = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print(f'物体数: {n_obj}, 面片数: {n_tri}')
