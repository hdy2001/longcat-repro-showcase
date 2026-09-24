"""Build the 庆余年2-style wedding phoenix crown (大婚凤冠) as a 3D-printable model.

Units: millimetres. Y-up, Z-front. Exports phoenix_crown.stl / .obj.

Structure:
  - crown band (swept arc) with top/bottom rims and beaded top edge
  - 4 openwork panels (龙凤镂空) mounted on the band
  - 2 dragon heads (龙首) on the upper sides
  - central lotus-pearl ornament (中央顶饰)
  - front pendant (正面垂饰) with phoenix plaque
  - 2 side tassel clusters (两侧流苏), 5 strands each
  - 2 back tassels (后坠)
"""
import numpy as np
import trimesh
from shapely.geometry import Point, Polygon
from shapely import affinity
from crown_shapes import (phoenix, dragon, teardrop, panel_with_openwork,
                           rounded_rect, _flatten_polygons)

R = 82.0          # band radius
ARC = np.radians(108)   # half wrap angle
PARTS = []        # list of trimesh meshes


# ------------------------------------------------------------ helpers --
def loft(path, radii, sides=12, cap=True):
    """Tube along a polyline with varying radius (parallel-transport frames)."""
    path = np.asarray(path, dtype=float)
    radii = np.asarray(radii, dtype=float)
    n = len(path)
    tang = np.zeros_like(path)
    tang[1:-1] = path[2:] - path[:-2]
    tang[0] = path[1] - path[0]
    tang[-1] = path[-1] - path[-2]
    tang /= (np.linalg.norm(tang, axis=1, keepdims=True) + 1e-12)
    # initial normal
    ref = np.array([0.0, 1.0, 0.0])
    if abs(tang[0] @ ref) > 0.9:
        ref = np.array([1.0, 0.0, 0.0])
    nrm = ref - tang[0] * (ref @ tang[0])
    nrm /= np.linalg.norm(nrm)
    rings = []
    for i in range(n):
        if i > 0:
            nrm = nrm - tang[i] * (nrm @ tang[i])
            nrm /= (np.linalg.norm(nrm) + 1e-12)
        binorm = np.cross(tang[i], nrm)
        a = np.linspace(0, 2 * np.pi, sides, endpoint=False)
        ring = (path[i] + radii[i] * (np.outer(np.cos(a), nrm)
                                       + np.outer(np.sin(a), binorm)))
        rings.append(ring)
    verts = np.vstack(rings)
    faces = []
    for i in range(n - 1):
        for j in range(sides):
            j2 = (j + 1) % sides
            a, b = i * sides + j, i * sides + j2
            c, d = (i + 1) * sides + j2, (i + 1) * sides + j
            faces.append([a, b, c])
            faces.append([a, c, d])
    if cap:
        c0 = len(verts)
        verts = np.vstack([verts, path[0]])
        c1 = len(verts)
        verts = np.vstack([verts, path[-1]])
        for j in range(sides):
            j2 = (j + 1) % sides
            faces.append([c0, j2, j])                    # start cap
            faces.append([c1, (n - 1) * sides + j,
                          (n - 1) * sides + j2])         # end cap
    m = trimesh.Trimesh(verts, faces, process=False)
    return m


def lathe(profile, sides=16):
    """Revolve a 2D profile [(r, y), ...] around the Y axis."""
    profile = np.asarray(profile, dtype=float)
    a = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    ca, sa = np.cos(a), np.sin(a)
    verts = np.column_stack([profile[:, 0][:, None] * ca,
                             profile[:, 1][:, None] * np.ones_like(ca),
                             profile[:, 0][:, None] * sa]).reshape(-1, 3)
    n = len(profile)
    faces = []
    for i in range(n - 1):
        for j in range(sides):
            j2 = (j + 1) % sides
            faces.append([i * sides + j, i * sides + j2,
                          (i + 1) * sides + j2])
            faces.append([i * sides + j, (i + 1) * sides + j2,
                          (i + 1) * sides + j])
    return trimesh.Trimesh(verts, faces, process=False)


def torus(major, minor, sides=24, minor_sides=10):
    prof = [(major + minor * np.cos(t), minor * np.sin(t))
            for t in np.linspace(0, 2 * np.pi, minor_sides, endpoint=False)]
    return lathe(prof, sides)


def sphere(r, pos, subdiv=2, scale=(1, 1, 1)):
    m = trimesh.creation.icosphere(subdivisions=subdiv, radius=r)
    m.apply_scale(scale)
    m.apply_translation(pos)
    return m


def bicone(r, h, pos, sides=12):
    m = lathe([(0.0, h / 2), (r, 0.0), (0.0, -h / 2)], sides)
    m.apply_translation(pos)
    return m


def place(mesh, pos=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
    """Rotate (radians, XYZ order) then translate."""
    if scale != 1.0:
        mesh.apply_scale(scale)
    if any(rot):
        mesh.apply_transform(trimesh.transformations.rotation_matrix(
            rot[0], [1, 0, 0]))
        mesh.apply_transform(trimesh.transformations.rotation_matrix(
            rot[1], [0, 1, 0]))
        mesh.apply_transform(trimesh.transformations.rotation_matrix(
            rot[2], [0, 0, 1]))
    mesh.apply_translation(pos)
    return mesh


def arc_path(r, y, a0=-ARC, a1=ARC, n=36):
    th = np.linspace(a0, a1, n)
    return np.column_stack([r * np.sin(th), np.full_like(th, y),
                            r * np.cos(th)])


def add(mesh):
    PARTS.append(mesh)
    return mesh


def beads_along(points, bead_r=2.2, spacing=5.4, bicone_every=2,
                bicone_r=3.0, bicone_h=4.6, taper=0.92):
    """Place beads along a polyline by arc length. Returns end point."""
    pts = [np.asarray(p, float) for p in points]
    segs = [pts[i + 1] - pts[i] for i in range(len(pts) - 1)]
    lens = [np.linalg.norm(s) for s in segs]
    total = sum(lens)
    n_beads = max(2, int(total / spacing))
    dists = np.linspace(0, total, n_beads + 2)[1:-1]
    d = 0.0
    si = 0
    for k, target in enumerate(dists):
        while si < len(lens) - 1 and d + lens[si] < target:
            d += lens[si]
            si += 1
        t = (target - d) / (lens[si] + 1e-12)
        p = pts[si] + segs[si] * t
        shrink = taper ** (target / total * 3)
        if k % bicone_every == 1:
            add(bicone(bicone_r * shrink, bicone_h * shrink, p))
        else:
            add(sphere(bead_r * shrink, p, subdiv=1))
    return pts[-1]


def bezier(p0, p1, p2, n=24):
    p0, p1, p2 = map(np.asarray, (p0, p1, p2))
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t ** 2 * p2


# ------------------------------------------------------------- 1. band --
def build_band():
    # main band: profile x -> vertical (26), y -> radial (9)
    prof = Polygon([(-13, -4.5), (13, -4.5), (13, 4.5), (-13, 4.5)])
    add(trimesh.creation.sweep_polygon(prof, arc_path(R, 0)))
    # top & bottom rims
    rim_prof = Point(0, 0).buffer(2.1, resolution=16)
    add(trimesh.creation.sweep_polygon(rim_prof, arc_path(R, 12.6, n=40)))
    add(trimesh.creation.sweep_polygon(rim_prof, arc_path(R, -12.6, n=40)))
    # beaded top edge
    for a in np.linspace(-100, 100, 23):
        ar = np.radians(a)
        add(sphere(2.7, (R * np.sin(ar), 14.2, R * np.cos(ar)), subdiv=1))


# ------------------------------------------------- 2. openwork panels --
def build_panels():
    specs = [
        (38, "phoenix", 0.72),
        (-38, "phoenix", 0.72),
        (78, "dragon", 0.60),
        (-78, "dragon", 0.60),
    ]
    for theta_deg, kind, sc in specs:
        th = np.radians(theta_deg)
        sil = {"phoenix": phoenix(), "dragon": dragon()}[kind]
        sil = affinity.scale(sil, sc, sc, origin=(0, 0))
        panel = panel_with_openwork(48, 26, 6, [sil],
                                    extra_holes=[(-19, 9, 2.0), (19, 9, 2.0),
                                                 (-19, -9, 2.0), (19, -9, 2.0)])
        m = trimesh.creation.extrude_polygon(panel, 2.2)
        # panel local: x right, y up, z thickness. Centre on band outer face.
        m.apply_translation((0, 0, -1.1))
        # standoffs
        for dx, dy in [(-18, 8), (18, 8), (-18, -8), (18, -8)]:
            so = loft([(0, 0, 0), (0, 0, 5.0)], [2.0, 2.0], sides=8)
            place(so, (dx, dy, -5.0))
            add(so)
        place(m, (R * np.sin(th), 0, R * np.cos(th)), rot=(0, th, 0))
        add(m)


# ------------------------------------------------------- 3. dragon head --
def build_dragon_head(theta_deg):
    th = np.radians(theta_deg)
    base = np.array([R * np.sin(th), 14.0, R * np.cos(th)])
    parts = []
    # skull & snout & jaw
    parts.append(sphere(8, (0, 2, 0), scale=(1.0, 0.85, 1.15)))
    parts.append(loft([(0, 0.5, 6), (0, 0, 12), (0, -0.5, 16)],
                      [4.5, 3.6, 2.6]))
    parts.append(loft([(0, -2.5, 5), (0, -3.5, 11), (0, -3.8, 14)],
                      [2.2, 1.8, 1.2]))
    # nose horn
    parts.append(loft([(0, 2.5, 7), (0, 5, 10)], [1.6, 0.3], sides=8))
    # eyes
    for s in (-1, 1):
        parts.append(sphere(2.1, (s * 4.4, 3.4, 5.2), subdiv=1))
        # brow horns sweeping back-up
        parts.append(loft([(s * 3, 6, 2), (s * 5, 10, -2), (s * 6, 13, -6)],
                          [1.8, 1.2, 0.25], sides=8))
        # whiskers
        parts.append(loft([(s * 3, -1, 8), (s * 7, -2, 14), (s * 9, -4, 18)],
                          [0.7, 0.4, 0.15], sides=6))
    # mane: fan of beads behind skull
    for k in range(7):
        a = np.radians(-60 + k * 20)
        parts.append(sphere(2.4 - abs(k - 3) * 0.3,
                            (-np.cos(a) * 7.5, 2 + np.sin(a) * 7.5, -5.5),
                            subdiv=1))
    # chin bead
    parts.append(sphere(2.6, (0, -4.5, 10), subdiv=1))
    for p in parts:
        place(p, base, rot=(np.radians(-18), th, 0), scale=1.2)
        add(p)


# -------------------------------------------- 4. central lotus & pearl --
def build_central():
    base = np.array([0.0, 13.0, R])
    parts = []
    # lotus petals
    for k in range(8):
        a = np.radians(k * 45)
        pet = sphere(4.2, (0, 0, 0), scale=(1.0, 1.9, 0.55))
        place(pet, (np.cos(a) * 6.5, 1.5, np.sin(a) * 6.5),
              rot=(np.radians(28), -a + np.pi / 2, 0))
        parts.append(pet)
    parts.append(sphere(5.0, (0, 2.5, 0)))
    # stem
    parts.append(loft([(0, 5, 0), (0, 17, 0)], [2.3, 1.8], sides=10))
    # pearl
    parts.append(sphere(7.0, (0, 25, 0)))
    # flame ring around pearl
    for k in range(6):
        a = np.radians(k * 60 + 30)
        d = np.array([np.cos(a), 0, np.sin(a)])
        fl = loft([tuple(d * 5.5 + np.array([0, 23, 0])),
                   tuple(d * 8.5 + np.array([0, 27, 0])),
                   tuple(d * 10.0 + np.array([0, 32, 0]))],
                  [1.3, 0.9, 0.2], sides=6)
        parts.append(fl)
    # finial
    parts.append(loft([(0, 31, 0), (0, 39, 0)], [2.2, 0.4], sides=10))
    parts.append(sphere(1.7, (0, 40, 0), subdiv=1))
    for p in parts:
        place(p, base)
        add(p)


# ------------------------------------------------------ 5. front pendant --
def build_front_pendant():
    z = R
    # ring
    ring = torus(4.5, 1.3)
    place(ring, (0, -15, z))
    add(ring)
    # connector beads
    for i in range(3):
        add(sphere(2.2, (0, -19 - i * 4.5, z), subdiv=1))
    # phoenix plaque (solid silhouette)
    sil = affinity.scale(phoenix(), 0.42, 0.42, origin=(0, 0))
    plaque = trimesh.creation.extrude_polygon(sil, 2.0)
    place(plaque, (0, -34, z - 1.0))
    add(plaque)
    # dangles
    for dx in (-5, 0, 5):
        pts = bezier((dx * 0.6, -44, z), (dx, -50, z + 1), (dx * 1.2, -56, z))
        beads_along(pts, bead_r=1.9, spacing=4.6, bicone_every=2,
                    bicone_r=2.4, bicone_h=3.6)
        td = trimesh.creation.extrude_polygon(teardrop(), 1.6)
        place(td, (dx * 1.2, -59, z - 0.8))
        add(td)


# ------------------------------------------------------- 6. side tassels --
def build_side_tassels(theta_deg):
    th = np.radians(theta_deg)
    out = np.array([np.sin(th), 0, np.cos(th)])       # radial (outward)
    tan = np.array([np.cos(th), 0, -np.sin(th)])      # along band
    M = np.array([R * np.sin(th), -4.0, R * np.cos(th)])
    for i in range(-2, 3):
        start = M + tan * (i * 7) + out * 2
        end = M + tan * (i * 16) + out * (10 + abs(i) * 2) + np.array([0, -(95 + abs(i) * 8), 0])
        ctrl = (start + end) / 2 + out * 6
        pts = bezier(start, ctrl, end, n=30)
        beads_along(pts, bead_r=2.3, spacing=5.6, bicone_every=2,
                    bicone_r=3.1, bicone_h=4.8)
        # plaque on the two outer strands
        if abs(i) == 2:
            p0, p1, p2 = np.asarray(start), np.asarray(ctrl), np.asarray(end)
            mid = 0.35 * p0 + 0.45 * p1 + 0.20 * p2
            sil = affinity.scale(phoenix(), 0.30, 0.30, origin=(0, 0))
            plaque = trimesh.creation.extrude_polygon(sil, 1.8)
            place(plaque, mid + out * 0.9, rot=(0, th, 0))
            add(plaque)
            for dx in (-3, 0, 3):
                dpts = bezier(mid + np.array([dx * 0.5, -6, 0]),
                              mid + np.array([dx, -11, 1]),
                              mid + np.array([dx * 1.2, -15, 0]), n=12)
                beads_along(dpts, bead_r=1.7, spacing=4.2, bicone_every=2,
                            bicone_r=2.1, bicone_h=3.2)
        # end teardrop
        td = trimesh.creation.extrude_polygon(teardrop(), 1.6)
        place(td, end + np.array([0, -4.5, 0]), rot=(0, th, 0))
        add(td)
        add(sphere(2.0, end + out * 1.5, subdiv=1))


# --------------------------------------------------------- 7. back tassel --
def build_back_tassels():
    for dx in (-7, 7):
        start = np.array([dx, -6, -R])
        end = np.array([dx * 1.5, -102, -R - 6])
        ctrl = np.array([dx * 1.3, -55, -R - 10])
        pts = bezier(start, ctrl, end, n=30)
        beads_along(pts, bead_r=2.3, spacing=5.6, bicone_every=2,
                    bicone_r=3.1, bicone_h=4.8)
        td = trimesh.creation.extrude_polygon(teardrop(), 1.6)
        place(td, end + np.array([0, -4.5, 0]))
        add(td)


# ----------------------------------------------------------------- main --
def main():
    build_band()
    build_panels()
    build_dragon_head(55)
    build_dragon_head(-55)
    build_central()
    build_front_pendant()
    build_side_tassels(88)
    build_side_tassels(-88)
    build_back_tassels()

    scene = trimesh.util.concatenate(PARTS)
    scene.remove_unreferenced_vertices()
    scene.export("phoenix_crown.stl")
    scene.export("phoenix_crown.obj")
    lo, hi = scene.bounds[0], scene.bounds[1]
    print(f"parts: {len(PARTS)}")
    print(f"vertices: {len(scene.vertices)}, faces: {len(scene.faces)}")
    print(f"bounds: x[{lo[0]:.1f},{hi[0]:.1f}] y[{lo[1]:.1f},{hi[1]:.1f}] "
          f"z[{lo[2]:.1f},{hi[2]:.1f}]")
    print(f"watertight shells: {len(scene.split(only_watertight=False))}")
    import os
    print(f"STL size: {os.path.getsize('phoenix_crown.stl')/1e6:.2f} MB")


if __name__ == "__main__":
    main()
