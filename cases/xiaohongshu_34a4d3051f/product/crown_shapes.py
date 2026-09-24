"""2D silhouette shapes for the phoenix crown (龙凤镂空纹饰).

All shapes are shapely Polygons in the XY plane, facing +X.
Units are millimetres. Used both as openwork holes (in panels) and as
solid plaques (pendants).
"""
import numpy as np
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import unary_union
from shapely import affinity


def catmull_rom(pts, n=10):
    """Smooth a closed/open control polygon into a dense polyline."""
    P = np.asarray(pts, dtype=float)
    ext = np.vstack([P[0], P, P[-1]])
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t
                              + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(ext[-2])
    return np.array(out)


def smooth_outline(pts, n=10):
    return Polygon(catmull_rom(pts, n))


def capsule(p0, p1, r):
    return LineString([p0, p1]).buffer(r, cap_style=1, join_style=1)


def ellipse(cx, cy, rx, ry, rot_deg=0.0, n=48):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False)
    x = rx * np.cos(t)
    y = ry * np.sin(t)
    p = Polygon(np.column_stack([x, y]))
    if rot_deg:
        p = affinity.rotate(p, rot_deg, origin=(0, 0))
    return affinity.translate(p, cx, cy)


def feather(spine_pts, w0, w1, n=10):
    """Tapered leaf/feather shape around a spine (widths are half-widths)."""
    spine = catmull_rom(spine_pts, n)
    left, right = [], []
    m = len(spine)
    for i, p in enumerate(spine):
        if i == 0:
            d = spine[1] - spine[0]
        elif i == m - 1:
            d = spine[-1] - spine[-2]
        else:
            d = spine[i + 1] - spine[i - 1]
        d = d / (np.linalg.norm(d) + 1e-9)
        nrm = np.array([-d[1], d[0]])
        w = w0 + (w1 - w0) * (i / (m - 1))
        left.append(p + nrm * w)
        right.append(p - nrm * w)
    return Polygon(np.vstack([left, right[::-1]]))


def tri(p0, p1, p2):
    return Polygon([p0, p1, p2])


# ---------------------------------------------------------------- phoenix --
def phoenix():
    """Stylised phoenix (凤) facing +X. Bounds ~ x[-21,18] y[-16,15]."""
    parts = []
    # body & neck & head
    parts.append(ellipse(0.3, -0.3, 4.6, 3.0, rot_deg=-12))
    parts.append(capsule((3.0, 1.8), (8.8, 6.3), 2.1))
    parts.append(ellipse(10.5, 6.8, 2.7, 2.7))
    # beak
    parts.append(tri((12.6, 7.8), (17.0, 6.2), (12.4, 5.4)))
    # crest feathers sweeping back
    parts.append(feather([(9.0, 9.2), (5.5, 12.5), (1.5, 13.8)], 1.4, 0.25))
    parts.append(feather([(10.5, 9.6), (8.5, 13.8), (5.0, 15.0)], 1.1, 0.25))
    parts.append(feather([(7.5, 9.0), (4.0, 11.5), (1.0, 12.0)], 0.9, 0.25))
    # raised wing with scalloped trailing edge (lifted clear of the body)
    parts.append(smooth_outline(
        [(-2.5, 1.5), (0.5, 5.5), (3.5, 8.5), (7.0, 9.8), (8.2, 8.6),
         (5.2, 6.8), (6.6, 6.0), (3.8, 4.8), (5.0, 3.4), (2.0, 2.4),
         (2.4, 1.2), (-0.5, 1.2)], n=8))
    # flowing tail feathers (wide, curved)
    parts.append(feather([(-4.0, -1.0), (-11.0, -2.5), (-17.0, -1.5), (-20.5, -4.5)],
                         2.6, 0.5))
    parts.append(feather([(-4.5, -2.5), (-12.0, -6.0), (-18.0, -6.5), (-21.5, -10.0)],
                         2.8, 0.5))
    parts.append(feather([(-4.0, -3.0), (-10.0, -9.5), (-14.5, -13.0), (-16.5, -16.0)],
                         2.4, 0.5))
    return unary_union(parts)


# ----------------------------------------------------------------- dragon --
def dragon():
    """Stylised dragon (龙) facing +X. Bounds ~ x[-23,26] y[-14,15]."""
    parts = []
    # serpentine body (strong S-curve)
    parts.append(capsule((-16.0, -6.0), (8.0, 3.0), 3.0))
    # neck
    parts.append(capsule((6.0, 2.0), (12.0, 6.5), 2.5))
    # head & snout
    parts.append(ellipse(13.5, 6.8, 3.0, 3.0))
    parts.append(Polygon([(11.5, 4.8), (18.0, 3.6), (19.5, 5.4),
                          (18.0, 7.0), (11.5, 7.6)]))
    # lower jaw
    parts.append(tri((12.0, 4.6), (16.0, 3.4), (14.5, 5.4)))
    # antler horns
    parts.append(tri((12.0, 9.0), (8.5, 14.5), (13.5, 9.8)))
    parts.append(tri((9.8, 12.0), (7.0, 13.8), (10.5, 12.8)))
    parts.append(tri((14.5, 9.5), (14.0, 15.0), (16.5, 9.2)))
    # brow ridge
    parts.append(tri((12.5, 8.6), (15.0, 9.6), (13.8, 7.6)))
    # dorsal spikes along the S
    for x, y in [(-13.0, -7.0), (-8.0, -8.5), (-3.0, -6.0), (2.0, -2.5), (6.0, 0.5)]:
        parts.append(tri((x - 1.6, y), (x + 1.6, y), (x, y + 3.2)))
    # legs & claws
    parts.append(capsule((-8.0, -8.5), (-9.5, -11.5), 1.2))
    parts.append(tri((-11.0, -11.5), (-8.0, -11.5), (-9.5, -14.0)))
    parts.append(capsule((4.0, -2.0), (3.0, -6.0), 1.2))
    parts.append(tri((1.5, -6.0), (4.5, -6.0), (3.0, -8.5)))
    # whiskers
    parts.append(feather([(19.0, 5.2), (23.0, 6.8), (26.5, 5.8)], 0.8, 0.2))
    parts.append(feather([(18.5, 4.0), (22.5, 3.0), (25.5, 1.5)], 0.7, 0.2))
    # flame tail
    parts.append(feather([(-16.0, -6.0), (-20.5, -8.5), (-23.0, -12.0), (-22.5, -15.5)],
                         2.6, 0.4))
    parts.append(feather([(-15.5, -6.5), (-19.0, -9.5), (-20.5, -12.5)],
                         1.8, 0.4))
    return unary_union(parts)


# ----------------------------------------------------------------- small --
def teardrop():
    """Water-drop pendant shape, pointing down. ~7 wide, 11 tall."""
    return feather([(0.0, 5.0), (0.0, 0.0), (0.0, -5.0)], 3.2, 0.4, n=6)


def rounded_rect(w, h, r, n=6):
    """Rounded rectangle centred at origin."""
    pts = []
    for cx, cy, a0 in [(w / 2 - r, h / 2 - r, 0),
                       (-w / 2 + r, h / 2 - r, 90),
                       (-w / 2 + r, -h / 2 + r, 180),
                       (w / 2 - r, -h / 2 + r, 270)]:
        for a in np.linspace(a0, a0 + 90, n + 1)[:-1]:
            pts.append((cx + r * np.cos(np.radians(a)),
                        cy + r * np.sin(np.radians(a))))
    return Polygon(pts)


def _flatten_polygons(shape):
    """Yield individual Polygons from a (Multi)Polygon."""
    if shape.geom_type == "Polygon":
        yield shape
    elif shape.geom_type == "MultiPolygon":
        for p in shape.geoms:
            yield p


def panel_with_openwork(w, h, corner_r, silhouettes, extra_holes=()):
    """Panel polygon with silhouette holes cut out (true openwork)."""
    exterior = rounded_rect(w, h, corner_r)
    holes = []
    for s in silhouettes:
        holes.extend(_flatten_polygons(s))
    for x, y, r in extra_holes:
        holes.append(Point((x, y)).buffer(r, resolution=24))
    return Polygon(exterior.exterior.coords, [h.exterior.coords for h in holes])
