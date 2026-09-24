#!/usr/bin/env python3
"""Simplify China provinces GeoJSON -> compact JS for embedding."""
import json, math, sys

SRC = "tools/china_full.json"
OUT = "js/china-geo.js"

KEEP_TINY = {"香港特别行政区", "澳门特别行政区", "台湾省", "海南省"}

def ring_area(ring):
    a = 0.0
    n = len(ring)
    for i in range(n - 1):
        x1, y1 = ring[i][:2]
        x2, y2 = ring[i + 1][:2]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0

def dp(points, eps):
    """Douglas-Peucker on [[x,y],...] closed ring (first==last)."""
    if len(points) <= 4:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        ax, ay = points[i][:2]
        bx, by = points[j][:2]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy)
        dmax, idx = -1.0, -1
        for k in range(i + 1, j):
            px, py = points[k][:2]
            if L < 1e-12:
                d = math.hypot(px - ax, py - ay)
            else:
                d = abs(dy * px - dx * py + bx * ay - by * ax) / L
            if d > dmax:
                dmax, idx = d, k
        if dmax > eps:
            keep[idx] = True
            stack.append((i, idx))
            stack.append((idx, j))
    return [p for p, k in zip(points, keep) if k]

def simplify_ring(ring, eps, min_area):
    if ring_area(ring) < min_area:
        return None
    pts = dp(ring[:-1] if ring[0] == ring[-1] else ring, eps)
    if len(pts) < 3:
        return None
    pts.append(pts[0])
    # quantize to 2 decimals
    return [[round(x, 2), round(y, 2)] for x, y in pts]

def main():
    d = json.load(open(SRC))
    feats = []
    for f in d["features"]:
        name = f["properties"].get("name", "")
        geom = f["geometry"]
        polys = []
        if geom["type"] == "Polygon":
            polys = [geom["coordinates"]]
        elif geom["type"] == "MultiPolygon":
            polys = geom["coordinates"]
        elif geom["type"] == "LineString":
            ln = simplify_ring(geom["coordinates"], 0.05, -1)
            if ln:
                feats.append({"name": name or "界线", "lines": [ln]})
            continue
        out_polys = []
        for poly in polys:
            rings = []
            for ring in poly:
                r = simplify_ring(ring, 0.09, 0.004 if name not in KEEP_TINY else 0.0004)
                if r:
                    rings.append(r)
            if rings:
                out_polys.append(rings)
        if out_polys or name in KEEP_TINY:
            if not out_polys:
                # fallback: keep un-simplified outer ring for tiny provinces
                for poly in polys:
                    if poly:
                        out_polys.append([poly[0]])
            feats.append({"name": name, "polys": out_polys})
    # stats
    total_pts = 0
    for f in feats:
        if "polys" in f:
            for rings in f["polys"]:
                for r in rings:
                    total_pts += len(r)
        else:
            for l in f["lines"]:
                total_pts += len(l)
    js = "window.CHINA_GEO = " + json.dumps({"provinces": feats}, separators=(",", ":")) + ";\n"
    open(OUT, "w").write(js)
    print(f"provinces={len(feats)} total_points={total_pts} size={len(js)/1024:.1f}KB")

if __name__ == "__main__":
    main()
