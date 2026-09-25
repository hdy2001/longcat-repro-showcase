// ============================================================
// 中式大屋顶程序化几何：庑殿顶 / 歇山顶 / 攒尖顶 / 重檐裙边
// 曲线屋面 + 檐角起翘 + 金色轮廓折线（供灯带使用）
// ============================================================
import * as THREE from 'three';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---- 庑殿顶（四坡五脊） ----
// W: 面宽(x)  D: 进深(z)  eaveY: 檐口标高  ridgeY: 脊标高  ridgeHalf: 正脊半长
export function hipRoofGeo(W, D, eaveY, ridgeY, ridgeHalf, o = {}) {
  const lift = o.lift ?? 2.2, up = o.upturn ?? 1.5, pw = o.curve ?? 0.62;
  const su = o.segU ?? 10, sv = o.segV ?? 8;
  const pos = [], idx = [];
  let base = 0;
  for (const side of [1, -1]) {
    for (let i = 0; i <= su; i++) {
      const u = -1 + (2 * i) / su;
      for (let j = 0; j <= sv; j++) {
        const t = j / sv;
        const x = u * lerp(ridgeHalf, W / 2, t);
        const z = side * lerp(0.0001, D / 2, t);
        let y = ridgeY + (eaveY - ridgeY) * Math.pow(t, pw);
        y += up * smooth(0.7, 1, t) * Math.pow(Math.abs(u), 1.7);
        y += lift * Math.pow(Math.abs(u), 3.2) * Math.pow(t, 4);
        pos.push(x, y, z);
      }
    }
    for (let i = 0; i < su; i++) for (let j = 0; j < sv; j++) {
      const a = base + i * (sv + 1) + j, b = a + sv + 1;
      if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    base += (su + 1) * (sv + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---- 攒尖顶（四角/圆形），square=true 为四边抹角 ----
export function pyramidGeo(R, eaveY, apexY, o = {}) {
  const segs = o.segs ?? 12, tsegs = o.tsegs ?? 8;
  const lift = o.lift ?? 1.8, up = o.upturn ?? 1.2, pw = o.curve ?? 0.65, n = o.square ? 3.2 : 2;
  const pos = [], idx = [];
  for (let i = 0; i < segs; i++) {
    const th = (i / segs) * Math.PI * 2;
    const c = Math.cos(th), s = Math.sin(th);
    const nx = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const nz = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    for (let j = 0; j <= tsegs; j++) {
      const t = j / tsegs;
      const r = Math.pow(t, 0.85) * R;
      const corner = Math.pow(Math.abs(sinAt(segs, th)), 1.6);
      let y = apexY + (eaveY - apexY) * Math.pow(t, pw);
      y += up * smooth(0.7, 1, t) * corner;
      y += lift * corner * Math.pow(t, 3);
      pos.push(r * nx, y, r * nz);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < tsegs; j++) {
    const a = i * (tsegs + 1) + j, b = ((i + 1) % segs) * (tsegs + 1) + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function sinAt(segs, th) { return Math.sin((th * segs) / 2); }

// ---- 歇山顶 = 上部庑殿(短脊) + 两端山花三角 + 下檐裙边 ----
export function xieshanRoofGeo(W, D, eaveY, ridgeY, o = {}) {
  const ridgeHalf = o.ridgeHalf ?? W * 0.3;
  const geos = [];
  geos.push(hipRoofGeo(W, D, eaveY, ridgeY, ridgeHalf, o));
  // 山花（两端红色三角堵头，带金色描边由外部灯带负责）
  const gD = D * 0.58;
  for (const side of [1, -1]) {
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute([
      side * ridgeHalf, ridgeY, 0,
      side * ridgeHalf, eaveY, -gD / 2,
      side * ridgeHalf, eaveY, gD / 2,
    ], 3));
    gg.setIndex([side > 0 ? 0 : 1, side > 0 ? 1 : 0, 2]);
    gg.computeVertexNormals();
    geos.push(gg);
  }
  // 下檐裙边
  geos.push(skirtGeo(W + 1.5, D + 1.5, eaveY + 0.6, eaveY - (o.skirtDrop ?? 3.2), o.skirtFlare ?? 2.6, o));
  return mergeGeos(geos);
}

// ---- 重檐下檐裙边（环形外撇） ----
export function skirtGeo(W, D, yTop, yBot, flare = 2.6, o = {}) {
  const su = 10, sv = 4, pw = o.curve ?? 0.7;
  const pos = [], idx = [];
  let base = 0;
  for (const side of [1, -1]) {
    for (let i = 0; i <= su; i++) {
      const u = -1 + (2 * i) / su;
      for (let j = 0; j <= sv; j++) {
        const t = j / sv;
        const x = u * (W / 2 + flare * t);
        const z = side * (D / 2 + flare * t);
        let y = lerp(yTop, yBot, Math.pow(t, pw));
        y += (o.upturn ?? 1.0) * smooth(0.6, 1, t) * Math.pow(Math.abs(u), 1.6);
        pos.push(x, y, z);
      }
    }
    for (let i = 0; i < su; i++) for (let j = 0; j < sv; j++) {
      const a = base + i * (sv + 1) + j, b = a + sv + 1;
      if (side > 0) idx.push(a, a + 1, b, b, a + 1, b + 1);
      else idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    base += (su + 1) * (sv + 1);
  }
  // 两侧山面
  for (const side of [1, -1]) {
    for (let i = 0; i <= su; i++) {
      const u = -1 + (2 * i) / su;
      for (let j = 0; j <= sv; j++) {
        const t = j / sv;
        const x = side * (W / 2 + flare * t);
        const z = u * (D / 2 + flare * t);
        let y = lerp(yTop, yBot, Math.pow(t, pw));
        y += (o.upturn ?? 1.0) * smooth(0.6, 1, t) * Math.pow(Math.abs(u), 1.6);
        pos.push(x, y, z);
      }
    }
    for (let i = 0; i < su; i++) for (let j = 0; j < sv; j++) {
      const a = base + i * (sv + 1) + j, b = a + sv + 1;
      if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    base += (su + 1) * (sv + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---- 金色轮廓折线（檐口/脊/垂脊），供 buildings 生成灯带 ----
export function roofTrims(W, D, eaveY, ridgeY, ridgeHalf, o = {}) {
  const lift = o.lift ?? 2.2, up = o.upturn ?? 1.5;
  const lines = [];
  // 前后檐口（5段折线带起翘）
  for (const side of [1, -1]) {
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const u = -1 + (2 * k) / 4;
      const x = u * W / 2;
      const z = side * D / 2;
      let y = eaveY + up * smooth(0.7, 1, 1) * Math.pow(Math.abs(u), 1.7) + lift * Math.pow(Math.abs(u), 3.2);
      pts.push(new THREE.Vector3(x, y, z));
    }
    lines.push(pts);
  }
  // 两侧檐口
  for (const side of [1, -1]) {
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const u = -1 + (2 * k) / 4;
      const x = side * W / 2;
      const z = u * D / 2;
      let y = eaveY + up * Math.pow(Math.abs(u), 1.7) + lift * Math.pow(Math.abs(u), 3.2);
      pts.push(new THREE.Vector3(x, y, z));
    }
    lines.push(pts);
  }
  // 四条垂脊（脊端→檐角，微弯）
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const a = new THREE.Vector3(sx * ridgeHalf, ridgeY, 0);
    const b = new THREE.Vector3(sx * W / 2, eaveY + lift + up, sz * D / 2);
    const mid = a.clone().lerp(b, 0.5); mid.y += 0.9;
    lines.push([a, mid, b]);
  }
  // 正脊
  if (ridgeHalf > 0.5) lines.push([new THREE.Vector3(-ridgeHalf, ridgeY, 0), new THREE.Vector3(ridgeHalf, ridgeY, 0)]);
  return lines;
}

// ---- 攒尖顶轮廓（檐口 + 宝顶线） ----
export function pyramidTrims(R, eaveY, apexY, o = {}) {
  const segs = o.segs ?? 12, n = o.square ? 3.2 : 2, lift = o.lift ?? 1.8, up = o.upturn ?? 1.2;
  const pts = [];
  for (let k = 0; k < segs; k++) {
    const th = (k / segs) * Math.PI * 2;
    const c = Math.cos(th), s = Math.sin(th);
    const nx = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const nz = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    const corner = Math.pow(Math.abs(sinAt(segs, th)), 1.6);
    pts.push(new THREE.Vector3(R * nx, eaveY + up * corner + lift * corner, R * nz));
  }
  return [pts];
}

function mergeGeos(geos) {
  // 简易 merge（非索引化后拼接，保留索引几何统一处理）
  const pos = [], norm = [], idx = [];
  let base = 0;
  for (const g of geos) {
    const gg = g.index ? g.toNonIndexed() : g;
    const p = gg.attributes.position.array, nr = gg.attributes.normal.array;
    for (let i = 0; i < p.length; i++) pos.push(p[i]);
    for (let i = 0; i < nr.length; i++) norm.push(nr[i]);
    base = pos.length / 3;
    void base;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  return geo;
}
