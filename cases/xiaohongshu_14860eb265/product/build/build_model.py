#!/usr/bin/env python3
"""Hanging Temple (悬空寺) procedural model builder for Blender 5.2.

Builds: cliff terrain, rock ledges, 3 timber halls with hip roofs, cantilever
structure, walkways, stairs, bridge, props, 4 joinery detail assemblies,
studio + camera + lighting rigs. Exports GLB/DAE/FBX and renders stills.

Usage:
  blender --background --factory-startup --python build_model.py [-- --skip-renders]
"""
import bpy
import bmesh
import math
import os
import sys
import json
import numpy as np
from mathutils import Vector, Matrix

# ---------------------------------------------------------------- args
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SKIP_RENDER = '--skip-renders' in argv
ONLY_GLB = '--only-glb' in argv
TEST_ONE = '--test' in argv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TEX = os.path.join(ROOT, 'assets', 'textures')
OUT = os.path.join(ROOT, 'output')
REN = os.path.join(OUT, 'renders')
os.makedirs(REN, exist_ok=True)

# ---------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- noise (numpy)
def fbm2(x, y, freq, octaves=4, persistence=0.55, rng=None):
    x = np.asarray(x, dtype=np.float32)
    y = np.asarray(y, dtype=np.float32)
    out = np.zeros(np.broadcast(x, y).shape, dtype=np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        f = freq * (2 ** o)
        gx = (x * f) % 1.0
        gy = (y * f) % 1.0
        ix = (gx * 64).astype(int) % 64
        iy = (gy * 64).astype(int) % 64
        if rng is None:
            rng = np.random.default_rng(1234 + o)
        g = rng.random((65, 65)).astype(np.float32)
        fx = (gx * 64) - ix
        fy = (gy * 64) - iy
        fx = fx * fx * (3 - 2 * fx)
        fy = fy * fy * (3 - 2 * fy)
        v = (g[iy, ix] * (1 - fx) + g[iy, ix + 1] * fx) * (1 - fy) + \
            (g[iy + 1, ix] * (1 - fx) + g[iy + 1, ix + 1] * fx) * fy
        out += v * amp
        total += amp
        amp *= persistence
    return out / total

# ---------------------------------------------------------------- collections
def new_col(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

COL = {n: new_col(n) for n in
       ['CLIFF', 'TERRAIN', 'BUILDINGS', 'STRUCTURE', 'PROPS', 'DETAILS', 'STUDIO', 'CAMERAS', 'LIGHTS']}

def link_to(obj, colname):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    COL[colname].objects.link(obj)
    return obj

# ---------------------------------------------------------------- materials
def load_img(name):
    return bpy.data.images.load(os.path.join(TEX, name), check_existing=True)

def mat_principled(name, color, rough=0.6, metallic=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metallic
    return m

def mat_tex(name, img_name, color, rough=0.6, scale=(1, 1, 1), bump=0.0, metallic=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metallic
    img = load_img(img_name)
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = scale
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], tex.inputs['Vector'])
    out_color = bsdf.inputs['Base Color']
    if isinstance(color, tuple):
        # mix texture with tint
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.inputs['Factor'].default_value = 1.0
        mix.inputs[7].default_value = (*color, 1.0)  # B color
        nt.links.new(tex.outputs['Color'], mix.inputs[6])  # A color
        nt.links.new(mix.outputs[2], out_color)
    else:
        nt.links.new(tex.outputs['Color'], out_color)
    if bump > 0:
        b = nt.nodes.new('ShaderNodeBump')
        b.inputs['Strength'].default_value = bump
        b.inputs['Distance'].default_value = 0.15
        nt.links.new(tex.outputs['Color'], b.inputs['Height'])
        nt.links.new(b.outputs['Normal'], bsdf.inputs['Normal'])
    return m

def mat_emissive(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1.0)
    em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m

M = {}
M['rock'] = mat_tex('岩石', 'rock_cliff.png', (0.82, 0.74, 0.64), rough=0.93, scale=(1, 1, 1), bump=0.5)
M['tile'] = mat_tex('琉璃瓦', 'glazed_tile.png', (1, 1, 1), rough=0.32, scale=(1, 1, 1), bump=0.35, metallic=0.08)
M['ridge'] = mat_tex('脊瓦', 'glazed_tile.png', (0.72, 0.52, 0.16), rough=0.4, bump=0.2)
M['wood'] = mat_tex('木材', 'wood.png', (1, 1, 1), rough=0.62, bump=0.15)
M['wood_dark'] = mat_tex('深色木材', 'wood.png', (0.45, 0.28, 0.16), rough=0.7, bump=0.15)
M['plank'] = mat_tex('木板', 'plank.png', (1, 1, 1), rough=0.75, bump=0.2)
M['brick'] = mat_tex('砖墙', 'brick.png', (1, 1, 1), rough=0.85, bump=0.3)
M['stone'] = mat_tex('石材', 'stone.png', (1, 1, 1), rough=0.8, bump=0.25)
M['terrain'] = mat_tex('地面', 'terrain.png', (1, 1, 1), rough=0.95, bump=0.3)
M['redwall'] = mat_tex('红墙', 'red_wall.png', (0.62, 0.16, 0.10), rough=0.85, bump=0.12)
M['vermilion'] = mat_principled('朱红立柱', (0.55, 0.10, 0.06), rough=0.5)
M['lattice'] = mat_tex('窗棂', 'lattice.png', (1, 1, 1), rough=0.7)
M['bronze'] = mat_principled('青铜', (0.32, 0.24, 0.14), rough=0.35, metallic=0.9)
M['gold'] = mat_principled('金漆', (0.85, 0.65, 0.25), rough=0.3, metallic=0.75)
M['lantern'] = mat_emissive('灯笼光', (1.0, 0.35, 0.12), 6.0)
M['window_glow'] = mat_emissive('窗内暖光', (1.0, 0.62, 0.28), 3.0)
M['smoke'] = None  # handled separately

# smoke texture with alpha
img = bpy.data.images.load(os.path.join(TEX, 'smoke.png')) if os.path.exists(os.path.join(TEX, 'smoke.png')) else None
if img is None:
    # generate smoke alpha texture
    S = 256
    yy, xx = np.mgrid[0:S, 0:S]
    cx = cy = S / 2
    r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / (S / 2)
    alpha = np.clip(1 - r, 0, 1) ** 2
    blob = fbm2(xx.astype(np.float32) / S * 4, yy.astype(np.float32) / S * 4, 3, 4)
    alpha = alpha * (0.55 + 0.45 * blob)
    rgba = np.dstack([np.ones_like(alpha), np.ones_like(alpha) * 0.9, np.ones_like(alpha) * 0.85, alpha]).astype(np.float32)
    img = bpy.data.images.new('smoke', width=S, height=S, alpha=True)
    img.pixels = rgba.ravel()
    img.pack()
m_smoke = bpy.data.materials.new('香烟')
m_smoke.use_nodes = True
nt = m_smoke.node_tree
nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputMaterial')
em = nt.nodes.new('ShaderNodeEmission')
em.inputs['Color'].default_value = (0.85, 0.87, 0.92, 1)
em.inputs['Strength'].default_value = 0.7
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = img
mix = nt.nodes.new('ShaderNodeMixShader')
tr = nt.nodes.new('ShaderNodeBsdfTransparent')
nt.links.new(tex.outputs['Alpha'], mix.inputs['Fac'])
nt.links.new(tr.outputs[0], mix.inputs[1])
nt.links.new(em.outputs[0], mix.inputs[2])
nt.links.new(mix.outputs[0], out.inputs['Surface'])
M['smoke'] = m_smoke

# ---------------------------------------------------------------- mesh builder
class MB:
    """Accumulates boxes/cylinders/spheres into one bmesh with material indices."""
    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []

    def _mi(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def _finish(self, bm_part, mat, matrix):
        mi = self._mi(mat)
        bmesh.ops.transform(bm_part, matrix=matrix, verts=bm_part.verts)
        for f in bm_part.faces:
            f.material_index = mi
        tmp = bmesh.new()
        me_tmp = bpy.data.meshes.new('tmp')
        bm_part.to_mesh(me_tmp)
        bm_part.free()
        tmp.from_mesh(me_tmp)
        bpy.data.meshes.remove(me_tmp)
        vmap = {}
        for v in tmp.verts:
            vmap[v] = self.bm.verts.new(v.co)
        self.bm.verts.ensure_lookup_table()
        for f in tmp.faces:
            try:
                nf = self.bm.faces.new([vmap[v] for v in f.verts])
                nf.material_index = mi
            except ValueError:
                pass
        tmp.free()

    def box(self, center, size, mat, rot=None):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        mtx = Matrix.Translation(Vector(center))
        if rot is not None:
            mtx = mtx @ rot.to_4x4()
        mtx = mtx @ Matrix.Diagonal(Vector((size[0], size[1], size[2], 1.0)))
        self._finish(bm, mat, mtx)

    def cyl(self, p0, p1, r, mat, n=10, r1=None):
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        L = d.length
        if L < 1e-6:
            return
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=n,
                              radius1=r if r1 is None else r, radius2=r if r1 is None else r1, depth=L)
        # cone axis is +Z centered; rotate to d
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        mtx = Matrix.Translation((p0 + p1) / 2) @ q.to_matrix().to_4x4()
        self._finish(bm, mat, mtx)

    def sphere(self, center, r, mat, n=12, scale=(1, 1, 1)):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=n, v_segments=max(6, n // 2), radius=r)
        mtx = Matrix.Translation(Vector(center)) @ Matrix.Diagonal(Vector((scale[0], scale[1], scale[2], 1.0)))
        self._finish(bm, mat, mtx)

    def torus(self, center, major, minor, mat, rot=None, arc=2 * math.pi):
        bm = bmesh.new()
        seg_u, seg_v = 20, 8
        verts = []
        for i in range(seg_u):
            a = arc * i / seg_u
            ca, sa = math.cos(a), math.sin(a)
            for j in range(seg_v):
                b = 2 * math.pi * j / seg_v
                rr = major + minor * math.cos(b)
                verts.append((rr * ca, rr * sa, minor * math.sin(b)))
        faces = []
        for i in range(seg_u):
            i2 = (i + 1) % seg_u
            for j in range(seg_v):
                j2 = (j + 1) % seg_v
                faces.append((i * seg_v + j, i2 * seg_v + j, i2 * seg_v + j2, i * seg_v + j2))
        for v in verts:
            bm.verts.new(v)
        bm.verts.ensure_lookup_table()
        for f in faces:
            try:
                bm.faces.new([bm.verts[k] for k in f])
            except ValueError:
                pass
        mtx = Matrix.Translation(Vector(center))
        if rot is not None:
            mtx = mtx @ rot.to_4x4()
        self._finish(bm, mat, mtx)

    def finish(self, name, colname, uv_scale=1.0, smooth=False):
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        obj = bpy.data.objects.new(name, me)
        COL[colname].objects.link(obj)
        for m in self.mats:
            me.materials.append(m)
        if smooth:
            for p in me.polygons:
                p.use_smooth = True
        return obj

# ---------------------------------------------------------------- parametric surfaces
def grid_mesh(name, colname, xs, ys, zfun, mat, uvfun=None, nu_cap=None):
    """Build a grid mesh from arrays xs (nx), ys (ny) and zfun(X,Y)->Z."""
    nx, ny = len(xs), len(ys)
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    grid = [[None] * ny for _ in range(nx)]
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            grid[i][j] = bm.verts.new((x, y, float(zfun(x, y))))
    for i in range(nx - 1):
        for j in range(ny - 1):
            try:
                bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
            except ValueError:
                pass
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    COL[colname].objects.link(obj)
    me.materials.append(mat)
    if uvfun:
        uv = me.uv_layers.new(name='UVMap')
        # per-loop uv from vertex coords
        vcoords = [v.co.copy() for v in me.vertices]
        for poly in me.polygons:
            for li in poly.loop_indices:
                co = vcoords[me.loops[li].vertex_index]
                u, v = uvfun(co)
                uv.data[li].uv = (u, v)
    for p in me.polygons:
        p.use_smooth = True
    return obj

# ================================================================ CLIFF
def build_cliff():
    rng = np.random.default_rng(7)
    X0, X1, Z0, Z1 = -40, 40, -2, 52
    NX, NZ = 150, 110
    xs = np.linspace(X0, X1, NX)
    zs = np.linspace(Z0, Z1, NZ)
    X, Z = np.meshgrid(xs, zs)  # (NZ, NX)
    noise = fbm2(X, Z, 2.2, 4, rng=rng)
    strata = fbm2(X * 0.5, Z * 3.0, 3.0, 3, rng=rng)
    base = -6.0 + (noise - 0.5) * 2.6 + (strata - 0.5) * 0.9
    g = np.exp(-((X + 2) / 19.0) ** 2 - ((Z - 21) / 9.0) ** 2)
    base -= 4.6 * g
    g2 = np.exp(-((X + 2) / 21.0) ** 2 - ((Z - 35) / 7.0) ** 2)
    base += 3.4 * g2
    Yfull = base  # (NZ, NX)

    def Y(x, z):
        i = min(NX - 1, max(0, int(round((x - X0) / (X1 - X0) * (NX - 1)))))
        j = min(NZ - 1, max(0, int(round((z - Z0) / (Z1 - Z0) * (NZ - 1)))))
        return float(Yfull[j, i])

    def uv(co):
        return ((co.x - X0) / (X1 - X0) * 7.0, (co.z - Z0) / (Z1 - Z0) * 7.0)
    obj = grid_mesh('悬崖', 'CLIFF', xs, zs, Y, M['rock'], uv)
    return obj

def build_ledges():
    rng = np.random.default_rng(11)
    # main ledge under temple
    mb = MB()
    X0, X1, Y0, Y1, ZB, ZT = -21, 17, -8.2, 1.3, 15.0, 18.3
    nx, ny = 40, 14
    xs = np.linspace(X0, X1, nx)
    ys = np.linspace(Y0, Y1, ny)
    top = {}
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            n = fbm2(np.float32(x), np.float32(y), 5.0, 3, rng=rng)
            top[(i, j)] = float(ZT + (n - 0.5) * 0.5)
    # build box-like solid: top grid + skirt
    me = bpy.data.meshes.new('主岩台')
    bm = bmesh.new()
    vtop = [[None] * ny for _ in range(nx)]
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            vtop[i][j] = bm.verts.new((x, y, top[(i, j)]))
    vbot = [[None] * ny for _ in range(nx)]
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            vbot[i][j] = bm.verts.new((x, y, ZB))
    for i in range(nx - 1):
        for j in range(ny - 1):
            bm.faces.new((vtop[i][j], vtop[i + 1][j], vtop[i + 1][j + 1], vtop[i][j + 1]))
            bm.faces.new((vbot[i][j], vbot[i][j + 1], vbot[i + 1][j + 1], vbot[i + 1][j]))
    # sides
    for i in range(nx - 1):
        bm.faces.new((vtop[i][0], vtop[i + 1][0], vbot[i + 1][0], vbot[i][0]))
        bm.faces.new((vtop[i][ny - 1], vbot[i][ny - 1], vbot[i + 1][ny - 1], vtop[i + 1][ny - 1]))
    for j in range(ny - 1):
        bm.faces.new((vtop[0][j], vbot[0][j], vbot[0][j + 1], vtop[0][j + 1]))
        bm.faces.new((vtop[nx - 1][j], vtop[nx - 1][j + 1], vbot[nx - 1][j + 1], vbot[nx - 1][j]))
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new('主岩台', me)
    COL['CLIFF'].objects.link(obj)
    me.materials.append(M['rock'])
    uv = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co.x / 8.0, (co.y + co.z) / 8.0)
        poly.use_smooth = False

    # lower ledge for stilts
    mb2 = MB()
    lxs = np.linspace(-8, 16, 26)
    lys = np.linspace(-5.0, 0.6, 10)
    top2 = {}
    for i, x in enumerate(lxs):
        for j, y in enumerate(ys):
            n = fbm2(np.float32(x + 50), np.float32(y), 5.0, 3, rng=rng)
            top2[(i, j)] = float(12.5 + (n - 0.5) * 0.4)
    me2 = bpy.data.meshes.new('下岩台')
    bm2 = bmesh.new()
    vt = [[None] * len(lys) for _ in range(len(lxs))]
    for i, x in enumerate(lxs):
        for j, y in enumerate(lys):
            vt[i][j] = bm2.verts.new((x, y, top2[(i, j)]))
    vb = [[None] * len(lys) for _ in range(len(lxs))]
    for i, x in enumerate(lxs):
        for j, y in enumerate(lys):
            vb[i][j] = bm2.verts.new((x, y, 10.4))
    for i in range(len(lxs) - 1):
        for j in range(len(lys) - 1):
            bm2.faces.new((vt[i][j], vt[i + 1][j], vt[i + 1][j + 1], vt[i][j + 1]))
            bm2.faces.new((vb[i][j], vb[i][j + 1], vb[i + 1][j + 1], vb[i + 1][j]))
    for i in range(len(lxs) - 1):
        bm2.faces.new((vt[i][0], vt[i + 1][0], vb[i + 1][0], vb[i][0]))
        bm2.faces.new((vt[i][len(lys) - 1], vb[i][len(lys) - 1], vb[i + 1][len(lys) - 1], vt[i + 1][len(lys) - 1]))
    for j in range(len(lys) - 1):
        bm2.faces.new((vt[0][j], vb[0][j], vb[0][j + 1], vt[0][j + 1]))
        bm2.faces.new((vt[len(lxs) - 1][j], vt[len(lxs) - 1][j + 1], vb[len(lxs) - 1][j + 1], vb[len(lxs) - 1][j]))
    bm2.normal_update()
    bm2.to_mesh(me2)
    bm2.free()
    obj2 = bpy.data.objects.new('下岩台', me2)
    COL['CLIFF'].objects.link(obj2)
    me2.materials.append(M['rock'])
    uv2 = me2.uv_layers.new(name='UVMap')
    for poly in me2.polygons:
        for li in poly.loop_indices:
            co = me2.vertices[me2.loops[li].vertex_index].co
            uv2.data[li].uv = (co.x / 6.0, (co.y + co.z) / 6.0)
    return obj, obj2

# ================================================================ TERRAIN
def build_terrain():
    rng = np.random.default_rng(23)
    # ground plane south of cliff
    xs = np.linspace(-70, 70, 60)
    ys = np.linspace(2, 75, 46)
    def zfun(x, y):
        n = fbm2(np.float32(x), np.float32(y), 1.6, 4, rng=rng)
        z = (n - 0.5) * 1.6
        z += max(0, (y - 40)) * 0.06
        return z
    def uv(co):
        return (co.x / 10.0, co.y / 10.0)
    grid_mesh('地面', 'TERRAIN', xs, ys, zfun, M['terrain'], uv)

    # red base platform wall (the prominent red wall in the photo)
    mb = MB()
    mb.box((-1, 4.5, 5.0), (52, 2.6, 10.0), M['brick'])          # main red wall body
    mb.box((-1, 4.5, 10.25), (53, 3.0, 0.5), M['stone'])        # coping base
    mb.box((-1, 4.5, 10.62), (53.4, 3.4, 0.28), M['ridge'])     # tile coping
    # small windows strip on red wall
    for i in range(15):
        x = -24 + i * 3.4
        mb.box((x, 5.83, 6.4), (1.3, 0.12, 1.7), M['lattice'])
    obj = mb.finish('基座红墙', 'TERRAIN')
    return obj

# ================================================================ ROOF
def roof_z(x, y, W, D, H, ridge_ratio, upturn, Dg_ratio=0.62):
    a, b = W / 2, D / 2
    r = a * ridge_ratio
    tx, ty = abs(x) / a, abs(y) / b
    z = H * (1 - ty)
    if abs(x) > r:
        s = (abs(x) - r) / (a - r)
        z *= (1 - s)
    # eave corner upturn
    up = upturn * ((tx * ty) ** 5 * 0.8 + 0.2 * (tx ** 6 + ty ** 6) * (tx * ty))
    z += up
    return z

def build_roof(name, cx, cy, z0, W, D, H, mat_tile, mat_ridge, ridge_ratio=0.55, upturn=0.42, colname='BUILDINGS', with_gables=True, gable_mat=None):
    nx, ny = 44, 30
    xs = np.linspace(cx - W / 2, cx + W / 2, nx)
    ys = np.linspace(cy - D / 2, cy + D / 2, ny)
    Dg = D * 0.62
    def zfun(x, y):
        return z0 + roof_z(x - cx, y - cy, W, D, H, ridge_ratio, upturn)
    def uvfun(co):
        # tiles run down-slope: u along X, v along slope height
        dz = co.z - z0
        return ((co.x - cx) * 0.85 + 3.0, dz * 1.15 + 2.0)
    roof = grid_mesh(name + '_瓦面', colname, xs, ys, zfun, M['tile'] if mat_tile is None else mat_tile, uvfun)
    # solidify
    mod = roof.modifiers.new('厚度', 'SOLIDIFY')
    mod.thickness = 0.14
    mod.offset = -1.0
    bpy.context.view_layer.objects.active = roof
    bpy.ops.object.modifier_apply(modifier=mod.name)
    me = roof.data

    mb = MB()
    r = (W / 2) * ridge_ratio
    ztop = z0 + H
    # main ridge (正脊), slight end lift
    ridge_pts = []
    for t in np.linspace(-1, 1, 9):
        x = cx + r * 0.96 * t
        lift = 0.22 * (abs(t) ** 6)
        ridge_pts.append((x, cy, ztop + 0.16 + lift))
    for i in range(len(ridge_pts) - 1):
        mb.cyl(ridge_pts[i], ridge_pts[i + 1], 0.14, M['ridge'], n=8)
    # chiwen ornaments at ridge ends
    for ex in (-1, 1):
        x = cx + r * 0.96 * ex
        mb.box((x + 0.1 * ex, cy, ztop + 0.42), (0.34, 0.30, 0.62), M['ridge'])
        mb.box((x + 0.16 * ex, cy, ztop + 0.72), (0.16, 0.20, 0.34), M['ridge'])
    # hip ridges (垂脊): ridge end -> eave corners
    for sx in (-1, 1):
        for sy in (-1, 1):
            pts = []
            for t in np.linspace(0, 1, 9):
                x = cx + sx * (r + (W / 2 - r) * t) * (1 - 0.06 * t)
                y = cy + sy * (D / 2) * t
                z = zfun(x, y) + 0.10
                pts.append((x, y, z))
            for i in range(len(pts) - 1):
                mb.cyl(pts[i], pts[i + 1], 0.09, M['ridge'], n=8)
            # corner ornament (脊兽 hint)
            mb.box(pts[-1], (0.18, 0.18, 0.3), M['ridge'])
    obj = mb.finish(name + '_脊', colname, smooth=True)

    # gable infill (山花) at ridge ends
    if with_gables:
        gmb = MB()
        for sx in (-1, 1):
            gx = cx + sx * r
            # triangle wall from roof surface up to ridge
            zbase = zfun(gx, cy - Dg / 2 * 0.98) - 0.05
            pts2d = [(gx, cy - Dg / 2), (gx, cy + Dg / 2), (gx, cy)]
            zb = [zbase, zbase, ztop + 0.05]
            gmb.box((gx, cy, (zbase + ztop) / 2), (0.10, Dg, ztop - zbase + 0.1), gable_mat or M['redwall'])
        gobj = gmb.finish(name + '_山花', colname)
    return roof

# ================================================================ HALL
def build_hall(name, cx, cy, W, D, floors, colname='BUILDINGS'):
    """Timber hall on the ledge. Returns dict of key Z heights."""
    z_base = 18.3
    floor_h = 3.4
    objs = {}
    mb = MB()
    # stone platform
    mb.box((cx, cy, z_base + 0.25), (W + 1.6, D + 1.6, 0.5), M['stone'])
    mb.box((cx, cy, z_base + 0.56), (W + 0.6, D + 0.6, 0.14), M['stone'])
    plat = mb.finish(name + '_台基', colname)

    col_positions = []
    def col_row(x0, x1, y, n):
        for i in range(n):
            x = x0 + (x1 - x0) * (i / max(1, n - 1))
            col_positions.append((x, y))

    for fl in range(floors):
        z0 = z_base + 0.6 + fl * floor_h
        fw, fd = W - fl * 0.7, D - fl * 0.7
        # columns
        ncol_x = max(3, int(fw / 1.7))
        ncol_y = max(3, int(fd / 1.7))
        for i in range(ncol_x):
            x = cx - fw / 2 + fw * i / (ncol_x - 1)
            col_positions.append((x, cy - fd / 2))
            col_positions.append((x, cy + fd / 2))
        for j in range(1, ncol_y - 1):
            y = cy - fd / 2 + fd * j / (ncol_y - 1)
            col_positions.append((cx - fw / 2, y))
            col_positions.append((cx + fw / 2, y))
        # dedupe
        seen = set()
        ucols = []
        for p in col_positions:
            k = (round(p[0], 2), round(p[1], 2))
            if k not in seen:
                seen.add(k)
                ucols.append(p)
        col_positions = []
        cmb = MB()
        for (x, y) in ucols:
            cmb.cyl((x, y, z0), (x, y, z0 + floor_h - 0.25), 0.20, M['vermilion'], n=12)
        cols = cmb.finish(name + f'_柱{fl}', colname, smooth=True)

        # walls with door/window openings (built as segmented boxes)
        wmb = MB()
        wall_t = 0.22
        zc = z0 + (floor_h - 0.25) / 2
        hh = floor_h - 0.25
        door_w, door_h = 1.7, 2.3
        win_w, win_h = 1.5, 1.45
        def wall_seg(x0, y0, x1, y1, openings):
            """wall from (x0,y0) to (x1,y1) (axis aligned), openings=list of (center_offset_along, width, z_bottom, z_h)"""
            horizontal = abs(y1 - y0) < 1e-6
            L = math.hypot(x1 - x0, y1 - y0)
            nseg = 10
            segs = []  # (t0,t1,z0,z1)
            cuts = sorted(openings)
            cur = 0.0
            for (off, w, zb, zh) in cuts:
                a, b = (off - w / 2) / L, (off + w / 2) / L
                if a > cur:
                    segs.append((cur, a, 0.0, 1.0))
                if zb > 0.02:
                    segs.append((a, b, 0.0, zb / hh))
                if zb + zh < hh - 0.02:
                    segs.append((a, b, (zb + zh) / hh, 1.0))
                cur = b
            if cur < 1.0:
                segs.append((cur, 1.0, 0.0, 1.0))
            for (t0, t1, za, zb) in segs:
                if t1 - t0 < 0.01 or zb - za < 0.01:
                    continue
                mx = x0 + (x1 - x0) * (t0 + t1) / 2
                my = y0 + (y1 - y0) * (t0 + t1) / 2
                ml = L * (t1 - t0)
                if horizontal:
                    wmb.box((mx, my, z0 + hh * (za + zb) / 2), (ml, wall_t, hh * (zb - za)), M['redwall'])
                else:
                    wmb.box((mx, my, z0 + hh * (za + zb) / 2), (wall_t, ml, hh * (zb - za)), M['redwall'])
            # opening reveals + lattice + sill
            for (off, w, zb, zh) in cuts:
                mx = x0 + (x1 - x0) * off / L
                my = y0 + (y1 - y0) * off / L
                zmid = z0 + zb + zh / 2
                if horizontal:
                    wmb.box((mx, my + (wall_t / 2 + 0.03) * (1 if y1 >= 0 else 1), zmid), (w, 0.1, zh), M['lattice'])
                    wmb.box((mx, my, z0 + zb - 0.12), (w, wall_t + 0.3, 0.24), M['stone'])
                else:
                    wmb.box((mx + (wall_t / 2 + 0.03), my, zmid), (0.1, w, zh), M['lattice'])
                    wmb.box((mx, my, z0 + zb - 0.12), (wall_t + 0.3, w, 0.24), M['stone'])
        # front wall (y = cy + fd/2): door in middle + windows
        wall_seg(cx - fw / 2, cy + fd / 2, cx + fw / 2, cy + fd / 2,
                 [(cx, door_w, 0.0, door_h), (cx - fw / 4, win_w, 1.0, win_h), (cx + fw / 4, win_w, 1.0, win_h)])
        # back wall
        wall_seg(cx - fw / 2, cy - fd / 2, cx + fw / 2, cy - fd / 2,
                 [(cx - fw / 4, win_w, 1.0, win_h), (cx + fw / 4, win_w, 1.0, win_h)])
        # side walls
        wall_seg(cx - fw / 2, cy - fd / 2, cx - fw / 2, cy + fd / 2,
                 [(cy, win_w, 1.0, win_h)])
        wall_seg(cx + fw / 2, cy - fd / 2, cx + fw / 2, cy + fd / 2,
                 [(cy, win_w, 1.0, win_h)])
        walls = wmb.finish(name + f'_墙{fl}', colname)

        # architrave ring (额枋)
        amb = MB()
        amb.box((cx, cy + fd / 2, z0 + floor_h - 0.32), (fw + 0.4, 0.3, 0.34), M['wood_dark'])
        amb.box((cx, cy - fd / 2, z0 + floor_h - 0.32), (fw + 0.4, 0.3, 0.34), M['wood_dark'])
        amb.box((cx - fw / 2, cy, z0 + floor_h - 0.32), (0.3, fd + 0.4, 0.34), M['wood_dark'])
        amb.box((cx + fw / 2, cy, z0 + floor_h - 0.32), (0.3, fd + 0.4, 0.34), M['wood_dark'])
        amb.finish(name + f'_枋{fl}', colname)

        # dougong bracket band under eave
        build_brackets(name + f'_斗拱{fl}', cx, cy, fw, fd, z0 + floor_h + 0.05, colname)

        # roof for this floor (skirt roof for lower floors of multi-floor halls)
        if fl < floors - 1:
            build_roof(name + f'_腰檐{fl}', cx, cy, z0 + floor_h + 0.35, fw + 2.6, fd + 2.6, 1.5,
                       None, None, ridge_ratio=0.6, upturn=0.30, colname=colname, with_gables=False)
        else:
            build_roof(name + f'_主顶', cx, cy, z0 + floor_h + 0.35, fw + 2.8, fd + 2.8, 2.6,
                       None, None, ridge_ratio=0.55, upturn=0.45, colname=colname, with_gables=True)

        # interior: floor slab for next level + a few interior props
        if fl < floors - 1:
            fmb = MB()
            fmb.box((cx, cy, z0 + floor_h - 0.12), (fw - 0.3, fd - 0.3, 0.18), M['plank'])
            fmb.finish(name + f'_楼板{fl}', colname)
            # interior columns
            icmb = MB()
            for dx in (-fw / 4, fw / 4):
                for dy in (-fd / 4, fd / 4):
                    icmb.cyl((cx + dx, cy + dy, z0), (cx + dx, cy + dy, z0 + floor_h - 0.25), 0.16, M['vermilion'], n=10)
            icmb.finish(name + f'_内柱{fl}', colname, smooth=True)
            # altar
            almb = MB()
            almb.box((cx, cy - fd / 4, z0 + 0.65), (2.2, 1.0, 0.9), M['wood_dark'])
            almb.box((cx, cy - fd / 4, z0 + 1.25), (1.6, 0.7, 0.3), M['gold'])
            almb.finish(name + f'_供桌{fl}', colname)

    # glowing window panels at night (emissive planes behind lattice on 1F front)
    return objs

def build_brackets(name, cx, cy, W, D, z, colname):
    """Simplified dougong band around the eave line."""
    mb = MB()
    spacing = 1.05
    # rows along all 4 sides
    edges = [
        (cx - W / 2, cy + D / 2, cx + W / 2, cy + D / 2),
        (cx - W / 2, cy - D / 2, cx + W / 2, cy - D / 2),
        (cx - W / 2, cy - D / 2, cx - W / 2, cy + D / 2),
        (cx + W / 2, cy - D / 2, cx + W / 2, cy + D / 2),
    ]
    for (x0, y0, x1, y1) in edges:
        L = math.hypot(x1 - x0, y1 - y0)
        n = max(2, int(L / spacing))
        for i in range(n + 1):
            t = i / n
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            # sitting block (坐斗)
            mb.box((x, y, z + 0.10), (0.30, 0.30, 0.20), M['wood_dark'])
            # cross arms (拱)
            if abs(y1 - y0) < 1e-6:
                mb.box((x, y, z + 0.26), (0.62, 0.14, 0.12), M['wood_dark'])
                mb.box((x, y, z + 0.40), (0.14, 0.5, 0.12), M['wood_dark'])
                mb.box((x, y, z + 0.52), (0.5, 0.16, 0.14), M['wood_dark'])
            else:
                mb.box((x, y, z + 0.26), (0.14, 0.62, 0.12), M['wood_dark'])
                mb.box((x, y, z + 0.40), (0.5, 0.14, 0.12), M['wood_dark'])
                mb.box((x, y, z + 0.52), (0.16, 0.5, 0.14), M['wood_dark'])
    # angled flying rafters (飞椽) above band
    nfr = int(max(W, D) / 0.42)
    for i in range(nfr):
        t = (i + 0.5) / nfr
        # front & back
        for sy in (-1, 1):
            x = cx - W / 2 + W * t
            y0 = cy + sy * D / 2
            p0 = (x, y0, z + 0.55)
            p1 = (x, y0 + sy * 0.9, z + 1.15)
            mb.cyl(p0, p1, 0.055, M['wood'], n=6)
        for sx in (-1, 1):
            y = cy - D / 2 + D * t
            x0 = cx + sx * W / 2
            p0 = (x0, y, z + 0.55)
            p1 = (x0 + sx * 0.9, y, z + 1.15)
            mb.cyl(p0, p1, 0.055, M['wood'], n=6)
    obj = mb.finish(name, colname)
    return obj

# ================================================================ STRUCTURE
def build_structure():
    mb = MB()
    # main deck (walkway) in front of halls
    deck_y0, deck_y1 = 0.6, 2.9
    mb.box((-1, (deck_y0 + deck_y1) / 2, 18.32), (38.5, deck_y1 - deck_y0, 0.22), M['plank'])
    deck = mb.finish('主栈道', 'STRUCTURE')
    # support: cantilever beams into cliff
    bmb = MB()
    for i in range(25):
        x = -18.2 + i * 1.52
        bmb.box((x, -2.6, 17.98), (0.24, 9.6, 0.30), M['wood_dark'])
    beams = bmb.finish('悬挑梁', 'STRUCTURE')
    # thin stilts from lower ledge
    smb = MB()
    for x in (-12.5, -7.5, -1.0, 4.5, 10.0, 15.5):
        smb.cyl((x, 0.2, 12.5), (x, 0.2, 18.22), 0.095, M['wood'], n=8)
    smb.finish('细长吊柱', 'STRUCTURE', smooth=True)
    # railings along deck outer edge
    rmb = MB()
    y = 2.78
    z = 18.43
    n = int(38.0 / 1.35)
    for i in range(n + 1):
        x = -18.6 + i * (37.2 / n)
        rmb.box((x, y, z + 0.5), (0.10, 0.10, 1.0), M['wood_dark'])
    for zz in (0.45, 0.95):
        rmb.box((-1, y, z + zz), (37.6, 0.09, 0.09), M['wood_dark'])
    rmb.box((-1, y, z + 1.02), (37.8, 0.14, 0.10), M['wood'])
    rail = rmb.finish('栏杆', 'STRUCTURE')

    # stairs: platform (Z=10) up to deck (Z=18.3) on the east side
    smb2 = MB()
    def stair_run(name, x0, y0, z0, x1, y1, z1, width, mat):
        d = Vector((x1 - x0, y1 - y0, z1 - z0))
        L = math.hypot(d.x, d.y)
        steps = max(1, round(abs(d.z) / 0.22))
        dirv = Vector((d.x / L, d.y / L))
        for i in range(steps):
            zt = z0 + abs(d.z) * (i + 1) / steps * (1 if d.z > 0 else -1)
            zb = z0 + abs(d.z) * i / steps * (1 if d.z > 0 else -1)
            xm = x0 + dirv.x * L * (i + 0.5) / steps
            ym = y0 + dirv.y * L * (i + 0.5) / steps
            # tread box: width across, depth along dir
            cx, cy = xm, ym
            if abs(dirv.x) > 0.5:
                smb2.box((cx, cy, (zt + zb) / 2), (L / steps + 0.05, width, zt - zb + 0.35), mat)
            else:
                smb2.box((cx, cy, (zt + zb) / 2), (width, L / steps + 0.05, zt - zb + 0.35), mat)
        # side stringers
        return steps
    stair_run('东梯', 17.0, 2.9, 18.3, 20.5, 10.5, 10.2, 2.3, M['stone'])
    stair_run('东梯平台', 20.5, 10.5, 10.2, 21.5, 6.2, 10.0, 2.3, M['stone'])
    stairs = smb2.finish('楼梯', 'STRUCTURE')

    # walkway from stairs landing to red platform
    wmb = MB()
    wmb.box((21.0, 4.5, 9.85), (7.5, 3.4, 0.25), M['plank'])
    wmb.finish('引桥', 'STRUCTURE')

    # bridge (长线桥) between halls at upper level Z=22.55
    bmb2 = MB()
    for (xa, xb) in [(-10.0, -7.5), (3.5, 5.5)]:
        bmb2.box(((xa + xb) / 2, 1.6, 22.55), (xb - xa, 2.0, 0.2), M['plank'])
        for yy in (0.75, 2.45):
            n = max(2, int((xb - xa) / 1.2))
            for i in range(n + 1):
                x = xa + (xb - xa) * i / n
                bmb2.box((x, yy, 23.15), (0.09, 0.09, 1.1), M['wood_dark'])
            bmb2.box(((xa + xb) / 2, yy, 23.68), (xb - xa, 0.08, 0.08), M['wood_dark'])
            bmb2.box(((xa + xb) / 2, yy, 23.2), (xb - xa, 0.08, 0.08), M['wood_dark'])
    bridge = bmb2.finish('长线桥', 'STRUCTURE')

    # lanterns under eaves along deck
    lmb = MB()
    lights = []
    for i in range(9):
        x = -16.0 + i * 4.0
        y = 3.05
        z = 20.9
        lmb.cyl((x, y, z + 0.35), (x, y, z + 0.12), 0.02, M['wood_dark'], n=6)
        lmb.sphere((x, y, z - 0.05), 0.17, M['lantern'], n=12, scale=(1, 1, 1.25))
        lmb.cyl((x, y, z - 0.26), (x, y, z - 0.20), 0.09, M['wood_dark'], n=8)
        lmb.cyl((x, y, z + 0.16), (x, y, z + 0.10), 0.09, M['wood_dark'], n=8)
    lanterns = lmb.finish('灯笼', 'PROPS')
    # real point lights for night (subset)
    for i, x in enumerate((-16.0, -8.0, 0.0, 8.0, 16.0)):
        ld = bpy.data.lights.new(f'灯笼灯{i}', 'POINT')
        ld.energy = 60
        ld.color = (1.0, 0.45, 0.18)
        ld.shadow_soft_size = 0.3
        lo = bpy.data.objects.new(f'灯笼灯{i}', ld)
        lo.location = (x, 3.0, 20.6)
        COL['LIGHTS'].objects.link(lo)
    return

# ================================================================ PROPS
def build_incense_burner():
    mb = MB()
    x, y, z = -2.0, 1.55, 18.43
    mb.cyl((x, y, z + 0.10), (x, y, z + 0.02), 0.42, M['bronze'], n=16)
    mb.sphere((x, y, z + 0.42), 0.46, M['bronze'], n=20, scale=(1, 1, 0.92))
    mb.cyl((x, y, z + 0.78), (x, y, z + 0.92), 0.30, M['bronze'], n=16)
    mb.cyl((x, y, z + 0.95), (x, y, z + 1.28), 0.20, M['bronze'], n=12)
    # legs
    for k in range(3):
        a = math.radians(90 + k * 120)
        lx, ly = x + 0.30 * math.cos(a), y + 0.30 * math.sin(a)
        mb.cyl((lx, ly, z + 0.30), (lx + 0.06 * math.cos(a), ly + 0.06 * math.sin(a), z + 0.02), 0.075, M['bronze'], n=8)
    # handles
    for s in (-1, 1):
        mb.torus((x + s * 0.42, y, z + 0.62), 0.14, 0.035, M['bronze'],
                 rot=Matrix.Rotation(math.pi / 2, 4, 'Y'), arc=math.pi)
    # lid knob
    mb.sphere((x, y, z + 1.34), 0.09, M['bronze'], n=10)
    burner = mb.finish('香炉', 'PROPS', smooth=True)
    # smoke wisps: two crossed alpha planes
    for k, (rx, rz) in enumerate([(0.3, 0), (-0.3, math.pi / 2)]):
        me = bpy.data.meshes.new(f'烟{k}')
        bm = bmesh.new()
        w, h = 0.55, 2.6
        # gentle S-curve via 2 quad segments
        v0 = bm.verts.new((-w / 2, 0, 0))
        v1 = bm.verts.new((w / 2, 0, 0))
        v2 = bm.verts.new((w / 2 * 0.7, 0, h / 2))
        v3 = bm.verts.new((-w / 2 * 0.7, 0, h / 2))
        v4 = bm.verts.new((w / 2 * 0.2, 0, h))
        v5 = bm.verts.new((-w / 2 * 0.2, 0, h))
        bm.faces.new((v0, v1, v2, v3))
        bm.faces.new((v3, v2, v4, v5))
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(f'烟{k}', me)
        COL['PROPS'].objects.link(ob)
        me.materials.append(M['smoke'])
        ob.location = (x, y, z + 1.3)
        ob.rotation_euler = (0, rx, rz)
    return burner

# ================================================================ DETAIL ASSEMBLIES
def detail_platform():
    mb = MB()
    mb.box((30, 18, 0.3), (16, 9, 0.6), M['stone'])
    mb.finish('展示台', 'DETAILS')

def detail_eave_tenon():
    """屋檐榫卯: bracket + rafter + flying rafter + eave tiles, exploded slightly."""
    cx, cy, cz = 26.0, 16.2, 0.6
    mb = MB()
    # column
    mb.cyl((cx, cy, cz), (cx, cy, cz + 1.35), 0.16, M['vermilion'], n=12)
    mb.box((cx, cy, cz + 0.06), (0.42, 0.42, 0.12), M['stone'])
    # bracket stack (exploded: each layer offset +z gap shown by spacing)
    z = cz + 1.35
    mb.box((cx, cy, z + 0.09), (0.34, 0.34, 0.18), M['wood_dark'])          # 坐斗
    z += 0.30
    mb.box((cx, cy, z + 0.08), (0.78, 0.20, 0.16), M['wood_dark'])          # 华拱
    mb.box((cx, cy, z + 0.08), (0.20, 0.62, 0.16), M['wood_dark'])
    z += 0.30
    mb.box((cx - 0.28, cy, z + 0.07), (0.24, 0.24, 0.14), M['wood_dark'])  # 散斗 L
    mb.box((cx + 0.28, cy, z + 0.07), (0.24, 0.24, 0.14), M['wood_dark'])  # 散斗 R
    z += 0.30
    # slanted lever arm (下昂) with tenon at rear
    mb.cyl((cx, cy - 0.55, z + 0.42), (cx, cy + 0.18, z - 0.02), 0.075, M['wood_dark'], n=8)
    mb.box((cx, cy + 0.16, z + 0.02), (0.10, 0.22, 0.14), M['wood'])        # 昂尾榫
    # rafter (椽) with tenon hovering into bracket
    mb.cyl((cx, cy - 1.35, z + 0.42), (cx, cy + 0.1, z + 0.30), 0.075, M['wood'], n=8)
    mb.box((cx, cy + 0.10, z + 0.30), (0.10, 0.20, 0.14), M['wood'])         # 椽榫头
    # flying rafter (飞椽)
    mb.cyl((cx, cy - 1.15, z + 0.66), (cx, cy + 0.05, z + 0.56), 0.055, M['wood'], n=6)
    # eave board
    mb.box((cx, cy - 1.42, z + 0.62), (1.15, 0.10, 0.14), M['wood'])
    # mini roof patch with barrel tiles
    zt = z + 0.78
    mb.box((cx, cy - 0.95, zt), (1.3, 1.6, 0.10), M['tile'])
    for i in range(11):
        tx = cx - 0.62 + i * 0.124
        mb.cyl((tx, cy - 1.75, zt + 0.07), (tx, cy - 0.15, zt + 0.07), 0.058, M['tile'], n=8)
    obj = mb.finish('大样_屋檐榫卯', 'DETAILS', smooth=True)
    return obj

def detail_beam_column():
    """梁柱榫卯: column with real mortise (boolean), beam with dovetail tenon."""
    cx, cy, cz = 29.5, 16.2, 0.6
    mb = MB()
    col = mb  # build column in separate mesh for boolean
    mb.cyl((cx, cy, cz), (cx, cy, cz + 1.6), 0.18, M['vermilion'], n=12)
    mb.box((cx, cy, cz + 0.08), (0.5, 0.5, 0.16), M['stone'])
    column = mb.finish('大样_柱', 'DETAILS', smooth=True)
    # mortise hole in column top via boolean
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy - 0.10, cz + 1.56))
    cutter = bpy.context.object
    cutter.scale = (0.09, 0.16, 0.14)
    bpy.ops.object.transform_apply(scale=True)
    mod = column.modifiers.new('卯口', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    bpy.context.view_layer.objects.active = column
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter)
    # beam with dovetail tenon hovering above
    bmb = MB()
    bmb.box((cx - 0.9, cy - 0.10, cz + 1.78), (2.4, 0.26, 0.30), M['wood'])
    bmb.box((cx + 0.30, cy - 0.10, cz + 1.66), (0.16, 0.20, 0.10), M['wood'])
    bmb.box((cx + 0.18, cy - 0.10, cz + 1.60), (0.40, 0.13, 0.08), M['wood'])  # 燕尾榫
    beam = bmb.finish('大样_梁', 'DETAILS')
    return column, beam

def detail_railing():
    """栏杆节点: handrail with mortise, baluster with tenon, base curb."""
    cx, cy, cz = 33.0, 16.2, 0.6
    mb = MB()
    # base curb (地栿)
    mb.box((cx, cy, cz + 0.09), (1.7, 0.24, 0.18), M['stone'])
    # balusters
    for dx in (-0.6, 0.6):
        mb.box((cx + dx, cy, cz + 0.62), (0.11, 0.11, 1.06), M['wood'])
        mb.box((cx + dx, cy, cz + 0.70), (0.16, 0.16, 0.10), M['wood'])   # 云拱 hint
        mb.box((cx + dx, cy, cz + 0.19), (0.15, 0.15, 0.10), M['wood'])   # 榫头(下)
    # middle baluster exploded upward showing tenon
    mb.box((cx, cy, cz + 1.62), (0.11, 0.11, 1.0), M['wood'])
    mb.box((cx, cy, cz + 1.68), (0.15, 0.15, 0.10), M['wood'])
    # handrail (寻杖) with visible mortise holes (dark insets)
    rail = mb.finish('大样_栏杆', 'DETAILS')
    # cut real mortises into rail for the two seated balusters
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx - 0.6, cy, cz + 1.17))
    c1 = bpy.context.object
    c1.scale = (0.07, 0.07, 0.12)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx + 0.6, cy, cz + 1.17))
    c2 = bpy.context.object
    c2.scale = (0.07, 0.07, 0.12)
    bpy.ops.object.transform_apply(scale=True)
    for c in (c1, c2):
        mod = rail.modifiers.new('卯口', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.solver = 'EXACT'
        mod.object = c
        bpy.context.view_layer.objects.active = rail
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(c)
    return rail

def detail_column_base():
    """立柱与石墩节点: column tenon into drum plinth (覆盆柱础), plinth quarter-cut."""
    cx, cy, cz = 36.5, 16.2, 0.6
    mb = MB()
    # stone plinth: drum profile via stacked cylinders
    mb.cyl((cx, cy, cz + 0.10), (cx, cy, cz + 0.02), 0.40, M['stone'], n=20)
    mb.cyl((cx, cy, cz + 0.34), (cx, cy, cz + 0.16), 0.34, M['stone'], n=20)
    mb.torus((cx, cy, cz + 0.36), 0.30, 0.05, M['stone'])
    mb.cyl((cx, cy, cz + 0.52), (cx, cy, cz + 0.40), 0.24, M['stone'], n=20)
    plinth = mb.finish('大样_石墩', 'DETAILS', smooth=True)
    # quarter cut the plinth to reveal mortise
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx + 0.3, cy + 0.3, cz + 0.26))
    cut = bpy.context.object
    cut.scale = (0.6, 0.6, 0.5)
    bpy.ops.object.transform_apply(scale=True)
    mod = plinth.modifiers.new('剖切', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cut
    bpy.context.view_layer.objects.active = plinth
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cut)
    # column with 管脚榫 (ankle tenon) hovering
    cmb = MB()
    cmb.cyl((cx, cy, cz + 0.98), (cx, cy, cz + 0.52), 0.17, M['vermilion'], n=12)
    cmb.cyl((cx, cy, cz + 0.60), (cx, cy, cz + 0.50), 0.10, M['vermilion'], n=10)
    column = cmb.finish('大样_立柱', 'DETAILS', smooth=True)
    return plinth, column

# ================================================================ LIGHTS & CAMERAS
def add_sun(name, direction, energy, color, angle=0.05):
    ld = bpy.data.lights.new(name, 'SUN')
    ld.energy = energy
    ld.color = color
    ld.angle = angle
    ob = bpy.data.objects.new(name, ld)
    ob.rotation_euler = Vector(direction).to_track_quat('-Z', 'Y').to_euler()
    COL['LIGHTS'].objects.link(ob)
    return ob

def add_area(name, loc, energy, size, color, target):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = energy
    ld.shape = 'DISK'
    ld.size = size
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    COL['LIGHTS'].objects.link(ob)
    return ob

def add_camera(name, loc, target, lens=35, ortho=None):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    if ortho:
        cd.type = 'ORTHO'
        cd.ortho_scale = ortho
    ob = bpy.data.objects.new(name, cd)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    COL['CAMERAS'].objects.link(ob)
    return ob

def setup_world_day():
    w = bpy.data.worlds.new('日景天空')
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 0.55
    sky = nt.nodes.new('ShaderNodeTexSky')
    try:
        sky.sky_type = 'MULTIPLE_SCATTERING'  # Blender 4.x+ (formerly NISHITA)
    except TypeError:
        sky.sky_type = 'NISHITA'
    sky.sun_elevation = math.radians(52)
    sky.sun_rotation = math.radians(115)
    for prop, val in (('altitude', 0.1), ('air_density', 1.0), ('dust_density', 1.0), ('ozone_density', 1.0)):
        try:
            setattr(sky, prop, val)
        except AttributeError:
            pass
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])

def setup_world_night():
    w = bpy.data.worlds.new('夜空')
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.012, 0.02, 0.045, 1.0)
    bg.inputs['Strength'].default_value = 1.0

def setup_studio():
    for name in ('STUDIO_KEY', 'STUDIO_FILL'):
        pass
    add_area('影棚主光', (30, 24, 14), 1800, 6.0, (1.0, 0.97, 0.92), (31, 16, 1))
    add_area('影棚补光', (24, 12, 8), 900, 5.0, (0.9, 0.95, 1.0), (31, 16, 1))
    # backdrop
    mb = MB()
    mb.box((31, 12.5, 4.5), (26, 0.5, 10), M['stone'])
    back = mb.finish('影棚背景', 'STUDIO')
    back.data.materials.clear()
    back.data.materials.append(mat_principled('影棚背景色', (0.72, 0.72, 0.74), 0.95))
    # hide studio from normal renders
    COL['STUDIO'].hide_render = True
    return back

# ================================================================ RENDER
def setup_render(engine='CYCLES', samples=128, res=(1600, 900), denoise=True):
    scene.render.engine = engine
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    if engine == 'CYCLES':
        scene.cycles.samples = samples
        scene.cycles.use_denoising = denoise
        scene.cycles.device = 'CPU'
        try:
            scene.cycles.denoiser = 'OPENIMAGEDENOISE'
        except Exception:
            pass
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    # color management: ensure AgX view transform (headless default may be 'None')
    try:
        scene.view_settings.view_transform = 'AgX'
    except Exception:
        pass
    for look in ('AgX - Medium High Contrast', 'AgX - Medium High Contrast', 'Medium High Contrast', 'None'):
        try:
            scene.view_settings.look = look
            break
        except Exception:
            continue
    # exposure compensation (Blender 5.2 sky texture outputs higher dynamic range)
    scene.view_settings.exposure = -1.2
    # compositor glare for night (Blender 5.x API)
    try:
        nt = scene.node_tree
        has_old_api = True
    except AttributeError:
        has_old_api = False
    if not has_old_api:
        ng = bpy.data.node_groups.get('Compositor') or bpy.data.node_groups.new('Compositor', 'CompositorNodeTree')
        scene.compositing_node_group = ng
        nt = ng
        # ensure group interface sockets exist
        names = [s.name for s in nt.interface.items_tree] if hasattr(nt.interface, 'items_tree') else []
        if 'Image' not in names:
            try:
                nt.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
            except Exception:
                pass
    nt.nodes.clear()
    rl = nt.nodes.new('CompositorNodeRLayers')
    glare = nt.nodes.new('CompositorNodeGlare')
    # Blender 5.x: glare settings are socket inputs
    for sock_name, val in (('Type', 'Fog Glow'), ('Threshold', 2.5), ('Size', 7)):
        try:
            glare.inputs[sock_name].default_value = val
        except Exception:
            pass
    try:
        comp = nt.nodes.new('CompositorNodeComposite')
    except RuntimeError:
        # Blender 5.x: use group output node
        ng = scene.compositing_node_group
        try:
            ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        except Exception:
            pass
        comp = nt.nodes.new('NodeGroupOutput')
    nt.links.new(rl.outputs['Image'], glare.inputs['Image'])
    nt.links.new(glare.outputs['Image'], comp.inputs['Image'])
    return glare

def render(name, cam, path, engine='CYCLES', samples=128, res=(1600, 900), denoise=True, night=False):
    if night:
        setup_world_night()
    else:
        setup_world_day()
    scene.camera = cam
    setup_render(engine, samples, res, denoise)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('RENDERED', path)

# ================================================================ MAIN
def main():
    print('=== Building Hanging Temple model ===')
    build_cliff()
    build_ledges()
    build_terrain()
    # halls
    build_hall('西殿', -14.5, -1.6, 9.0, 6.5, 3)      # west 3-story (tallest)
    build_hall('中殿', -2.0, -1.6, 11.0, 6.8, 2)      # central 2-story
    build_hall('东楼', 12.5, -1.6, 14.0, 5.6, 2)      # east long 2-story
    build_structure()
    build_incense_burner()
    # details (excluded from main renders & exports)
    COL['DETAILS'].hide_render = True
    detail_platform()
    detail_eave_tenon()
    detail_beam_column()
    detail_railing()
    detail_column_base()
    setup_studio()

    # ---- lights & cameras
    sun = add_sun('太阳', (0.55, 0.62, 0.72), 2.2, (1.0, 0.94, 0.82), 0.04)
    add_sun('补光', (-0.7, 0.3, 0.5), 0.3, (0.75, 0.82, 1.0))
    moon = add_sun('月光', (0.4, 0.5, 0.8), 0.25, (0.55, 0.65, 0.9))

    cam_over = add_camera('总览', (38, 44, 33), (-3, -2, 19), lens=33)
    cam_front = add_camera('正立面', (1, 52, 20.5), (-2, -2, 19.5), lens=42)
    cam_side = add_camera('侧向', (58, 4, 18.5), (-2, -2, 19), lens=40)
    cam_top = add_camera('俯视', (-2, 14, 78), (-2, 12, 0), lens=42)
    cam_corridor = add_camera('走廊', (19, 4.6, 20.3), (-9, 0.5, 19.0), lens=22)
    cam_cantilever = add_camera('悬挑', (24, 16, 11.5), (-5, -3, 17.5), lens=32)
    cam_sunset = add_camera('夕阳', (-34, 42, 15), (0, -2, 19), lens=38)
    cam_eave = add_camera('屋檐', (-19, 7.5, 23.5), (-13.5, -2.5, 21.5), lens=52)
    cam_burner = add_camera('香炉', (0.6, 4.4, 19.4), (-2.0, 1.5, 19.0), lens=60)
    cam_detail_eave = add_camera('大样屋檐', (27.5, 13.0, 3.2), (26.0, 16.2, 2.2), lens=50)
    cam_detail_beam = add_camera('大样梁柱', (27.5, 13.2, 3.4), (29.5, 16.2, 2.4), lens=50)
    cam_detail_rail = add_camera('大样栏杆', (31.0, 13.0, 2.8), (33.0, 16.2, 1.8), lens=50)
    cam_detail_base = add_camera('大样柱础', (34.0, 13.0, 3.0), (36.5, 16.2, 1.6), lens=50)

    # save blend
    blend_path = os.path.join(OUT, 'model', 'hanging_temple.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print('SAVED', blend_path)

    # ---- exports
    export_cols = ['CLIFF', 'TERRAIN', 'BUILDINGS', 'STRUCTURE', 'PROPS']
    for c in COL.values():
        c.hide_render = False
    # select only export collections
    bpy.ops.object.select_all(action='DESELECT')
    for cn in export_cols:
        for o in COL[cn].objects:
            o.select_set(True)
    glb = os.path.join(OUT, 'model', 'hanging_temple.glb')
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_apply=True,
                              use_selection=True, export_cameras=False, export_lights=False,
                              export_extras=False)
    print('EXPORTED GLB', glb, os.path.getsize(glb))
    fbx = os.path.join(OUT, 'model', 'hanging_temple.fbx')
    bpy.ops.export_scene.fbx(filepath=fbx, use_selection=True, apply_unit_scale=True)
    print('EXPORTED FBX', fbx, os.path.getsize(fbx))
    obj = os.path.join(OUT, 'model', 'hanging_temple.obj')
    bpy.ops.wm.obj_export(filepath=obj, export_selected_objects=True, apply_modifiers=True)
    print('EXPORTED OBJ', obj, os.path.getsize(obj))

    if SKIP_RENDER or ONLY_GLB:
        print('Skipping renders.')
        return

    if TEST_ONE:
        setup_world_day()
        scene.camera = cam_over
        setup_render('CYCLES', 48, (960, 540))
        scene.render.filepath = os.path.join(REN, 'exposure_test.png')
        bpy.ops.render.render(write_still=True)
        print('TEST RENDER DONE')
        return

    # ---- main renders (Cycles)
    setup_world_day()
    render('日景总览', cam_over, os.path.join(REN, 'day_hero.png'), 'CYCLES', 160, (1920, 1080))
    render('正立面', cam_front, os.path.join(REN, 'view_front.png'), 'CYCLES', 128, (1600, 900))
    render('侧向', cam_side, os.path.join(REN, 'view_side.png'), 'CYCLES', 128, (1600, 900))
    render('俯视', cam_top, os.path.join(REN, 'view_top.png'), 'CYCLES', 128, (1600, 900))
    render('走廊内视', cam_corridor, os.path.join(REN, 'view_corridor.png'), 'CYCLES', 128, (1600, 900))
    render('悬挑结构', cam_cantilever, os.path.join(REN, 'view_cantilever.png'), 'CYCLES', 128, (1600, 900))
    render('屋檐近景', cam_eave, os.path.join(REN, 'view_eave.png'), 'CYCLES', 128, (1600, 900))
    render('香炉特写', cam_burner, os.path.join(REN, 'view_burner.png'), 'CYCLES', 128, (1200, 900))

    # sunset mood
    sun2 = add_sun('夕阳', (-0.85, 0.55, 0.18), 2.8, (1.0, 0.55, 0.25), 0.06)
    setup_world_day()
    scene.camera = cam_sunset
    setup_render('CYCLES', 160, (1920, 1080))
    scene.render.filepath = os.path.join(REN, 'view_sunset.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED sunset')

    # night hero
    scene.camera = cam_over
    render('夜景总览', cam_over, os.path.join(REN, 'night_hero.png'), 'CYCLES', 160, (1920, 1080), night=True)

    # ---- detail renders (studio)
    COL['DETAILS'].hide_render = False
    for cn in ['CLIFF', 'TERRAIN', 'BUILDINGS', 'STRUCTURE', 'PROPS']:
        COL[cn].hide_render = True
    COL['STUDIO'].hide_render = False
    studio_world = bpy.data.worlds.new('影棚')
    studio_world.use_nodes = True
    bg = next(n for n in studio_world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.8, 0.8, 0.82, 1)
    bg.inputs['Strength'].default_value = 0.6
    scene.world = studio_world
    detail_jobs = [
        ('大样屋檐榫卯', cam_detail_eave, 'detail_eave_tenon.png'),
        ('大样梁柱榫卯', cam_detail_beam, 'detail_beam_column.png'),
        ('大样栏杆节点', cam_detail_rail, 'detail_railing.png'),
        ('大样立柱石墩', cam_detail_base, 'detail_column_base.png'),
    ]
    for label, cam, fname in detail_jobs:
        scene.camera = cam
        setup_render('CYCLES', 192, (1400, 1000))
        scene.render.filepath = os.path.join(REN, fname)
        bpy.ops.render.render(write_still=True)
        print('RENDERED', fname)
    # restore
    for cn in COL:
        COL[cn].hide_render = False
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'model', 'hanging_temple_rendered.blend'))

main()
print('=== BUILD COMPLETE ===')
