/* ============================================================
   小西天（千佛庵）大雄宝殿 · 悬塑殿堂程序化三维复原
   依据殿内公开影像资料推演生成，非精密测绘数据
   three.js r128 (UMD) 内联于最终 HTML
   ============================================================ */
(function () {
'use strict';

/* ---------------- 渲染器 / 场景 / 相机 ---------------- */
var container = document.getElementById('scene');
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
container.appendChild(renderer.domElement);

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0705);
scene.fog = new THREE.FogExp2(0x0a0705, 0.010);

var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.08, 160);
camera.position.set(0, 3.0, 4.6);

var controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2.6, -3.0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 0.4;
controls.maxDistance = 8.2;
controls.maxPolarAngle = 2.45;
controls.autoRotate = true;
controls.autoRotateSpeed = -0.55;

/* ---------------- 调色板 ---------------- */
var C = {
  gold: 0xd8b25c, goldDim: 0x9a7a3a, goldDeep: 0x6e5426,
  red: 0x8e3030, redDark: 0x571f1f, crimson: 0xa03a3a,
  green: 0x2f5d50, greenTile: 0x2a6a5c, greenDark: 0x1c3830,
  wood: 0x3a2a1c, woodDark: 0x221811,
  pink: 0xc4758a, pinkLight: 0xdda0b0,
  wall: 0x1f1712, brick: 0x4a3a2c, white: 0xcfc4b0,
  celadon: 0x93a88e, blue: 0x5a6a8a, robePink: 0xc9a0a0
};

/* ---------------- 工具函数 ---------------- */
function mat(px, py, pz, sx, sy, sz, rx, ry, rz) {
  var m = new THREE.Matrix4();
  var q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
  m.compose(new THREE.Vector3(px, py, pz), q, new THREE.Vector3(sx || 1, sy || 1, sz || 1));
  return m;
}
function col(c) { return ((c >> 16) & 255) / 255 + ',' + ((c >> 8) & 255) / 255 + ',' + (c & 255) / 255; }

/* 将多个 {g, m, c} 图元合并为带顶点色的单个 BufferGeometry */
function mergeParts(parts) {
  var pos = [], nor = [], colA = [];
  var v = new THREE.Vector3(), n = new THREE.Vector3();
  var nm = new THREE.Matrix3();
  parts.forEach(function (p) {
    var g = p.g.index ? p.g.toNonIndexed() : p.g;
    var pa = g.attributes.position, na = g.attributes.normal;
    nm.getNormalMatrix(p.m);
    var r = ((p.c >> 16) & 255) / 255, gg = ((p.c >> 8) & 255) / 255, b = (p.c & 255) / 255;
    for (var i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(p.m);
      pos.push(v.x, v.y, v.z);
      n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
      nor.push(n.x, n.y, n.z);
      colA.push(r, gg, b);
    }
    if (g !== p.g) g.dispose();
    p.g.dispose();
  });
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
  return geo;
}
function P_box(w, h, d, x, y, z, c, rx, ry, rz) {
  return { g: new THREE.BoxGeometry(w, h, d), m: mat(x, y, z, 1, 1, 1, rx, ry, rz), c: c };
}
function P_cyl(rt, rb, h, x, y, z, c, seg, rx, ry, rz) {
  return { g: new THREE.CylinderGeometry(rt, rb, h, seg || 8), m: mat(x, y, z, 1, 1, 1, rx, ry, rz), c: c };
}
function P_sph(r, x, y, z, c, sx, sy, sz) {
  return { g: new THREE.IcosahedronGeometry(r, 0), m: mat(x, y, z, sx || 1, sy || 1, sz || 1), c: c };
}
function P_cone(r, h, x, y, z, c, seg, rx, ry, rz) {
  return { g: new THREE.ConeGeometry(r, h, seg || 8), m: mat(x, y, z, 1, 1, 1, rx, ry, rz), c: c };
}
function P_tor(r, t, x, y, z, c, rx, ry, rz) {
  return { g: new THREE.TorusGeometry(r, t, 5, 9), m: mat(x, y, z, 1, 1, 1, rx, ry, rz), c: c };
}
/* 两点之间的圆柱（手臂等） */
function P_limb(x1, y1, z1, x2, y2, z2, r, c) {
  var a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
  var dir = b.clone().sub(a), len = dir.length();
  var g = new THREE.CylinderGeometry(r, r * 0.85, len, 7);
  var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  var m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  return { g: g, m: m, c: c };
}

/* ---------------- 程序化贴图 ---------------- */
function canvasTex(w, h, draw, repX, repY) {
  var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  var tx = new THREE.CanvasTexture(cv);
  tx.encoding = THREE.sRGBEncoding;
  if (repX) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(repX, repY || 1); }
  return tx;
}
/* 佛龛拱门：金边红拱 + 幽暗内膛 */
var archTex = canvasTex(128, 128, function (g) {
  g.clearRect(0, 0, 128, 128);
  g.beginPath();
  g.moveTo(18, 116); g.lineTo(18, 52);
  g.quadraticCurveTo(18, 12, 64, 10);
  g.quadraticCurveTo(110, 12, 110, 52);
  g.lineTo(110, 116); g.closePath();
  var gr = g.createRadialGradient(64, 66, 6, 64, 66, 66);
  gr.addColorStop(0, '#120606'); gr.addColorStop(0.55, '#33100f'); gr.addColorStop(1, '#4d1a16');
  g.fillStyle = gr; g.fill();
  g.lineWidth = 7; g.strokeStyle = '#caa24f'; g.stroke();
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,222,150,0.85)';
  g.beginPath();
  g.moveTo(25, 116); g.lineTo(25, 54); g.quadraticCurveTo(25, 20, 64, 18);
  g.quadraticCurveTo(103, 20, 103, 54); g.lineTo(103, 116); g.stroke();
});
/* 蟠龙柱：绿地金纹 */
var dragonTex = canvasTex(128, 256, function (g) {
  g.fillStyle = '#2b574a'; g.fillRect(0, 0, 128, 256);
  var gr = g.createLinearGradient(0, 0, 128, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = '#caa24f'; g.fillStyle = '#caa24f'; g.lineWidth = 4.5; g.lineCap = 'round';
  for (var k = 0; k < 3; k++) {
    var y0 = 30 + k * 82;
    g.beginPath();
    g.moveTo(8, y0 + 46);
    g.bezierCurveTo(20, y0, 44, y0 + 6, 52, y0 + 26);
    g.bezierCurveTo(60, y0 + 46, 88, y0 + 44, 96, y0 + 22);
    g.bezierCurveTo(104, y0 + 2, 118, y0 + 6, 120, y0 + 24);
    g.stroke();
    g.beginPath(); g.arc(52, y0 + 26, 9, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(52, y0 + 26, 3.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(96, y0 + 22, 6.5, 0, Math.PI * 2); g.stroke();
  }
  g.fillStyle = '#a8823c';
  g.fillRect(0, 0, 128, 12); g.fillRect(0, 244, 128, 12);
}, 3, 1);
/* 地面青砖 */
var floorTex = canvasTex(256, 256, function (g) {
  g.fillStyle = '#221c16'; g.fillRect(0, 0, 256, 256);
  for (var r = 0; r < 4; r++) {
    for (var i = 0; i < 4; i++) {
      var off = (r % 2) * 32;
      var x = (i * 64 + off) % 256 - 32, y = r * 64;
      var v = 46 + Math.floor(Math.random() * 14);
      g.fillStyle = 'rgb(' + (v + 8) + ',' + (v) + ',' + (v - 12) + ')';
      g.fillRect(x + 2, y + 2, 60, 60);
    }
  }
}, 7, 6);
/* 背光头光火焰纹 */
var haloTex = canvasTex(256, 256, function (g) {
  g.clearRect(0, 0, 256, 256);
  g.translate(128, 128);
  for (var i = 0; i < 14; i++) {
    g.save(); g.rotate(i * Math.PI * 2 / 14);
    var gr = g.createLinearGradient(30, 0, 122, 0);
    gr.addColorStop(0, 'rgba(190,60,40,0.0)');
    gr.addColorStop(0.45, 'rgba(210,90,50,0.75)');
    gr.addColorStop(1, 'rgba(240,190,90,0.95)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(26, -9);
    g.quadraticCurveTo(70, -22, 118, 0);
    g.quadraticCurveTo(70, 22, 26, 9);
    g.closePath(); g.fill();
    g.restore();
  }
  g.strokeStyle = 'rgba(240,200,110,0.9)'; g.lineWidth = 5;
  g.beginPath(); g.arc(0, 0, 122, 0, Math.PI * 2); g.stroke();
});

/* ---------------- 材质 ---------------- */
var M = {
  stat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.06 }),
  gold: new THREE.MeshStandardMaterial({ color: C.gold, metalness: 0.88, roughness: 0.30, emissive: 0x1c1305 }),
  goldFlat: new THREE.MeshStandardMaterial({ color: C.gold, metalness: 0.75, roughness: 0.42, emissive: 0x140e04 }),
  buddha: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.62, roughness: 0.38, emissive: 0x191004 }),
  roof: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.25, roughness: 0.5 }),
  niche: new THREE.MeshBasicMaterial({ map: archTex, transparent: true }),
  wood: new THREE.MeshStandardMaterial({ color: C.wood, roughness: 0.9, metalness: 0.02 }),
  wall: new THREE.MeshStandardMaterial({ color: C.wall, roughness: 0.95 }),
  brick: new THREE.MeshStandardMaterial({ color: C.brick, roughness: 0.92 }),
  white: new THREE.MeshStandardMaterial({ color: C.white, roughness: 0.7 }),
  celadon: new THREE.MeshStandardMaterial({ color: C.celadon, roughness: 0.75, metalness: 0.1 }),
  robePink: new THREE.MeshStandardMaterial({ color: C.robePink, roughness: 0.75, metalness: 0.08 }),
  blue: new THREE.MeshStandardMaterial({ color: C.blue, roughness: 0.75 }),
  dragon: new THREE.MeshStandardMaterial({ map: dragonTex, roughness: 0.72, metalness: 0.1 }),
  floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }),
  aureole: new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, side: THREE.DoubleSide, depthWrite: false })
};

/* ---------------- 小佛几何（实例化） ---------------- */
function buildBuddhaGeo() {
  return mergeParts([
    P_cyl(0.05, 0.062, 0.06, 0, 0.03, 0, C.redDark, 6),
    P_cone(0.075, 0.17, 0, 0.145, 0, C.gold, 6),
    P_sph(0.055, 0, 0.23, 0, C.gold),
    P_sph(0.052, 0, 0.30, 0, C.gold),
    P_sph(0.024, 0, 0.345, 0, C.gold),
    P_tor(0.105, 0.013, 0, 0.28, -0.035, C.goldDim, Math.PI / 2, 0, 0)
  ]);
}
/* 小屋顶（四坡绿瓦 + 金脊 + 翘角），实例化 */
function buildRoofGeo() {
  var parts = [];
  var cone = P_cone(0.62, 0.30, 0, 0.15, 0, C.greenTile, 4, 0, Math.PI / 4, 0);
  parts.push(cone);
  var tips = [[0.44, 0.44], [-0.44, 0.44], [0.44, -0.44], [-0.44, -0.44]];
  tips.forEach(function (t, i) {
    var sx = t[0] > 0 ? 1 : -1, sz = t[1] > 0 ? 1 : -1;
    parts.push(P_cone(0.055, 0.16, t[0] * 1.02, 0.06, t[1] * 1.02, C.goldDim, 4, sz * 0.55, sx * 0.55, 0));
  });
  parts.push(P_box(0.46, 0.05, 0.1, 0, 0.31, 0, C.greenDark));
  parts.push(P_box(0.1, 0.05, 0.46, 0, 0.31, 0, C.greenDark));
  return mergeParts(parts);
}
var buddhaGeo = buildBuddhaGeo();
var roofGeo = buildRoofGeo();
var finialGeo = new THREE.IcosahedronGeometry(0.09, 0);
var nicheGeo = new THREE.PlaneGeometry(0.5, 0.52);

/* ---------------- 实例化网格工具 ---------------- */
function makeInstanced(geo, material, mats) {
  var im = new THREE.InstancedMesh(geo, material, mats.length);
  for (var i = 0; i < mats.length; i++) im.setMatrixAt(i, mats[i]);
  im.instanceMatrix.needsUpdate = true;
  im.frustumCulled = false;
  return im;
}

/* ============================================================
   悬塑墙：沿 x 展开、面朝 +z，背部 z=0，层叠而上
   ============================================================ */
var TIERS = 7, TIER_H = 0.86, Y0 = 1.02, DEPTH = 0.85, BAY = 1.06;
var totalBays = 0, totalBuddhas = 0;

function pavBay(cx, baseY, sy, lists) {
  var parts = [];
  parts.push(P_box(1.0, 0.12, 0.8, cx, 0.06, 0.42, C.redDark));
  parts.push(P_box(1.02, 0.035, 0.82, cx, 0.115, 0.42, C.goldDim));
  [-0.42, 0, 0.42].forEach(function (x) {
    parts.push(P_box(0.032, 0.1, 0.032, cx + x, 0.17, 0.78, C.goldDim));
  });
  parts.push(P_box(0.96, 0.035, 0.045, cx, 0.225, 0.78, C.goldDim));
  [-0.34, 0.34].forEach(function (x) {
    parts.push(P_cyl(0.04, 0.046, 0.62 * sy, cx + x, 0.12 + 0.31 * sy, 0.66, C.red));
  });
  parts.push(P_box(0.9, 0.62 * sy, 0.06, cx, 0.12 + 0.31 * sy, 0.1, C.wall));
  for (var b = -2; b <= 2; b++) {
    parts.push(P_box(0.09, 0.07, 0.09, cx + b * 0.18, 0.79 * sy, 0.6, C.goldDim));
  }
  parts.push(P_box(1.0, 0.06, 0.1, cx, 0.84 * sy, 0.66, C.gold));
  lists.roofs.push(mat(cx, baseY + 1.0 * sy, 0.4, 1.14, 1, 0.96));
  lists.niches.push(mat(cx, baseY + 0.12 + 0.31 * sy, 0.14));
  lists.buddhas.push(
    mat(cx, baseY + 0.36 * sy, 0.26, 1.0),
    mat(cx - 0.26, baseY + 1.14 * sy, 0.44, 0.5), mat(cx + 0.26, baseY + 1.14 * sy, 0.44, 0.5),
    mat(cx, baseY + 1.2 * sy, 0.3, 0.45),
    mat(cx - 0.3, baseY + 0.3 * sy, 0.72, 0.42), mat(cx - 0.1, baseY + 0.3 * sy, 0.72, 0.42),
    mat(cx + 0.1, baseY + 0.3 * sy, 0.72, 0.42), mat(cx + 0.3, baseY + 0.3 * sy, 0.72, 0.42),
    mat(cx - 0.4, baseY + 0.24 * sy, 0.6, 0.4), mat(cx + 0.4, baseY + 0.24 * sy, 0.6, 0.4)
  );
  return parts;
}
function towerBay(cx, baseY, sy, lists) {
  var parts = [];
  parts.push(P_box(2.1, 0.12, 0.82, cx, 0.06, 0.42, C.redDark));
  parts.push(P_box(2.12, 0.035, 0.84, cx, 0.115, 0.42, C.goldDim));
  [-0.72, 0, 0.72].forEach(function (x) {
    parts.push(P_cyl(0.042, 0.048, 0.66 * sy, cx + x, 0.12 + 0.33 * sy, 0.66, C.red));
  });
  parts.push(P_box(2.0, 0.66 * sy, 0.06, cx, 0.12 + 0.33 * sy, 0.1, C.wall));
  for (var b = -3; b <= 3; b++) {
    parts.push(P_box(0.09, 0.07, 0.09, cx + b * 0.3, 0.83 * sy, 0.6, C.goldDim));
  }
  parts.push(P_box(2.06, 0.06, 0.1, cx, 0.88 * sy, 0.66, C.gold));
  lists.niches.push(mat(cx, baseY + 0.12 + 0.33 * sy, 0.14));
  lists.roofs.push(mat(cx, baseY + 1.06 * sy, 0.4, 2.3, 1.05, 1.0));
  lists.roofs.push(mat(cx, baseY + 1.42 * sy, 0.4, 1.35, 0.8, 0.8));
  lists.finials.push(mat(cx, baseY + 1.66 * sy, 0.4));
  lists.buddhas.push(
    mat(cx, baseY + 0.38 * sy, 0.26, 1.25),
    mat(cx - 0.5, baseY + 1.22 * sy, 0.46, 0.45), mat(cx, baseY + 1.26 * sy, 0.42, 0.45), mat(cx + 0.5, baseY + 1.22 * sy, 0.46, 0.45),
    mat(cx - 0.75, baseY + 0.3 * sy, 0.72, 0.42), mat(cx - 0.25, baseY + 0.3 * sy, 0.72, 0.42),
    mat(cx + 0.25, baseY + 0.3 * sy, 0.72, 0.42), mat(cx + 0.75, baseY + 0.3 * sy, 0.72, 0.42),
    mat(cx - 0.42, baseY + 1.52 * sy, 0.4, 0.4), mat(cx + 0.42, baseY + 1.52 * sy, 0.4, 0.4),
    mat(cx, baseY + 0.24 * sy, 0.6, 0.4)
  );
  return parts;
}
function buildWall(len) {
  var g = new THREE.Group();
  var nB = Math.floor(len / BAY);
  var lists = { buddhas: [], roofs: [], niches: [], finials: [], clouds: [] };

  for (var t = 0; t < TIERS; t++) {
    var sy = (t === TIERS - 1) ? 1.22 : 1.0;
    var baseY = Y0 + t * TIER_H;
    var parts = [];
    parts.push(P_box(len, TIER_H * 0.98 * sy, 0.1, 0, baseY + TIER_H * 0.49 * sy, 0.05, C.wall));
    var i = 0;
    while (i < nB) {
      var cx = -len / 2 + BAY * (i + 0.5);
      if ((i % 4 === 2) && (t < TIERS - 1)) {
        parts = parts.concat(towerBay(cx, baseY, sy, lists));
        totalBays++; i += 2;
      } else {
        parts = parts.concat(pavBay(cx, baseY, sy, lists));
        totalBays++; i += 1;
      }
    }
    for (var p = 1; p < nB; p++) {
      parts.push(P_box(0.09, TIER_H * 0.85 * sy, DEPTH * 0.9, -len / 2 + BAY * p, baseY + TIER_H * 0.42 * sy, DEPTH * 0.32, C.redDark));
    }
    for (var h = 0; h < nB; h += 6) {
      parts.push(P_cyl(0.03, 0.03, TIER_H * 0.5, -len / 2 + BAY * (h + 0.5), baseY - 0.06, DEPTH * 0.55, C.red));
    }
    var mesh = new THREE.Mesh(mergeParts(parts), M.stat);
    mesh.receiveShadow = true;
    g.add(mesh);

    /* 层间粉色流云（横向波状） */
    var pts = [], R = 36;
    for (var s = 0; s <= R; s++) {
      var x = -len / 2 + len * s / R;
      pts.push(new THREE.Vector3(
        x,
        baseY + TIER_H * sy + 0.04 + Math.sin(s / R * Math.PI * 7 + t * 1.3) * 0.07,
        DEPTH * 0.5 + Math.sin(s / R * Math.PI * 4 + t * 1.7) * 0.24
      ));
    }
    lists.clouds.push({ g: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 44, 0.062, 5, false), m: mat(0, 0, 0), c: C.pink });
    /* 垂下的流云 */
    [len / 3, -len / 3].forEach(function (hx, k) {
      var vp = [];
      for (var u = 0; u <= 10; u++) {
        vp.push(new THREE.Vector3(
          hx + Math.sin(u * 0.9 + k * 2 + t) * 0.1,
          baseY + TIER_H * sy - u * 0.085,
          DEPTH * 0.62 + Math.cos(u * 0.7 + t) * 0.08
        ));
      }
      lists.clouds.push({ g: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vp), 20, 0.045, 5, false), m: mat(0, 0, 0), c: C.pinkLight });
    });
  }

  /* 顶部通长屋檐 */
  var topY = Y0 + TIERS * TIER_H;
  var topParts = [];
  topParts.push(P_box(len + 0.5, 0.12, 0.85, 0, topY + 0.32, 0.42, C.greenTile, -0.3, 0, 0));
  topParts.push(P_box(len + 0.5, 0.12, 0.85, 0, topY + 0.32, 0.42, C.greenTile, 0.3, 0, 0));
  topParts.push(P_box(len + 0.6, 0.1, 0.2, 0, topY + 0.56, 0.42, C.gold));
  var topMesh = new THREE.Mesh(mergeParts(topParts), M.stat);
  g.add(topMesh);
  /* 檐口小佛一列 */
  for (var e = -Math.floor(len / 2 / 0.34); e <= Math.floor(len / 2 / 0.34); e++) {
    lists.buddhas.push(mat(e * 0.34, topY + 0.1, 0.62, 0.42));
  }

  /* 实例化小佛 / 屋顶 / 佛龛 / 塔刹 */
  g.add(makeInstanced(buddhaGeo, M.buddha, lists.buddhas));
  g.add(makeInstanced(roofGeo, M.roof, lists.roofs));
  g.add(makeInstanced(nicheGeo, M.niche, lists.niches));
  g.add(makeInstanced(finialGeo, M.gold, lists.finials));
  var cloudMesh = new THREE.Mesh(mergeParts(lists.clouds), M.stat);
  g.add(cloudMesh);

  totalBuddhas += lists.buddhas.length;
  return g;
}

/* 三面悬塑墙：北（后）+ 东 + 西 */
var hallLen = 13, hallDep = 11;
var wallN = buildWall(hallLen); wallN.position.z = -hallDep / 2; scene.add(wallN);
var wallE = buildWall(hallDep); wallE.rotation.y = -Math.PI / 2; wallE.position.x = hallLen / 2; scene.add(wallE);
var wallW = buildWall(hallDep); wallW.rotation.y = Math.PI / 2; wallW.position.x = -hallLen / 2; scene.add(wallW);

/* ============================================================
   殿堂空间：地面 / 墙体 /  doorway / 蟠龙柱 / 梁架
   ============================================================ */
var W2 = hallLen / 2, D2 = hallDep / 2, HALL_H = 8.4;

var floor = new THREE.Mesh(new THREE.PlaneGeometry(hallLen + 1.4, hallDep + 1.4), M.floor);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

/* 背景暗墙（遮住悬塑墙背面） */
var backWall = new THREE.Mesh(new THREE.PlaneGeometry(hallLen, HALL_H), M.wall);
backWall.position.set(0, HALL_H / 2, -D2 - 0.2);
scene.add(backWall);

/* 南墙与 doorway */
var sParts = [];
sParts.push(P_box((hallLen - 2.4) / 2, HALL_H, 0.3, -(1.2 + (hallLen - 2.4) / 4), HALL_H / 2, D2 + 0.15, C.wall));
sParts.push(P_box((hallLen - 2.4) / 2, HALL_H, 0.3, 1.2 + (hallLen - 2.4) / 4, HALL_H / 2, D2 + 0.15, C.wall));
sParts.push(P_box(2.4, HALL_H - 2.7, 0.3, 0, 2.7 + (HALL_H - 2.7) / 2, D2 + 0.15, C.wall));
sParts.push(P_box(0.5, 0.18, 0.5, -1.35, 0.09, D2 - 0.1, C.wood));
sParts.push(P_box(0.5, 0.18, 0.5, 1.35, 0.09, D2 - 0.1, C.wood));
scene.add(new THREE.Mesh(mergeParts(sParts), M.stat));

/* 蟠龙金柱 + 柱头斗拱 */
function column(x, z) {
  var g = new THREE.Group();
  var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 7.4, 14, 1), M.dragon);
  shaft.position.y = 0.5 + 3.7; shaft.castShadow = true;
  g.add(shaft);
  var base = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.5, 0.5, 12), M.white);
  base.position.y = 0.25; g.add(base);
  var capParts = [
    P_box(0.95, 0.16, 0.95, 0, 7.55, 0, C.red),
    P_box(1.45, 0.14, 0.24, 0, 7.68, 0, C.goldDim),
    P_box(0.24, 0.14, 1.45, 0, 7.68, 0, C.goldDim),
    P_box(1.05, 0.14, 1.05, 0, 7.8, 0, C.red)
  ];
  var cap = new THREE.Mesh(mergeParts(capParts), M.stat);
  g.add(cap);
  g.position.set(x, 0, z);
  scene.add(g);
}
column(-3.35, -0.6); column(3.35, -0.6);
column(-3.35, 2.9); column(3.35, 2.9);
column(-5.3, -1.6); column(5.3, -1.6);
column(-5.3, 1.7); column(5.3, 1.7);

/* 梁架（可隐藏） */
var roofGroup = new THREE.Group();
(function buildRoof() {
  var parts = [];
  [-3.4, 0, 3.4].forEach(function (z) {
    parts.push(P_box(13.8, 0.36, 0.5, 0, 7.95, z, C.wood));
  });
  [-4.5, -1.5, 1.5, 4.5].forEach(function (x) {
    parts.push(P_box(0.24, 0.3, 11.6, x, 8.16, 0, C.woodDark));
  });
  for (var i = 0; i < 27; i++) {
    parts.push(P_box(0.12, 0.18, 11.8, -6.4 + i * 0.49, 8.36, 0, C.wood));
  }
  parts.push(P_box(13.8, 0.3, 0.45, 0, 7.98, 5.35, C.wood));
  var beams = new THREE.Mesh(mergeParts(parts), M.stat);
  roofGroup.add(beams);
  var ceil = new THREE.Mesh(new THREE.PlaneGeometry(13.8, 11.8),
    new THREE.MeshStandardMaterial({ color: 0x120d09, roughness: 0.95 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 8.52;
  roofGroup.add(ceil);
})();
scene.add(roofGroup);

/* 门前楹联 */
function couplet(text, x) {
  var tex = canvasTex(64, 256, function (g) {
    g.fillStyle = '#7e1f1a'; g.fillRect(0, 0, 64, 256);
    g.strokeStyle = '#caa24f'; g.lineWidth = 4; g.strokeRect(4, 4, 56, 248);
    g.fillStyle = '#e8c26a'; g.font = 'bold 34px "KaiTi","STKaiti","Kaiti SC",serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    var chars = text.split('');
    chars.forEach(function (ch, i) { g.fillText(ch, 32, 34 + i * 52); });
  });
  var p = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 2.2),
    new THREE.MeshBasicMaterial({ map: tex }));
  p.position.set(x, 4.6, D2 - 0.05);
  p.rotation.y = Math.PI;
  scene.add(p);
}
couplet('千佛庄严', -2.15);
couplet('宝相光明', 2.15);

/* ============================================================
   佛坛与大佛
   ============================================================ */
function lathe(pts, seg) {
  return new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 14);
}
/* 大坐佛（面朝 +z，原点在莲座底） */
function bigBuddha(s, matBody) {
  var g = new THREE.Group();
  var parts = [];
  parts.push(P_cyl(0.62, 0.72, 0.16, 0, 0.08, 0, C.redDark, 10));
  parts.push(P_tor(0.52, 0.08, 0, 0.24, 0, C.gold));
  parts.push(P_cyl(0.42, 0.5, 0.2, 0, 0.32, 0, C.red, 10));
  g.add(new THREE.Mesh(mergeParts(parts), M.stat));

  var legs = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), matBody);
  legs.scale.set(1.35, 0.42, 1.05); legs.position.y = 0.62; legs.castShadow = true; g.add(legs);
  var torso = new THREE.Mesh(lathe([
    [0.30, 0.72], [0.44, 0.88], [0.50, 1.12], [0.44, 1.38], [0.24, 1.56], [0.16, 1.64]
  ]), matBody);
  torso.castShadow = true; g.add(torso);
  var shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 9), matBody);
  shoulders.scale.set(1.3, 0.62, 0.9); shoulders.position.y = 1.52; shoulders.castShadow = true; g.add(shoulders);
  var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 8), matBody);
  neck.position.y = 1.66; g.add(neck);
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 11), matBody);
  head.position.y = 1.9; head.castShadow = true; g.add(head);
  var ushnisha = new THREE.Mesh(new THREE.SphereGeometry(0.1, 9, 7), matBody);
  ushnisha.position.y = 2.16; g.add(ushnisha);
  [-1, 1].forEach(function (sx) {
    var ear = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), matBody);
    ear.scale.set(0.5, 1.5, 0.8); ear.position.set(sx * 0.27, 1.88, 0); g.add(ear);
    var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.62, 8), matBody);
    arm.position.set(sx * 0.38, 1.18, 0.08); arm.rotation.z = sx * 0.5; arm.castShadow = true; g.add(arm);
  });
  var hands = new THREE.Mesh(new THREE.SphereGeometry(0.12, 9, 7), matBody);
  hands.scale.set(1.3, 0.7, 1); hands.position.set(0, 0.94, 0.42); g.add(hands);
  var halo = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 6, 20), M.gold);
  halo.position.set(0, 1.92, 0.02); g.add(halo);
  var aureole = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24), M.aureole);
  aureole.position.set(0, 1.62, -0.18); g.add(aureole);
  g.scale.set(s, s, s);
  return g;
}
/* 立像（弟子 / 菩萨） */
function attendant(h, matBody, crown) {
  var g = new THREE.Group();
  var robe = new THREE.Mesh(lathe([
    [0.30, 0], [0.34, h * 0.22], [0.28, h * 0.55], [0.20, h * 0.78], [0.15, h * 0.9]
  ], 10), matBody);
  robe.castShadow = true; g.add(robe);
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), matBody);
  head.position.y = h * 0.97; head.castShadow = true; g.add(head);
  [-1, 1].forEach(function (sx) {
    var hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), matBody);
    hand.position.set(sx * 0.1, h * 0.52, 0.2); g.add(hand);
  });
  if (crown) {
    var c = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 8), M.gold);
    c.position.y = h * 0.97 + 0.2; g.add(c);
    var jewel = new THREE.Mesh(new THREE.SphereGeometry(0.04, 7, 6), M.gold);
    jewel.position.set(0, h * 0.97 + 0.24, 0.1); g.add(jewel);
  }
  return g;
}
/* 狮子 */
function lion(matBody) {
  var g = new THREE.Group();
  var body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), matBody);
  body.scale.set(1.35, 0.85, 0.9); body.position.y = 0.42; body.castShadow = true; g.add(body);
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), matBody);
  head.position.set(0, 0.72, 0.32); head.castShadow = true; g.add(head);
  for (var i = 0; i < 8; i++) {
    var a = i * Math.PI / 4;
    var mf = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), matBody);
    mf.position.set(Math.cos(a) * 0.17, 0.72 + Math.sin(a) * 0.17, 0.32); g.add(mf);
  }
  [-1, 1].forEach(function (sx) {
    var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.4, 7), matBody);
    leg.position.set(sx * 0.16, 0.2, 0.3); g.add(leg);
  });
  return g;
}

/* 佛坛（三级台基） */
(function altar() {
  var parts = [];
  parts.push(P_box(8.4, 0.42, 3.5, 0, 0.21, -3.45, C.brick));
  parts.push(P_box(7.8, 0.42, 3.1, 0, 0.63, -3.45, C.brick));
  parts.push(P_box(7.2, 0.5, 2.7, 0, 1.09, -3.45, C.brick));
  parts.push(P_box(8.5, 0.06, 3.6, 0, 0.44, -3.45, C.white));
  parts.push(P_box(7.9, 0.06, 3.2, 0, 0.86, -3.45, C.white));
  parts.push(P_box(7.3, 0.06, 2.8, 0, 1.36, -3.45, C.white));
  for (var s = 0; s < 3; s++) {
    parts.push(P_box(1.8, 0.14, 0.3, 0, 0.07 + s * 0.14, -1.55 - s * 0.3, C.white));
  }
  var plat = new THREE.Mesh(mergeParts(parts), M.stat);
  plat.castShadow = true; plat.receiveShadow = true;
  scene.add(plat);

  var bc = bigBuddha(1.5, M.gold); bc.position.set(0, 1.34, -3.7); scene.add(bc);
  var bl = bigBuddha(1.3, M.gold); bl.position.set(-2.15, 1.34, -3.55); scene.add(bl);
  var br = bigBuddha(1.3, M.gold); br.position.set(2.15, 1.34, -3.55); scene.add(br);
  var d1 = attendant(2.0, M.celadon, false); d1.position.set(-1.2, 1.34, -2.9); scene.add(d1);
  var d2 = attendant(2.0, M.white, false); d2.position.set(1.2, 1.34, -2.9); scene.add(d2);
  var b1 = attendant(2.35, M.robePink, true); b1.position.set(-3.0, 1.34, -3.3); scene.add(b1);
  var b2 = attendant(2.35, M.celadon, true); b2.position.set(3.0, 1.34, -3.3); scene.add(b2);
  var l1 = lion(M.white); l1.position.set(-3.4, 1.34, -2.1); scene.add(l1);
  var l2 = lion(M.white); l2.position.set(3.4, 1.34, -2.1); l2.rotation.y = Math.PI; scene.add(l2);
})();

/* 东西壁大坐佛 */
(function sideAltars() {
  [-1, 1].forEach(function (sx) {
    var plat = new THREE.Mesh(mergeParts([
      P_box(1.5, 0.5, 2.6, sx * 4.9, 0.25, -2.2, C.brick),
      P_box(1.6, 0.06, 2.7, sx * 4.9, 0.53, -2.2, C.white)
    ]), M.stat);
    plat.castShadow = true; scene.add(plat);
    var bd = bigBuddha(1.25, M.gold);
    bd.position.set(sx * 4.9, 0.55, -2.2);
    bd.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(bd);
    var a1 = attendant(1.9, M.white, false);
    a1.position.set(sx * 4.9, 0.55, -1.15);
    a1.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(a1);
    var a2 = attendant(2.1, M.robePink, true);
    a2.position.set(sx * 4.9, 0.55, -3.25);
    a2.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(a2);
  });
})();

/* 灯笼 */
[-1.9, 1.9].forEach(function (x) {
  var lan = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xa82622, emissive: 0x7a1408, roughness: 0.6 }));
  lan.scale.y = 0.82; lan.position.set(x, 6.0, 0); scene.add(lan);
  var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.08, 8), M.gold);
  cap.position.set(x, 6.22, 0); scene.add(cap);
  var tass = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.22, 6),
    new THREE.MeshStandardMaterial({ color: 0xc8a03a, emissive: 0x2a1a05 }));
  tass.position.set(x, 5.72, 0); scene.add(tass);
});

/* ---------------- 灯光 ---------------- */
scene.add(new THREE.AmbientLight(0x40342a, 0.55));
var hemi = new THREE.HemisphereLight(0x2c3a4a, 0x1a1410, 0.4);
scene.add(hemi);

var spot = new THREE.SpotLight(0xffd9a0, 1.5, 45, 0.62, 0.7, 1.2);
spot.position.set(0, 7.8, 6.0);
spot.target.position.set(0, 2.6, -3.5);
spot.castShadow = true;
spot.shadow.mapSize.set(2048, 2048);
spot.shadow.camera.near = 1; spot.shadow.camera.far = 30;
spot.shadow.bias = -0.0006;
scene.add(spot); scene.add(spot.target);

function pt(x, y, z, c, i, d) {
  var l = new THREE.PointLight(c, i, d || 16, 1.6);
  l.position.set(x, y, z); scene.add(l);
}
pt(0, 6.6, 1.6, 0xffc98a, 0.55, 18);
pt(-4.4, 4.6, -4.2, 0xffb070, 0.5, 14);
pt(4.4, 4.6, -4.2, 0xffb070, 0.5, 14);
pt(0, 7.6, -4.8, 0x8a6a4a, 0.4, 12);
pt(0, 3.2, 5.8, 0xffe2b8, 0.65, 12);
pt(1.9, 6.0, 0, 0xff9040, 0.3, 5);
pt(-1.9, 6.0, 0, 0xff9040, 0.3, 5);

/* ---------------- 尘埃粒子 ---------------- */
var dust = (function () {
  var N = 380, pos = new Float32Array(N * 3), seed = [];
  for (var i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 10;
    pos[i * 3 + 1] = 0.5 + Math.random() * 6.8;
    pos[i * 3 + 2] = -4.5 + Math.random() * 9;
    seed.push(Math.random() * 100);
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var m = new THREE.PointsMaterial({
    color: 0xffe0b0, size: 0.022, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  });
  var pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  pts.userData = { seed: seed };
  scene.add(pts);
  return pts;
})();

/* ---------------- 热点标注 ---------------- */
var hotspots = [];
function hotspot(x, y, z, label) {
  var hit = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hit.position.set(x, y, z);
  hit.userData.label = label;
  scene.add(hit);
  var dot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1),
    new THREE.MeshBasicMaterial({ color: 0xffd870 }));
  dot.position.set(x, y, z);
  scene.add(dot);
  hotspots.push({ hit: hit, dot: dot });
}
hotspot(0, 3.9, -3.6, '佛坛 · 金铜大佛');
hotspot(0, 5.4, -4.9, '北壁悬塑 · 层阁千龛');
hotspot(5.1, 3.4, -1.6, '东壁悬塑 · 楼阁宝塔');
hotspot(-5.1, 3.4, -1.6, '西壁悬塑 · 流云垂幔');
hotspot(3.35, 4.8, 2.9, '蟠龙金柱');
hotspot(0, 7.6, 0.4, '梁架 · 斗拱');

/* ---------------- UI 交互 ---------------- */
var tip = document.getElementById('tip');
var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();
var mouseClient = { x: 0, y: 0 };
var mouseDirty = false, lastRay = 0;

window.addEventListener('pointermove', function (e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  mouseClient.x = e.clientX; mouseClient.y = e.clientY;
  mouseDirty = true;
});

var camAnim = null;
function flyTo(p, t, dur) {
  camAnim = {
    t0: performance.now(), dur: dur || 1500,
    fp: camera.position.clone(), tp: new THREE.Vector3(p[0], p[1], p[2]),
    ft: controls.target.clone(), tt: new THREE.Vector3(t[0], t[1], t[2])
  };
}
function ease(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }

var presets = {
  overview: { p: [0, 3.0, 4.6], t: [0, 2.6, -3.0] },
  altar: { p: [0, 2.5, -0.7], t: [0, 3.1, -3.6] },
  lookUp: { p: [0, 1.25, 2.7], t: [0, 7.9, -2.8] },
  closeup: { p: [3.1, 3.2, -0.9], t: [5.2, 2.9, -2.3] },
  top: { p: [0, 15.5, 0.8], t: [0, 0, -0.5] }
};
var btnRotate = document.getElementById('btnRotate');
var btnRoof = document.getElementById('btnRoof');
var roofHidden = false;

function setAuto(on) {
  controls.autoRotate = on;
  btnRotate.classList.toggle('on', on);
}
function setRoof(hidden) {
  roofHidden = hidden;
  roofGroup.visible = !hidden;
  btnRoof.classList.toggle('on', !hidden);
  btnRoof.textContent = hidden ? '屋顶·隐' : '屋顶·显';
}
btnRotate.addEventListener('click', function () { setAuto(!controls.autoRotate); });
btnRoof.addEventListener('click', function () { setRoof(!roofHidden); });

var presetBtns = document.querySelectorAll('[data-p]');
Array.prototype.forEach.call(presetBtns, function (b) {
  b.addEventListener('click', function () {
    var pr = presets[b.getAttribute('data-p')];
    if (b.getAttribute('data-p') === 'top' && !roofHidden) setRoof(true);
    flyTo(pr.p, pr.t);
    Array.prototype.forEach.call(presetBtns, function (x) { x.classList.remove('on'); });
    b.classList.add('on');
  });
});
controls.addEventListener('start', function () {
  camAnim = null;
  if (controls.autoRotate) setAuto(false);
});
window.addEventListener('keydown', function (e) {
  var keys = ['overview', 'altar', 'lookUp', 'closeup', 'top'];
  if (e.key >= '1' && e.key <= '5') {
    var pr = presets[keys[e.key - 1]];
    flyTo(pr.p, pr.t);
  }
  if (e.key === 'r' || e.key === 'R') setAuto(!controls.autoRotate);
  if (e.key === 't' || e.key === 'T') setRoof(!roofHidden);
});

/* ---------------- 统计信息 ---------------- */
document.getElementById('statLine').textContent =
  '悬塑佛龛楼阁 ' + totalBays + ' 处 · 小佛 ' + totalBuddhas + ' 余尊 · 蟠龙金柱 8 根 · 殿内通高 8.4 m';

/* ---------------- 主循环 ---------------- */
var clock = new THREE.Clock();
var camMin = new THREE.Vector3(-W2 + 0.3, 0.25, -D2 + 0.3);
var camMax = new THREE.Vector3(W2 - 0.3, 16, D2 - 0.3);
var tgtBox = { x: 5.0, y: 0.5, zmin: -4.4, zmax: 4.8, ymin: 0.45, ymax: 7.6 };

function animate() {
  requestAnimationFrame(animate);
  var dt = Math.min(clock.getDelta(), 0.05);
  var now = performance.now();
  var t = now / 1000;

  controls.update();
  /* 相机限制在殿内水平范围 */
  camera.position.x = Math.max(camMin.x, Math.min(camMax.x, camera.position.x));
  camera.position.z = Math.max(camMin.z, Math.min(camMax.z, camera.position.z));
  camera.position.y = Math.max(camMin.y, Math.min(camMax.y, camera.position.y));
  var tg = controls.target;
  tg.x = Math.max(-tgtBox.x, Math.min(tgtBox.x, tg.x));
  tg.y = Math.max(tgtBox.ymin, Math.min(tgtBox.ymax, tg.y));
  tg.z = Math.max(tgtBox.zmin, Math.min(tgtBox.zmax, tg.z));

  if (camAnim) {
    var k = Math.min(1, (now - camAnim.t0) / camAnim.dur);
    var e2 = ease(k);
    camera.position.lerpVectors(camAnim.fp, camAnim.tp, e2);
    controls.target.lerpVectors(camAnim.ft, camAnim.tt, e2);
    if (k >= 1) camAnim = null;
  }

  /* 尘埃漂浮 */
  var pa = dust.geometry.attributes.position;
  var seed = dust.userData.seed;
  for (var i = 0; i < pa.count; i++) {
    var s = seed[i];
    pa.array[i * 3] += Math.sin(t * 0.3 + s) * 0.0006;
    pa.array[i * 3 + 1] += 0.0011 + Math.sin(t * 0.5 + s * 2) * 0.0004;
    if (pa.array[i * 3 + 1] > 7.6) pa.array[i * 3 + 1] = 0.4;
  }
  pa.needsUpdate = true;

  /* 热点脉动 + 悬停提示 */
  for (var h = 0; h < hotspots.length; h++) {
    var hs = hotspots[h];
    var sc = 1 + Math.sin(t * 2.2 + h * 1.7) * 0.25;
    hs.dot.scale.set(sc, sc, sc);
  }
  if (mouseDirty && now - lastRay > 90) {
    lastRay = now; mouseDirty = false;
    raycaster.setFromCamera(mouse, camera);
    var hits = raycaster.intersectObjects(hotspots.map(function (o) { return o.hit; }));
    if (hits.length) {
      tip.textContent = hits[0].object.userData.label;
      tip.style.display = 'block';
      tip.style.left = (mouseClient.x + 14) + 'px';
      tip.style.top = (mouseClient.y + 10) + 'px';
    } else {
      tip.style.display = 'none';
    }
  }

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* 首帧渲染后隐藏加载层 */
requestAnimationFrame(function () {
  requestAnimationFrame(function () {
    var l = document.getElementById('loading');
    if (l) l.classList.add('hide');
  });
});
})();
