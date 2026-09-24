/* ========== 地图投影与 GeoJSON -> SVG 工具 ========== */

const GeoUtil = {
  /* 中国范围（陆域主体，不含南海诸岛） */
  BOUNDS: { lonMin: 73.5, lonMax: 135.0, latMin: 17.5, latMax: 53.8 },

  /* 简易等距圆柱投影：经度按 cos(35°) 压缩，使版图形状接近标准中国地图 */
  project(lon, lat) {
    const b = this.BOUNDS;
    const kx = 1000 / (b.lonMax - b.lonMin);
    const ky = kx; // 纬度方向同比例
    const x = (lon - b.lonMin) * kx * 0.82;
    const y = (b.latMax - lat) * ky;
    return [x, y];
  },

  /* 反投影（用于 3D 场景定位） */
  unproject(x, y) {
    const b = this.BOUNDS;
    const kx = 1000 / (b.lonMax - b.lonMin);
    const lon = x / (kx * 0.82) + b.lonMin;
    const lat = b.latMax - y / kx;
    return [lon, lat];
  },

  /* 计算投影后的实际包围盒 */
  projectedBounds() {
    const b = this.BOUNDS;
    const [x1, y1] = this.project(b.lonMin, b.latMax);
    const [x2, y2] = this.project(b.lonMax, b.latMin);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  },

  /* 将 GeoJSON 坐标环转为 SVG path 字符串（自动剔除 17.5°N 以南的南海诸岛碎斑） */
  ringToPath(ring) {
    let d = "";
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = this.project(ring[i][0], ring[i][1]);
      d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
    }
    return d + "Z";
  },

  /* 判断一个多边形是否整体位于南海区域（用于剔除） */
  isSouthSeaPolygon(poly) {
    let southCount = 0;
    for (const c of poly) {
      if (c[1] < 17.5) southCount++;
    }
    return southCount === poly.length;
  },

  /* 提取某省（按 adcode）的边界环集合 */
  extractProvince(geo, adcode) {
    for (const f of geo.features) {
      if (String(f.properties.adcode) === String(adcode)) {
        return this.polygonsOf(f.geometry);
      }
    }
    return [];
  },

  /* 提取某省边界中面积最大的多边形（主陆块） */
  mainPolygon(geo, adcode) {
    const polys = this.extractProvince(geo, adcode);
    let best = null, bestArea = -1;
    for (const poly of polys) {
      const a = Math.abs(this.ringArea(poly));
      if (a > bestArea) { bestArea = a; best = poly; }
    }
    return best;
  },

  polygonsOf(geometry) {
    const out = [];
    if (geometry.type === "Polygon") {
      for (const ring of geometry.coordinates) out.push(ring);
    } else if (geometry.type === "MultiPolygon") {
      for (const poly of geometry.coordinates) {
        for (const ring of poly) out.push(ring);
      }
    }
    return out;
  },

  ringArea(ring) {
    let a = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    return a / 2;
  },

  /* 生成全国省份 SVG path 列表（剔除南海碎斑） */
  buildProvincePaths(geo) {
    const paths = [];
    for (const f of geo.features) {
      const polys = this.polygonsOf(f.geometry);
      const keep = polys.filter(p => !this.isSouthSeaPolygon(p));
      if (keep.length === 0) continue;
      let d = "";
      for (const ring of keep) d += this.ringToPath(ring);
      paths.push({ adcode: f.properties.adcode, name: f.properties.name, d: d });
    }
    return paths;
  }
};
