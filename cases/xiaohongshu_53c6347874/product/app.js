/* ============================================================
   应县木塔（佛宫寺释迦塔）三维复原
   八角平面 · 五明层四暗层 · 六重檐 · 筒中筒木构体系
   单位≈米，总高约66米
   ============================================================ */
(function () {
'use strict';

// ---------------- 场景 / 相机 / 渲染器 ----------------
var scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9c6cf);
scene.fog = new THREE.Fog(0xb9c6cf, 120, 280);

var camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 800);
var CAM0 = new THREE.Vector3(47, 30, 47);
var TGT0 = new THREE.Vector3(0, 23, 0);
camera.position.copy(CAM0);

var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

var controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.copy(TGT0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2;
controls.maxDistance = 180;
controls.maxPolarAngle = Math.PI * 0.52;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.45;
controls.addEventListener('start', function () { controls.autoRotate = false; });

document.getElementById('resetBtn').addEventListener('click', function () {
  camera.position.copy(CAM0);
  controls.target.copy(TGT0);
  controls.autoRotate = true;
});

// ---------------- 灯光 ----------------
scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x77815f, 0.55));
var sun = new THREE.DirectionalLight(0xfff1dd, 1.05);
sun.position.set(50, 85, 35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -48; sun.shadow.camera.right = 48;
sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -12;
sun.shadow.camera.near = 20; sun.shadow.camera.far = 220;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffffff, 0.12));

// ---------------- 材质 ----------------
function M(color, rough, metal, side) {
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: rough == null ? 0.85 : rough,
    metalness: metal || 0,
    side: side || THREE.FrontSide
  });
}
var MATS = {
  wood:  M(0x7e4430),                    // 柱 红褐
  woodD: M(0x5e3226),                    // 梁架 深褐
  wall:  M(0xb5895a),                    // 墙 土黄
  band:  M(0x9a4034),                    // 暗层红墙
  rail:  M(0x8a4636),                    // 栏杆
  tile:  M(0x6b7c8c, 0.9, 0, THREE.DoubleSide),   // 瓦面 蓝灰
  tileD: M(0x54667a, 0.9, 0, THREE.DoubleSide),   // 脊
  under: M(0x453226, 0.95, 0, THREE.DoubleSide),  // 檐底/椽
  stone: M(0xb3ac9e, 0.95),              // 台基
  stoneD: M(0x8f887a, 0.95),             // 柱础
  doug:  M(0x9c7f4e, 0.9),               // 斗拱
  gold:  M(0xc9a24f, 0.35, 0.65),        // 佛像/宝珠
  iron:  M(0x3a3f44, 0.5, 0.6),          // 塔刹
  dark:  M(0x241a13, 1.0),               // 门洞窗洞
  ground:M(0x7f8b6d, 1.0),
  court: M(0xa39c8d, 1.0)
};

// ---------------- 实例化收集器 ----------------
var boxGeo = new THREE.BoxGeometry(1, 1, 1);
var cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
var buckets = {};
function bucket(name) {
  if (!buckets[name]) buckets[name] = { mat: MATS[name], list: [] };
  return buckets[name];
}
// 欧拉角放置的单位盒
function box(name, sx, sy, sz, px, py, pz, ry, rx, rz) {
  var q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
  var m = new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), q, new THREE.Vector3(sx, sy, sz));
  bucket(name).list.push(m);
}
// 正交基放置的单位盒（椽子/脊/斜撑）
function boxBasis(name, ax, ay, az, bx, by, bz, cx, cy, cz, px, py, pz, sx, sy, sz) {
  var m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz), new THREE.Vector3(cx, cy, cz));
  m.scale(new THREE.Vector3(sx, sy, sz));
  m.setPosition(px, py, pz);
  bucket(name).list.push(m);
}
// 单位圆柱（半径r，高h）
function cyl(name, r, h, px, py, pz) {
  var m = new THREE.Matrix4().compose(
    new THREE.Vector3(px, py, pz),
    new THREE.Quaternion(),
    new THREE.Vector3(r, h, r));
  bucket(name).list.push(m);
}
// 八边形面上沿弦偏移放置（i=面序号, ap=面心半径, off=沿弦偏移）
function faceBox(name, i, ap, yC, len, h, thick, off) {
  var am = (i + 0.5) * Math.PI / 4;
  var px = Math.cos(am) * ap - Math.sin(am) * (off || 0);
  var pz = Math.sin(am) * ap + Math.cos(am) * (off || 0);
  box(name, thick, h, len, px, yC, pz, -am);
}
function chord(R, n) { return 2 * R * Math.sin(Math.PI / n); }

// ---------------- 斗拱铺作 ----------------
// 每朵：大斗 + 华拱(径向) + 瓜子拱(切向) + 散斗×4 + 橑檐枋
var DG_PARTS = [
  [0.60, 0.42, 0.60,   0,    0.21,  0   ],
  [1.35, 0.26, 0.42,   0,    0.55,  0   ],
  [0.40, 0.24, 1.80,   0,    0.78,  0   ],
  [0.27, 0.22, 0.27,   0,    1.00,  0.74],
  [0.27, 0.22, 0.27,   0,    1.00, -0.74],
  [0.27, 0.22, 0.27,   0.55, 0.84,  0   ],
  [0.27, 0.22, 0.27,  -0.55, 0.84,  0   ],
  [0.44, 0.20, 2.20,   0,    1.16,  0   ]
];
function dougong(x, y, z, ang, s) {
  var q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -ang, 0));
  var base = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
  for (var k = 0; k < DG_PARTS.length; k++) {
    var p = DG_PARTS[k];
    var m = base.clone().multiply(new THREE.Matrix4().makeTranslation(p[3] * s, p[4] * s, p[5] * s));
    m.scale(new THREE.Vector3(p[0], p[1], p[2]));
    bucket('doug').list.push(m);
  }
}
// 在半径R、n等分环上布置斗拱
function dougongRing(R, n, y, s, phase) {
  for (var i = 0; i < n; i++) {
    var a = (i + (phase || 0)) * 2 * Math.PI / n;
    dougong(Math.cos(a) * R, y, Math.sin(a) * R, a, s);
  }
}

// ---------------- 檐（带起翘的八角屋面） ----------------
function eaveGeo(r0, y0, r1, y1, lift, thick) {
  var pos = [], idx = [];
  var N = 8, i, a, a0, a1, am;
  // 内圈（8点）
  for (i = 0; i < N; i++) {
    a = i * Math.PI / 4;
    pos.push(Math.cos(a) * r0, y0, Math.sin(a) * r0);
  }
  // 外圈（每面3点：角-中-角，角部起翘）
  for (i = 0; i < N; i++) {
    a0 = i * Math.PI / 4; a1 = (i + 1) * Math.PI / 4; am = (a0 + a1) / 2;
    pos.push(Math.cos(a0) * r1, y1 + lift, Math.sin(a0) * r1);
    pos.push(Math.cos(am) * r1, y1 + lift * 0.35, Math.sin(am) * r1);
    pos.push(Math.cos(a1) * r1, y1 + lift, Math.sin(a1) * r1);
  }
  var topIdx = [];
  for (i = 0; i < N; i++) {
    var o0 = 8 + i * 3, aa = i, bb = (i + 1) % N;
    topIdx.push(aa, o0 + 1, o0, aa, bb, o0 + 1, bb, o0 + 2, o0 + 1);
  }
  // 底面（下移thick、略收分、反绕）
  var base = pos.length / 3;
  for (i = 0; i < N; i++) {
    a = i * Math.PI / 4;
    pos.push(Math.cos(a) * r0 * 0.995, y0 - thick, Math.sin(a) * r0 * 0.995);
  }
  for (i = 0; i < N; i++) {
    a0 = i * Math.PI / 4; a1 = (i + 1) * Math.PI / 4; am = (a0 + a1) / 2;
    pos.push(Math.cos(a0) * r1 * 0.995, y1 + lift - thick, Math.sin(a0) * r1 * 0.995);
    pos.push(Math.cos(am) * r1 * 0.995, y1 + lift * 0.35 - thick, Math.sin(am) * r1 * 0.995);
    pos.push(Math.cos(a1) * r1 * 0.995, y1 + lift - thick, Math.sin(a1) * r1 * 0.995);
  }
  var botIdx = [];
  for (i = 0; i < N; i++) {
    var p0 = base + 8 + i * 3, ca = base + i, cb = base + (i + 1) % N;
    botIdx.push(ca, p0, p0 + 1, ca, p0 + 1, cb, cb, p0 + 1, p0 + 2);
  }
  // 檐口侧裙
  var skIdx = [];
  for (i = 0; i < 24; i++) {
    var t0 = 8 + i, t1 = 8 + (i + 1) % 24, b0 = base + 8 + i, b1 = base + 8 + (i + 1) % 24;
    skIdx.push(t0, b0, t1, t1, b0, b1);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  var all = idx.concat(topIdx);
  g.setIndex(all);
  g.addGroup(0, topIdx.length, 0);
  var o1 = topIdx.length;
  for (var q = 0; q < botIdx.length; q++) all.push(botIdx[q]);
  g.addGroup(o1, botIdx.length, 1);
  var o2 = o1 + botIdx.length;
  for (var w = 0; w < skIdx.length; w++) all.push(skIdx[w]);
  g.addGroup(o2, skIdx.length, 2);
  g.computeVertexNormals();
  return g;
}
// 两点间盒子基向量
function beamBasis(x0, y0, z0, x1, y1, z1, tangent) {
  var dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  dx /= len; dy /= len; dz /= len;
  var zx = -Math.sin(tangent), zz = Math.cos(tangent);
  var yx = zz * dy - 0, yz0 = 0 * dx - zx * dy, yy = zx * dz - zz * dx; // z × x
  var ylen = Math.sqrt(yx * yx + yz0 * yz0 + yy * yy); yx /= ylen; yz0 /= ylen; yy /= ylen;
  var nx = dy * zz - dz * 0, ny = dz * zx - dx * zz, nz = dx * 0 - dy * zx; // x × z'... 用 x×y
  nx = dy * yz0 - dz * yy; ny = dz * yx - dx * yz0; nz = dx * yy - dy * yx;
  var nlen = Math.sqrt(nx * nx + ny * ny + nz * nz); nx /= nlen; ny /= nlen; nz /= nlen;
  return [dx, dy, dz, yx, yy, yz0, nx, ny, nz, len];
}
function eave(r0, y0, r1, y1, lift) {
  var g = eaveGeo(r0, y0, r1, y1, lift, 0.32);
  var mesh = new THREE.Mesh(g, [MATS.tile, MATS.under, MATS.tileD]);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  // 檐椽
  var nR = 32;
  for (var i = 0; i < nR; i++) {
    var a = (i + 0.5) / nR * Math.PI * 2;
    var sx = Math.cos(a) * r0 * 0.98, sy = y0 - 0.15, sz = Math.sin(a) * r0 * 0.98;
    var ex = Math.cos(a) * r1, ey = y1 + lift * 0.85, ez = Math.sin(a) * r1;
    var B = beamBasis(sx, sy, sz, ex, ey, ez, a);
    boxBasis('under', B[0], B[1], B[2], B[3], B[4], B[5], B[6], B[7], B[8],
      (sx + ex) / 2, (sy + ey) / 2, (sz + ez) / 2, B[9] + 0.4, 0.15, 0.4);
  }
  // 垂脊
  for (var j = 0; j < 8; j++) {
    var a2 = j * Math.PI / 4;
    var x0 = Math.cos(a2) * r0, yA = y0 + 0.1, z0 = Math.sin(a2) * r0;
    var x1 = Math.cos(a2) * r1, yB = y1 + lift + 0.12, z1 = Math.sin(a2) * r1;
    var B2 = beamBasis(x0, yA, z0, x1, yB, z1, a2);
    boxBasis('tileD', B2[0], B2[1], B2[2], B2[3], B2[4], B2[5], B2[6], B2[7], B2[8],
      (x0 + x1) / 2, (yA + yB) / 2, (z0 + z1) / 2, B2[9] + 0.3, 0.26, 0.45);
  }
}

// ---------------- 楼板（八角环板，中央留空可仰视） ----------------
function slab(yOut, rHole) {
  var shape = new THREE.Shape(), hole = new THREE.Path(), i;
  for (i = 0; i < 8; i++) {
    var a = i * Math.PI / 4, x = Math.cos(a) * yOut, y = Math.sin(a) * yOut;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  for (i = 0; i < 8; i++) {
    var a2 = i * Math.PI / 4, x2 = Math.cos(a2) * rHole, y2 = Math.sin(a2) * rHole;
    if (i === 0) hole.moveTo(x2, y2); else hole.lineTo(x2, y2);
  }
  hole.closePath();
  shape.holes.push(hole);
  var g = new THREE.ExtrudeGeometry(shape, { depth: 0.32, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  var mesh = new THREE.Mesh(g, MATS.woodD);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// ---------------- 台基与踏道 ----------------
cyl('stoneD', 16.0, 0.55, 0, 0.275, 0);
cyl('stone', 15.2, 1.85, 0, 0.55 + 0.925, 0);
for (var st = 0; st < 4; st++) {
  var sa = (22.5 + 90 * st) * Math.PI / 180;
  var ux = Math.cos(sa), uz = Math.sin(sa);
  var tx = -Math.sin(sa), tz = Math.cos(sa);
  for (var s2 = 0; s2 < 10; s2++) {
    var r = 14.15 + s2 * 0.5;
    var y = 2.4 - s2 * 0.24 - 0.15;
    box('stone', 0.6, 0.3, 5.2, ux * r, y, uz * r, -sa);
  }
  // 垂带石
  var Bs = beamBasis(ux * 14.0, 0.0, uz * 14.0, ux * 18.7, 2.4, uz * 18.7, sa);
  boxBasis('stoneD', Bs[0], Bs[1], Bs[2], Bs[3], Bs[4], Bs[5], Bs[6], Bs[7], Bs[8],
    ux * 16.35 + tx * 2.75, 1.2, uz * 16.35 + tz * 2.75, Bs[9], 0.22, 0.5);
  boxBasis('stoneD', Bs[0], Bs[1], Bs[2], Bs[3], Bs[4], Bs[5], Bs[6], Bs[7], Bs[8],
    ux * 16.35 - tx * 2.75, 1.2, uz * 16.35 - tz * 2.75, Bs[9], 0.22, 0.5);
}

// ---------------- 柱网（筒中筒：外槽24柱 + 内槽16柱） ----------------
var ST = [ // [外槽R, 内槽R, 柱底, 柱顶, 柱径]
  [11.0, 6.8,  2.4, 11.0, 0.44],
  [10.0, 6.2, 11.0, 23.4, 0.41],
  [ 9.1, 5.7, 23.4, 34.6, 0.38],
  [ 8.3, 5.2, 34.6, 44.6, 0.35],
  [ 7.5, 4.7, 44.6, 53.4, 0.32]
];
for (var si = 0; si < ST.length; si++) {
  var so = ST[si][0], siR = ST[si][1], yb = ST[si][2], yt = ST[si][3], cr = ST[si][4];
  for (var ci = 0; ci < 24; ci++) {
    var ca = ci * Math.PI / 12;
    cyl('wood', cr, yt - yb, Math.cos(ca) * so, (yb + yt) / 2, Math.sin(ca) * so);
  }
  for (var cj = 0; cj < 16; cj++) {
    var ia = cj * Math.PI / 8;
    cyl('wood', cr * 0.82, yt - yb, Math.cos(ia) * siR, (yb + yt) / 2, Math.sin(ia) * siR);
  }
  if (si === 0) { // 首层柱础
    for (var cb = 0; cb < 24; cb++) {
      var ba = cb * Math.PI / 12;
      cyl('stoneD', cr * 1.4, 0.35, Math.cos(ba) * so, yb + 0.175, Math.sin(ba) * so);
    }
  }
}
// 副阶（底层抱厦）24柱
for (var pi = 0; pi < 24; pi++) {
  var pa = pi * Math.PI / 12;
  cyl('wood', 0.42, 3.8, Math.cos(pa) * 13.0, 2.4 + 1.9, Math.sin(pa) * 13.0);
  cyl('stoneD', 0.58, 0.35, Math.cos(pa) * 13.0, 2.575, Math.sin(pa) * 13.0);
}
// 副阶阑额
for (var ai = 0; ai < 24; ai++) {
  var am2 = (ai + 0.5) * Math.PI / 12;
  var rMid = 13.0 * Math.cos(Math.PI / 24);
  box('woodD', 0.42, 0.38, chord(13.0, 24), Math.cos(am2) * rMid, 5.95, Math.sin(am2) * rMid, -(am2 + Math.PI / 2));
}

// ---------------- 明层：墙体 / 门 / 直棂窗 / 阑额 ----------------
// 层：[楼层面, 层顶, 外槽R, 类型]
var stories = [
  [2.4,  11.0, 11.0, 'door'],
  [16.6, 23.4, 10.0, 'win'],
  [28.6, 34.6,  9.1, 'win'],
  [39.4, 44.6,  8.3, 'win'],
  [48.8, 53.4,  7.5, 'win']
];
for (var hi = 0; hi < stories.length; hi++) {
  var f0 = stories[hi][0], f1 = stories[hi][1], Rs = stories[hi][2], kind = stories[hi][3];
  var ap = Rs * Math.cos(Math.PI / 8);
  var chordF = chord(Rs, 8);
  var H = f1 - 0.35 - f0;
  for (var fi = 0; fi < 8; fi++) {
    if (kind === 'door') {
      var w = 2.6, h = 4.6, yB = f0 + 0.02;
      faceBox('wall', fi, ap, f0 + H / 2, (chordF - w) / 2, H, 0.3, -(w / 2 + (chordF - w) / 4));
      faceBox('wall', fi, ap, f0 + H / 2, (chordF - w) / 2, H, 0.3, (w / 2 + (chordF - w) / 4));
      faceBox('wall', fi, ap, yB + h + (f1 - 0.35 - yB - h) / 2, w + 0.3, f1 - 0.35 - yB - h, 0.3, 0);
      faceBox('dark', fi, ap - 0.18, yB + h / 2, w, h, 0.1, 0);
      faceBox('woodD', fi, ap + 0.20, yB + h / 2 - 0.05, 1.12, h - 0.3, 0.12, -0.62);
      faceBox('woodD', fi, ap + 0.20, yB + h / 2 - 0.05, 1.12, h - 0.3, 0.12, 0.62);
      faceBox('woodD', fi, ap + 0.16, yB + h + 0.09, w + 0.5, 0.18, 0.22, 0);
      faceBox('woodD', fi, ap + 0.16, yB + h / 2, 0.15, h, 0.22, -(w / 2 + 0.1));
      faceBox('woodD', fi, ap + 0.16, yB + h / 2, 0.15, h, 0.22, (w / 2 + 0.1));
    } else {
      var w2 = chordF * 0.58, h2 = Math.min(3.8, H * 0.55), sill = f0 + 0.95;
      var yT2 = f1 - 0.35;
      faceBox('wall', fi, ap, f0 + H / 2, (chordF - w2) / 2, H, 0.3, -(w2 / 2 + (chordF - w2) / 4));
      faceBox('wall', fi, ap, f0 + H / 2, (chordF - w2) / 2, H, 0.3, (w2 / 2 + (chordF - w2) / 4));
      faceBox('wall', fi, ap, sill - 0.15, w2 + 0.2, 0.3, 0.3, 0);
      faceBox('wall', fi, ap, sill + h2 + (yT2 - sill - h2) / 2, w2 + 0.2, yT2 - sill - h2, 0.3, 0);
      faceBox('dark', fi, ap - 0.18, sill + h2 / 2, w2, h2, 0.1, 0);
      var nB = Math.max(5, Math.round(w2 / 0.34));
      for (var bj = 0; bj < nB; bj++) {
        var off = -w2 / 2 + (bj + 0.5) * w2 / nB;
        faceBox('woodD', fi, ap - 0.06, sill + h2 / 2, 0.1, h2, 0.1, off);
      }
      faceBox('woodD', fi, ap - 0.06, sill + 0.14, w2, 0.15, 0.15, 0);
      faceBox('woodD', fi, ap - 0.06, sill + h2 - 0.14, w2, 0.15, 0.15, 0);
      faceBox('woodD', fi, ap + 0.16, sill + h2 + 0.09, w2 + 0.4, 0.16, 0.22, 0);
      faceBox('woodD', fi, ap + 0.16, sill + 0.08, w2 + 0.4, 0.16, 0.22, 0);
      faceBox('woodD', fi, ap + 0.16, sill + h2 / 2, 0.14, h2, 0.22, -(w2 / 2 + 0.08));
      faceBox('woodD', fi, ap + 0.16, sill + h2 / 2, 0.14, h2, 0.22, (w2 / 2 + 0.08));
    }
  }
  // 阑额（柱顶环枋）
  for (var li = 0; li < 8; li++) {
    faceBox('woodD', li, ap + 0.12, f1 - 0.18, chordF + 0.2, 0.34, 0.4, 0);
  }
}

// ---------------- 暗层：红墙 + X形斜撑 + 短柱 ----------------
for (var di = 1; di <= 4; di++) {
  var yB3 = ST[di - 1][3];            // 上一层明层顶
  var yT3 = ST[di][3];                // 本暗层顶=下一明层楼面
  var Rb = ST[di][0] - 1.0;           // 暗层壁面（收进1米）
  var apb = Rb * Math.cos(Math.PI / 8);
  var Hb = yT3 - yB3;
  var chordB = chord(Rb, 8);
  for (var bi = 0; bi < 8; bi++) {
    faceBox('band', bi, apb, yB3 + Hb / 2, chordB, Hb, 0.24, 0);
  }
  var apBr = apb + 0.2;
  for (var xi = 0; xi < 8; xi++) {
    var a0 = xi * Math.PI / 4, a1 = (xi + 1) * Math.PI / 4, am3 = (a0 + a1) / 2;
    var x0 = Math.cos(a0) * apBr, z0 = Math.sin(a0) * apBr;
    var x1 = Math.cos(a1) * apBr, z1 = Math.sin(a1) * apBr;
    var y0 = yB3 + 0.15, y1 = yB3 + Hb - 0.15;
    var B1 = beamBasis(x0, y0, z0, x1, y1, z1, am3);
    boxBasis('woodD', B1[0], B1[1], B1[2], B1[3], B1[4], B1[5], B1[6], B1[7], B1[8],
      (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, B1[9] + 0.4, 0.26, 0.34);
    var B2 = beamBasis(x1, y0, z1, x0, y1, z0, am3);
    boxBasis('woodD', B2[0], B2[1], B2[2], B2[3], B2[4], B2[5], B2[6], B2[7], B2[8],
      (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, B2[9] + 0.4, 0.26, 0.34);
    faceBox('woodD', xi, apBr, yB3 + Hb / 2, chordB, 0.22, 0.3, 0);
    faceBox('woodD', xi, apBr, yB3 + Hb * 0.3, 0.3, Hb * 0.5, 0.3, 0);
  }
}

// ---------------- 梁架与楼板（各结构层界面） ----------------
var LEVELS = [11.0, 16.6, 23.4, 28.6, 34.6, 39.4, 44.6, 48.8, 53.4];
for (var li2 = 0; li2 < LEVELS.length; li2++) {
  var yL = LEVELS[li2];
  var stack = ST[Math.min(li2, 4)];
  var Ro = stack[0], Ri = stack[1];
  var rEdge = Ro + 2.6;
  slab(rEdge + 0.2, Ri - 1.1).position.y = yL - 0.32;
  // 外槽环枋（24）
  for (var ri = 0; ri < 24; ri++) {
    var aa = (ri + 0.5) * Math.PI / 12;
    box('woodD', 0.5, 0.45, chord(Ro, 24), Math.cos(aa) * Ro * Math.cos(Math.PI / 24), yL - 0.5,
      Math.sin(aa) * Ro * Math.cos(Math.PI / 24), -(aa + Math.PI / 2));
  }
  // 内槽环枋（16）
  for (var rj = 0; rj < 16; rj++) {
    var ab = (rj + 0.5) * Math.PI / 8;
    box('woodD', 0.4, 0.4, chord(Ri, 16), Math.cos(ab) * Ri * Math.cos(Math.PI / 16), yL - 0.45,
      Math.sin(ab) * Ri * Math.cos(Math.PI / 16), -(ab + Math.PI / 2));
  }
  // 径向梁：外槽24
  for (var rk = 0; rk < 24; rk++) {
    var ac = rk * Math.PI / 12;
    var rl = Ro - Ri;
    box('woodD', rl, 0.38, 0.34, Math.cos(ac) * (Ri + rl / 2), yL - 0.5, Math.sin(ac) * (Ri + rl / 2), -ac);
  }
  // 径向梁：外挑至廊沿8
  for (var rm = 0; rm < 8; rm++) {
    var ad = (rm + 0.5) * Math.PI / 4;
    var rl2 = rEdge - Ro;
    box('woodD', rl2, 0.32, 0.3, Math.cos(ad) * (Ro + rl2 / 2), yL - 0.55, Math.sin(ad) * (Ro + rl2 / 2), -ad);
  }
}

// ---------------- 斗拱铺作 ----------------
var eaveScale = [1.0, 0.94, 0.88, 0.82, 0.76];
for (var ki = 0; ki < 5; ki++) {
  var top_k = ST[ki][3], Ro2 = ST[ki][0], Ri2 = ST[ki][1], rEd = Ro2 + 2.6;
  dougongRing(Ro2, 24, top_k, eaveScale[ki]);            // 外槽柱头铺作
  dougongRing(Ri2, 16, top_k, eaveScale[ki] * 0.9);      // 内槽柱头铺作
  dougongRing(rEd, 24, top_k - 0.78, 0.5);               // 外廊挑檐铺作
}
dougongRing(13.0, 24, 6.2, 0.85);                          // 副阶铺作

// ---------------- 六重檐 ----------------
eave(10.4, 8.0,  15.9, 6.4,  1.15);  // 副阶檐
eave(10.4, 12.5, 13.6, 11.1, 1.0);   // 第一重檐
eave( 9.4, 24.95, 12.6, 23.55, 0.9); // 第二重檐
eave( 8.5, 36.15, 11.7, 34.75, 0.8); // 第三重檐
eave( 7.7, 46.15, 10.9, 44.75, 0.7); // 第四重檐
eave( 6.9, 54.95, 10.1, 53.55, 0.85);// 顶檐下段
eave(10.1, 53.6,   0.8, 59.0,  0.3); // 攒尖上段

// ---------------- 外廊栏杆（二至五层） ----------------
var floors = [16.6, 28.6, 39.4, 48.8];
for (var fi2 = 0; fi2 < floors.length; fi2++) {
  var yF = floors[fi2];
  var rR = ST[fi2 + 1][0] + 2.45;
  var L = chord(rR, 8);
  for (var si2 = 0; si2 < 8; si2++) {
    var a0b = si2 * Math.PI / 4, am4 = (si2 + 0.5) * Math.PI / 4;
    var mx = Math.cos(am4) * rR * Math.cos(Math.PI / 8);
    var mz = Math.sin(am4) * rR * Math.cos(Math.PI / 8);
    box('rail', L, 0.13, 0.1, mx, yF + 1.02, mz, -(am4 + Math.PI / 2));
    box('rail', L, 0.08, 0.07, mx, yF + 0.62, mz, -(am4 + Math.PI / 2));
    box('rail', L, 0.12, 0.12, mx, yF + 0.1, mz, -(am4 + Math.PI / 2));
    var nBal = Math.max(3, Math.round(L / 0.8));
    for (var bj2 = 0; bj2 < nBal; bj2++) {
      var off2 = -L / 2 + (bj2 + 0.5) * L / nBal;
      var bx = mx - Math.sin(am4) * off2;
      var bz = mz + Math.cos(am4) * off2;
      box('rail', 0.06, 0.82, 0.06, bx, yF + 0.56, bz, 0);
    }
    var cx = Math.cos(a0b) * rR, cz = Math.sin(a0b) * rR;
    box('rail', 0.15, 1.1, 0.15, cx, yF + 0.55, cz, -a0b);
  }
}

// ---------------- 塔刹 ----------------
(function finial() {
  var g = new THREE.Group();
  function add(geo, mat, y) {
    var m = new THREE.Mesh(geo, mat);
    m.position.y = y; m.castShadow = true;
    g.add(m); return m;
  }
  add(new THREE.CylinderGeometry(2.0, 2.3, 0.4, 8), MATS.stoneD, 59.2);
  add(new THREE.CylinderGeometry(0.22, 0.3, 5.6, 8), MATS.iron, 62.0);
  for (var i = 0; i < 5; i++) {
    add(new THREE.CylinderGeometry(1.5 - i * 0.16, 1.5 - i * 0.16, 0.16, 12), MATS.iron, 61.2 + i * 0.75);
  }
  add(new THREE.SphereGeometry(0.55, 16, 12), MATS.gold, 65.2);
  add(new THREE.CylinderGeometry(0.04, 0.1, 0.7, 6), MATS.iron, 65.9);
  scene.add(g);
})();

// ---------------- 一层佛像 ----------------
(function buddha() {
  var g = new THREE.Group();
  function add(geo, y, sx, sy, sz) {
    var m = new THREE.Mesh(geo, MATS.gold);
    m.position.y = y;
    if (sx) m.scale.set(sx, sy, sz);
    m.castShadow = true;
    g.add(m); return m;
  }
  add(new THREE.CylinderGeometry(2.6, 2.9, 0.35, 12), 2.58);
  add(new THREE.CylinderGeometry(2.1, 2.4, 0.55, 12), 3.0);
  add(new THREE.SphereGeometry(1.55, 18, 14), 4.6, 1, 1.35, 0.8);
  add(new THREE.SphereGeometry(0.78, 16, 12), 6.15);
  add(new THREE.SphereGeometry(0.28, 10, 8), 7.0);
  scene.add(g);
})();

// ---------------- 地面 ----------------
(function ground() {
  var g1 = new THREE.Mesh(new THREE.CircleGeometry(180, 48), MATS.ground);
  g1.rotation.x = -Math.PI / 2; g1.position.y = -0.05;
  g1.receiveShadow = true;
  var g2 = new THREE.Mesh(new THREE.CircleGeometry(27, 8), MATS.court);
  g2.rotation.x = -Math.PI / 2; g2.rotation.z = Math.PI / 8;
  g2.position.y = 0.0;
  g2.receiveShadow = true;
  scene.add(g1); scene.add(g2);
})();

// ---------------- 实例化输出 ----------------
function flush() {
  for (var k in buckets) {
    var b = buckets[k];
    var im = new THREE.InstancedMesh(boxGeo, b.mat, b.list.length);
    b.list.forEach(function (m, i) { im.setMatrixAt(i, m); });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = true;
    im.receiveShadow = true;
    scene.add(im);
  }
}
flush();

// ---------------- 主循环 ----------------
addEventListener('resize', function () {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
renderer.setAnimationLoop(function () {
  controls.update();
  renderer.render(scene, camera);
});
})();
