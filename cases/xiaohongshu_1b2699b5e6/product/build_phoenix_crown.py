#!/usr/bin/env python3
"""Build a traditional Chinese phoenix crown (凤冠) procedurally in Blender.

Features: gold frame, turquoise enamel, red gems, white pearl tassels,
left-right symmetric layout, openwork (filigree) decorations.
Outputs: phoenix_crown.glb (openable 3D model), phoenix_crown.blend, preview.png
"""
import os
import bpy
import bmesh
import math
from math import sin, cos, pi, radians
from mathutils import Vector, Matrix

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- materials
def _set(bsdf, names, val):
    for n in names:
        sock = bsdf.inputs.get(n)
        if sock is not None:
            sock.default_value = val
            return

def make_materials():
    mats = {}

    m = bpy.data.materials.new("Gold"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    _set(b, ["Base Color"], (1.0, 0.71, 0.28, 1.0))
    _set(b, ["Metallic"], 1.0)
    _set(b, ["Roughness"], 0.26)
    mats["gold"] = m

    m = bpy.data.materials.new("TurquoiseEnamel"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    _set(b, ["Base Color"], (0.055, 0.55, 0.52, 1.0))
    _set(b, ["Metallic"], 0.15)
    _set(b, ["Roughness"], 0.16)
    _set(b, ["Coat Weight", "Clearcoat"], 0.7)
    _set(b, ["Coat Roughness", "Clearcoat Roughness"], 0.08)
    mats["turquoise"] = m

    m = bpy.data.materials.new("RedGem"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    _set(b, ["Base Color"], (0.45, 0.008, 0.02, 1.0))
    _set(b, ["Metallic"], 0.25)
    _set(b, ["Roughness"], 0.06)
    _set(b, ["Emission Color", "Emission"], (0.35, 0.0, 0.01, 1.0))
    _set(b, ["Emission Strength"], 0.35)
    mats["red"] = m

    m = bpy.data.materials.new("Pearl"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    _set(b, ["Base Color"], (0.93, 0.91, 0.86, 1.0))
    _set(b, ["Metallic"], 0.0)
    _set(b, ["Roughness"], 0.2)
    _set(b, ["Coat Weight", "Clearcoat"], 0.5)
    _set(b, ["Emission Color", "Emission"], (0.06, 0.055, 0.05, 1.0))
    _set(b, ["Emission Strength"], 0.25)
    mats["pearl"] = m

    m = bpy.data.materials.new("RedTrim"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    _set(b, ["Base Color"], (0.4, 0.015, 0.03, 1.0))
    _set(b, ["Roughness"], 0.35)
    mats["trim"] = m

    return mats

MATS = make_materials()
# material slot order used by every object
SLOT_ORDER = ["gold", "turquoise", "red", "pearl", "trim"]
MI = {k: i for i, k in enumerate(SLOT_ORDER)}

# ---------------------------------------------------------------- mesh builder
class MB:
    """Accumulates geometry into one bmesh with per-face material indices."""
    def __init__(self):
        self.bm = bmesh.new()

    def _new_faces(self, verts):
        fs = set()
        for v in verts:
            for f in v.link_faces:
                fs.add(f)
        return fs

    def _mark(self, verts, mi, smooth):
        for f in self._new_faces(verts):
            f.material_index = mi
            f.smooth = smooth

    def _mark_new(self, new_verts, mi, smooth):
        """Mark only faces touching newly created verts (not pre-existing ones)."""
        fs = set()
        for v in new_verts:
            for f in v.link_faces:
                fs.add(f)
        for f in fs:
            f.material_index = mi
            f.smooth = smooth

    def sphere(self, matrix, seg=24, rings=12, mi=0, smooth=True):
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=seg,
                                        v_segments=rings, radius=1.0,
                                        matrix=matrix)
        self._mark(res["verts"], mi, smooth)

    def cone(self, matrix, r1, r2, depth, seg=16, mi=0, smooth=True):
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False,
                                    segments=seg, radius1=r1, radius2=r2,
                                    depth=depth, matrix=matrix)
        self._mark(res["verts"], mi, smooth)

    def ico(self, matrix, subdivisions=2, mi=0):
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=subdivisions,
                                         radius=1.0, matrix=matrix)
        self._mark(res["verts"], mi, smooth=False)

    def torus(self, matrix, R, r, seg=40, tseg=12, mi=0):
        rings = []
        new_verts = []
        for i in range(seg):
            a = 2 * pi * i / seg
            ca, sa = cos(a), sin(a)
            ring = []
            for j in range(tseg):
                bb = 2 * pi * j / tseg
                cx = (R + r * cos(bb)) * ca
                cy = (R + r * cos(bb)) * sa
                cz = r * sin(bb)
                v = self.bm.verts.new(matrix @ Vector((cx, cy, cz)))
                ring.append(v)
                new_verts.append(v)
            rings.append(ring)
        for i in range(seg):
            i2 = (i + 1) % seg
            for j in range(tseg):
                j2 = (j + 1) % tseg
                self.bm.faces.new((rings[i][j], rings[i][j2],
                                  rings[i2][j2], rings[i2][j]))
        self._mark_new(new_verts, mi, smooth=True)

    def tube(self, pts, radii, seg=10, caps=True, mi=0, smooth=True):
        """Sweep a circle along a polyline (parallel-transport frames)."""
        pts = [Vector(p) for p in pts]
        n = len(pts)
        tans = []
        for i in range(n):
            if i == 0:
                t = pts[1] - pts[0]
            elif i == n - 1:
                t = pts[-1] - pts[-2]
            else:
                t = pts[i + 1] - pts[i - 1]
            if t.length < 1e-9:
                t = Vector((0, 0, 1))
            tans.append(t.normalized())
        ref = Vector((0, 0, 1))
        if abs(tans[0].dot(ref)) > 0.9:
            ref = Vector((1, 0, 0))
        nrm = (ref - tans[0] * ref.dot(tans[0])).normalized()
        rings = []
        for i in range(n):
            if i > 0:
                q = tans[i - 1].rotation_difference(tans[i])
                nrm = q @ nrm
                nrm = nrm - tans[i] * nrm.dot(tans[i])
                if nrm.length < 1e-9:
                    nrm = tans[i].orthogonal()
                nrm.normalize()
            binorm = tans[i].cross(nrm).normalized()
            ring = []
            for j in range(seg):
                a = 2 * pi * j / seg
                off = nrm * (cos(a) * radii[i]) + binorm * (sin(a) * radii[i])
                ring.append(self.bm.verts.new(pts[i] + off))
            rings.append(ring)
        for i in range(n - 1):
            for j in range(seg):
                j2 = (j + 1) % seg
                self.bm.faces.new((rings[i][j], rings[i][j2],
                                  rings[i + 1][j2], rings[i + 1][j]))
        if caps and radii[0] > 1e-6:
            self.bm.faces.new(tuple(reversed(rings[0])))
        if caps and radii[-1] > 1e-6:
            self.bm.faces.new(tuple(rings[-1]))
        self._mark_new([v for ring in rings for v in ring], mi, smooth)

    def lathe(self, profile, seg=64, closed=False, mi=0, smooth=True):
        """Spin a (r, z) profile around the Z axis."""
        rings = []
        new_verts = []
        for (r, z) in profile:
            if r < 1e-6:
                v = self.bm.verts.new(Vector((0, 0, z)))
                rings.append([v])
                new_verts.append(v)
            else:
                ring = []
                for j in range(seg):
                    a = 2 * pi * j / seg
                    v = self.bm.verts.new(Vector((r * cos(a), r * sin(a), z)))
                    ring.append(v)
                    new_verts.append(v)
                rings.append(ring)
        n = len(rings)
        limit = n if closed else n - 1
        for i in range(limit):
            r1, r2 = rings[i], rings[(i + 1) % n]
            if len(r1) == 1 and len(r2) == 1:
                continue
            if len(r1) == 1:
                c = r1[0]
                for j in range(seg):
                    j2 = (j + 1) % seg
                    self.bm.faces.new((c, r2[j], r2[j2]))
            elif len(r2) == 1:
                c = r2[0]
                for j in range(seg):
                    j2 = (j + 1) % seg
                    self.bm.faces.new((r1[j], c, r1[j2]))
            else:
                for j in range(seg):
                    j2 = (j + 1) % seg
                    self.bm.faces.new((r1[j], r1[j2], r2[j2], r2[j]))
        self._mark_new(new_verts, mi, smooth)

    def finish(self, name):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        for k in SLOT_ORDER:
            me.materials.append(MATS[k])
        obj = bpy.data.objects.new(name, me)
        scene.collection.objects.link(obj)
        return obj

# ---------------------------------------------------------------- dimensions
BAND_R = 1.0
BAND_Z0, BAND_Z1 = 0.0, 0.34
DOME_Z0, DOME_Z1 = 0.34, 1.12
DOME_R = 0.97

def dome_r(z):
    t = max(0.0, min(1.0, (z - DOME_Z0) / (DOME_Z1 - DOME_Z0)))
    return DOME_R * (max(0.0, 1.0 - t ** 1.6)) ** 0.65

def dome_normal(a, z):
    """Outward normal of the dome surface at angle a, height z."""
    dz = 0.002
    rp = (dome_r(z + dz) - dome_r(z - dz)) / (2 * dz)
    n = Vector((cos(a), sin(a), -rp))
    n.normalize()
    return n

def T(x, y=None, z=None):
    if y is None and z is None:
        return Matrix.Translation(x)
    return Matrix.Translation((x, y, z))

def S(sx, sy, sz):
    return Matrix.Diagonal((sx, sy, sz, 1.0))

# ---------------------------------------------------------------- crown band
def build_band():
    mb = MB()
    mi_g, mi_t, mi_tr = MI["gold"], MI["turquoise"], MI["trim"]
    # turquoise enamel band (solid ring)
    mb.lathe([(0.94, 0.0), (1.0, 0.0), (1.0, 0.34), (0.94, 0.34)],
             seg=96, closed=True, mi=mi_t)
    # gold edge rings
    mb.torus(T(0, 0, 0.02), 1.0, 0.028, mi=mi_g)
    mb.torus(T(0, 0, 0.32), 0.985, 0.028, mi=mi_g)
    # thin red trim lines
    mb.torus(T(0, 0, 0.055), 0.998, 0.011, mi=mi_tr)
    mb.torus(T(0, 0, 0.285), 0.99, 0.011, mi=mi_tr)
    # gold vertical ribs (12)
    for k in range(12):
        a = 2 * pi * k / 12
        pts = []
        for i in range(5):
            t = i / 4
            z = 0.035 + t * 0.27
            r = 1.0 - 0.015 * t + 0.018 * sin(pi * t)
            pts.append((r * cos(a), r * sin(a), z))
        mb.tube(pts, [0.02] * 5, seg=8, mi=mi_g)
    # gold floral rosettes between ribs
    for k in range(12):
        a = 2 * pi * (k + 0.5) / 12
        cx, cy = 1.005 * cos(a), 1.005 * sin(a)
        mb.sphere(T(cx, cy, 0.17) @ S(0.035, 0.035, 0.035), seg=12, rings=8, mi=mi_g)
        for p in range(6):
            b = a + 2 * pi * p / 6
            M = (T(cx, cy, 0.17) @ Matrix.Rotation(b, 4, 'Z')
                 @ T(0.055, 0, 0) @ S(0.055, 0.026, 0.026))
            mb.sphere(M, seg=12, rings=8, mi=mi_g)
    # small red gems on band front & back
    for a_deg in (248, 292, 68, 112):
        a = radians(a_deg)
        mb.ico(T(1.005 * cos(a), 1.005 * sin(a), 0.17) @ S(0.042, 0.042, 0.042),
               subdivisions=2, mi=MI["red"])
    return mb.finish("CrownBand")

# ---------------------------------------------------------------- crown dome
def build_dome():
    mb = MB()
    mi_g, mi_t, mi_r = MI["gold"], MI["turquoise"], MI["red"]
    # turquoise enamel dome (solid)
    prof = []
    N = 26
    for i in range(N + 1):
        t = i / N
        z = DOME_Z0 + (DOME_Z1 - DOME_Z0) * t
        prof.append((dome_r(z), z))
    prof += [(0.0, DOME_Z1), (0.0, 0.30), (0.90, 0.30), (0.90, 0.34)]
    mb.lathe(prof, seg=96, closed=True, mi=mi_t)
    # gold meridian ribs (8)
    for k in range(8):
        a = 2 * pi * (k + 0.5) / 8
        pts = []
        for i in range(9):
            t = i / 8
            z = 0.37 + t * 0.62
            r = dome_r(z) + 0.012
            pts.append((r * cos(a), r * sin(a), z))
        mb.tube(pts, [0.02] * 9, seg=8, mi=mi_g)
    # gold scroll filigree, 2 per panel (openwork feel)
    for k in range(8):
        a0 = 2 * pi * k / 8
        for s in (-1, 1):
            pts = []
            M = 14
            for i in range(M + 1):
                t = i / M
                z = 0.42 + t * 0.5
                a = a0 + s * 0.14 + s * 0.16 * sin(t * pi) * (1 - 0.2 * t)
                r = dome_r(z) + 0.012
                pts.append((r * cos(a), r * sin(a), z))
            mb.tube(pts, [0.013] * (M + 1), seg=6, mi=mi_g)
    # openwork medallions: gold ring + red gem, one per panel
    for k in range(8):
        a = 2 * pi * k / 8
        z = 0.56
        n = dome_normal(a, z)
        base = Vector((dome_r(z) * cos(a), dome_r(z) * sin(a), z)) + n * 0.012
        rot = n.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        mb.torus(T(base) @ rot, 0.085, 0.012, seg=28, tseg=8, mi=mi_g)
        mb.ico(T(base + n * 0.015) @ S(0.038, 0.038, 0.038), subdivisions=2, mi=mi_r)
    # red gems on dome panels
    for k in range(8):
        a = 2 * pi * k / 8
        z = 0.72
        n = dome_normal(a, z)
        pos = Vector((dome_r(z) * cos(a), dome_r(z) * sin(a), z)) + n * 0.02
        mb.ico(T(pos) @ S(0.05, 0.05, 0.05), subdivisions=2, mi=mi_r)
    return mb.finish("CrownDome")

# ---------------------------------------------------------------- phoenix
def build_phoenixes():
    mb = MB()
    mi_g, mi_r = MI["gold"], MI["red"]
    Z_BASE = 0.80
    SCALE = 1.1
    TILT = radians(35)               # rise upward, facing outward
    WING_TIPS = [(0.34, 0.12, 0.08), (0.46, 0.04, 0.12), (0.54, -0.04, 0.15),
                 (0.58, -0.12, 0.14), (0.56, -0.20, 0.10)]
    for k in range(6):
        theta = 2 * pi * k / 6       # 0,60,...,300 — front (270) left for lotus
        r_base = dome_r(Z_BASE) + 0.22
        phi = theta - pi / 2         # local +Y -> outward
        P = (T(r_base * cos(theta), r_base * sin(theta), Z_BASE)
             @ Matrix.Rotation(phi, 4, 'Z')
             @ Matrix.Rotation(TILT, 4, 'X')
             @ Matrix.Scale(SCALE, 4))

        def L(M):
            if isinstance(M, (tuple, list)):
                M = Vector(M)
            return P @ M

        # body
        mb.sphere(L(T(0, 0, 0) @ S(0.10, 0.16, 0.085)), mi=mi_g)
        # neck rising
        mb.tube([L(v) for v in [(0, 0.10, 0.02), (0, 0.20, 0.10), (0, 0.26, 0.20)]],
                [0.045, 0.040, 0.034], seg=10, mi=mi_g)
        # head
        mb.sphere(L(T(0, 0.28, 0.24) @ S(0.062, 0.062, 0.062)), mi=mi_g)
        # beak (cone pointing +Y)
        mb.cone(L(T(0, 0.36, 0.24) @ Matrix.Rotation(radians(-90), 4, 'X')),
                0.024, 0.0, 0.09, seg=10, mi=mi_g)
        # crest plumes sweeping up-back
        for dx in (-0.025, 0.0, 0.025):
            M = L(T(dx, 0.28, 0.30) @ Matrix.Rotation(radians(27), 4, 'X'))
            mb.cone(M, 0.011, 0.0, 0.11, seg=6, mi=mi_g)
        # wings: broad horizontal fans
        for s in (-1, 1):
            M = (L(T(s * 0.15, -0.02, 0.08)
                 @ Matrix.Rotation(radians(s * -25), 4, 'Y')
                 @ S(0.16, 0.05, 0.08)))
            mb.sphere(M, mi=mi_g)
            for f in range(5):
                tx, ty, tz = WING_TIPS[f]
                tip = Vector((s * tx, ty, tz))
                shoulder = Vector((s * 0.08, 0.02, 0.05))
                pts = [L(shoulder),
                       L(shoulder.lerp(tip, 0.4) + Vector((0, 0, 0.03))),
                       L(shoulder.lerp(tip, 0.75) + Vector((0, 0, 0.02))),
                       L(tip)]
                mb.tube(pts, [0.026, 0.022, 0.015, 0.005], seg=8, mi=mi_g)
        # tail plumes: modest gold fan curling up behind the bird
        for f in range(5):
            dx = (f - 2) * 0.12
            pts = [
                L(Vector((dx * 0.15, -0.06, 0.00))),
                L(Vector((dx * 0.45, -0.10, 0.08))),
                L(Vector((dx * 0.80, -0.12, 0.18))),
                L(Vector((dx * 1.10, -0.12, 0.30))),
            ]
            mb.tube(pts, [0.034, 0.030, 0.024, 0.012], seg=8, mi=mi_g)
            # small gold eye disc on the plume tip
            mb.sphere(L(T(dx * 1.10, -0.10, 0.325) @ S(0.026, 0.014, 0.030)),
                      seg=12, rings=8, mi=mi_g)
    return mb.finish("Phoenixes")

# ---------------------------------------------------------------- front lotus
def build_lotus():
    mb = MB()
    mi_g, mi_r = MI["gold"], MI["red"]
    z = 0.52
    r = dome_r(z) + 0.06
    n = dome_normal(3 * pi / 2, z)
    base = Vector((r * cos(3 * pi / 2), r * sin(3 * pi / 2), z))
    P = T(base) @ n.to_track_quat('Y', 'Z').to_matrix().to_4x4()

    def L(M):
        return P @ M

    # back plate
    mb.sphere(L(T(0, -0.03, 0) @ S(0.17, 0.035, 0.17)), mi=mi_g)
    # outer petals
    for i in range(10):
        b = 2 * pi * i / 10
        d = Vector((sin(b) * 0.8, 0.6, cos(b) * 0.8)).normalized()
        M = (L(T(d * 0.08) @ d.to_track_quat('Y', 'Z').to_matrix().to_4x4()
             @ S(0.045, 0.15, 0.016)))
        mb.sphere(M, seg=12, rings=8, mi=mi_g)
    # inner petals
    for i in range(8):
        b = 2 * pi * (i + 0.5) / 8
        d = Vector((sin(b) * 0.55, 0.85, cos(b) * 0.55)).normalized()
        M = (L(T(d * 0.05) @ d.to_track_quat('Y', 'Z').to_matrix().to_4x4()
             @ S(0.038, 0.11, 0.014)))
        mb.sphere(M, seg=12, rings=8, mi=mi_g)
    # gold bezel + red gem center
    mb.torus(L(T(0, 0.045, 0) @ Matrix.Rotation(radians(90), 4, 'X')),
             0.095, 0.014, seg=28, tseg=8, mi=mi_g)
    mb.ico(L(T(0, 0.06, 0) @ S(0.095, 0.095, 0.095)), subdivisions=2, mi=mi_r)
    return mb.finish("FrontLotus")

# ---------------------------------------------------------------- top pearl
def build_top_pearl():
    mb = MB()
    mi_g, mi_p = MI["gold"], MI["pearl"]
    # gold calyx petals
    for i in range(6):
        b = 2 * pi * i / 6
        d = Vector((sin(b) * 0.7, 0, cos(b) * 0.7)).normalized()
        M = (T(d * 0.05) @ d.to_track_quat('Y', 'Z').to_matrix().to_4x4()
             @ T(0, 0, 1.12) @ S(0.035, 0.10, 0.014))
        mb.sphere(M, seg=12, rings=8, mi=mi_g)
    # gold stem + cup
    mb.tube([(0, 0, 1.10), (0, 0, 1.28)], [0.030, 0.024], seg=10, mi=mi_g)
    mb.cone(T(0, 0, 1.30) @ Matrix.Rotation(radians(180), 4, 'X'),
            0.075, 0.030, 0.08, seg=16, mi=mi_g)
    # the pearl
    mb.sphere(T(0, 0, 1.44) @ S(0.17, 0.17, 0.165), seg=32, rings=20, mi=mi_p)
    return mb.finish("TopPearl")

# ---------------------------------------------------------------- side pendants
def build_pendants():
    mb = MB()
    mi_g, mi_r, mi_p = MI["gold"], MI["red"], MI["pearl"]
    for s in (-1, 1):
        x = s * 1.0
        # connector ring on the band
        mb.torus(T(x, 0, 0.30) @ Matrix.Rotation(radians(90), 4, 'Y'),
                 0.045, 0.013, seg=24, tseg=8, mi=mi_g)
        # openwork pendant ring
        mb.torus(T(s * 1.04, 0, 0.12) @ Matrix.Rotation(radians(90), 4, 'Y'),
                 0.13, 0.016, seg=36, tseg=8, mi=mi_g)
        # inner S-scroll (openwork)
        pts = []
        for i in range(13):
            u = i / 12
            pts.append((s * 1.04, 0.065 * sin(2 * pi * u), 0.05 + 0.14 * u))
        mb.tube(pts, [0.011] * 13, seg=6, mi=mi_g)
        # red gem on top
        mb.ico(T(s * 1.04, 0, 0.245) @ S(0.045, 0.045, 0.045), subdivisions=2, mi=mi_r)
        # gold beads at ring bottom
        for dy in (-0.05, 0.0, 0.05):
            mb.sphere(T(s * 1.04, dy, -0.015) @ S(0.02, 0.02, 0.02), seg=10, rings=6, mi=mi_g)
        # pearl strands hanging from the pendant
        for dy in (-0.09, -0.045, 0.0, 0.045, 0.09):
            p0 = Vector((s * 1.04, dy, 0.02))
            p1 = Vector((s * 1.07, dy * 1.15, -0.16))
            p2 = Vector((s * 1.11, dy * 1.25, -0.40))
            path = [p0, p1, p2]
            mb.tube(path, [0.005] * 3, seg=5, mi=mi_g)
            for u in (0.3, 0.5, 0.7, 0.88):
                pos = p0.lerp(p1, min(u, 1.0)) if u < 0.5 else p1.lerp(p2, (u - 0.5) * 2)
                mb.sphere(T(pos) @ S(0.024, 0.024, 0.024), seg=10, rings=6, mi=mi_p)
            mb.sphere(T(p2 + Vector((0, 0, -0.035))) @ S(0.030, 0.030, 0.052),
                      seg=12, rings=8, mi=mi_p)
    return mb.finish("SidePendants")

# ---------------------------------------------------------------- pearl tassels
def bez(u, p0, p1, p2):
    return (1 - u) ** 2 * p0 + 2 * (1 - u) * u * p1 + u ** 2 * p2

def build_tassels():
    mb = MB()
    mi_g, mi_p = MI["gold"], MI["pearl"]
    for center in (0, 180):
        for da in range(-52, 53, 8):
            a = radians(center + da)
            L = 0.38 + 0.30 * cos(radians(da))
            p0 = Vector((0.97 * cos(a), 0.97 * sin(a), 0.04))
            p1 = Vector((1.03 * cos(a), 1.03 * sin(a), 0.04 - L * 0.45))
            p2 = Vector((1.07 * cos(a), 1.07 * sin(a), 0.04 - L))
            path = [bez(i / 10, p0, p1, p2) for i in range(11)]
            mb.tube(path, [0.005] * 11, seg=5, mi=mi_g)
            for u in (0.18, 0.34, 0.50, 0.66, 0.82):
                pos = bez(u, p0, p1, p2)
                mb.sphere(T(pos) @ S(0.023, 0.023, 0.023), seg=10, rings=6, mi=mi_p)
            mb.sphere(T(p2 + Vector((0, 0, -0.032))) @ S(0.028, 0.028, 0.048),
                      seg=12, rings=8, mi=mi_p)
    return mb.finish("PearlTassels")

# ---------------------------------------------------------------- assemble
objs = [build_band(), build_dome(), build_phoenixes(), build_lotus(),
        build_top_pearl(), build_pendants(), build_tassels()]

root = bpy.data.objects.new("PhoenixCrown", None)
scene.collection.objects.link(root)
for o in objs:
    o.parent = root

# ---------------------------------------------------------------- preview render
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.82, 0.82, 0.85, 1.0)
bg.inputs[1].default_value = 0.7

sun_data = bpy.data.lights.new("KeyLight", 'SUN')
sun_data.energy = 3.5
sun = bpy.data.objects.new("KeyLight", sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (radians(45), radians(10), radians(35))

fill_data = bpy.data.lights.new("FillLight", 'SUN')
fill_data.energy = 1.0
fill = bpy.data.objects.new("FillLight", fill_data)
scene.collection.objects.link(fill)
fill.rotation_euler = (radians(55), 0, radians(-120))

cam_data = bpy.data.cameras.new("Camera")
cam_data.lens = 55
cam = bpy.data.objects.new("Camera", cam_data)
scene.collection.objects.link(cam)
cam_pos = Vector((3.6, -4.0, 2.1))
cam.location = cam_pos
direction = Vector((0, 0, 0.45)) - cam_pos
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam

# temporary ground plane (deleted before export)
gnd_me = bpy.data.meshes.new("Ground")
gb = bmesh.new()
bmesh.ops.create_grid(gb, x_segments=1, y_segments=1, size=12)
gb.to_mesh(gnd_me)
gb.free()
gnd = bpy.data.objects.new("Ground", gnd_me)
scene.collection.objects.link(gnd)
gnd.location.z = -0.78
gnd_mat = bpy.data.materials.new("GroundMat")
gnd_mat.use_nodes = True
gb2 = gnd_mat.node_tree.nodes["Principled BSDF"]
_set(gb2, ["Base Color"], (0.06, 0.06, 0.07, 1.0))
_set(gb2, ["Roughness"], 0.9)
gnd_me.materials.append(gnd_mat)

scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = os.path.join(OUT_DIR, "preview.png")
bpy.ops.render.render(write_still=True)

# front view to verify the lotus and symmetry
cam.location = (0, -5.4, 1.5)
direction = Vector((0, 0, 0.55)) - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = os.path.join(OUT_DIR, "preview_front.png")
bpy.ops.render.render(write_still=True)

# ---------------------------------------------------------------- export
bpy.data.objects.remove(gnd, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT_DIR, "phoenix_crown.glb"),
                          export_format='GLB')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, "phoenix_crown.blend"))
print("DONE: phoenix_crown.glb / phoenix_crown.blend / preview.png")
