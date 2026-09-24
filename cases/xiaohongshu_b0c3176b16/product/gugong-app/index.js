import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { createSceneControls } from "./src/sceneControls.js";

/* ============================================================
 * 紫禁城 · 夜景漫游 — Vision-to-CAD 程序化重建
 * 坐标约定: x 东西, z 南北(南为正), y 高度
 * ============================================================ */

const RENDER_FPS = 30;
const RENDER_TIMELINE_TOTAL_FRAMES = 900; // 渲染帧数由 URL ?frames= 覆盖(匹配解说音频时长)
const TIMELINE_DURATION_MS = (RENDER_TIMELINE_TOTAL_FRAMES / RENDER_FPS) * 1000;
const EXPORT_WIDTH = 720;
const EXPORT_HEIGHT = 1280; // 9:16 竖屏
const EXPORT_ASPECT_RATIO = EXPORT_WIDTH / EXPORT_HEIGHT;
const EXPORT_RENDER_SCALES = new Set([1, 2]);
const DEFAULT_EXPORT_RENDER_SCALE = 1;
const ZIP_VERSION_NEEDED = 20;
const ZIP_STORE_METHOD = 0;
const TWO_PI = Math.PI * 2;
const SQRT1_2 = Math.SQRT1_2;

const query = new URLSearchParams(window.location.search);
const requestedFrames = query.has("frames") ? Number(query.get("frames")) : NaN;
const FRAME_COUNT = Number.isFinite(requestedFrames)
  ? THREE.MathUtils.clamp(Math.round(requestedFrames), 30, 2400)
  : RENDER_TIMELINE_TOTAL_FRAMES;
const FRAME_DURATION_MS = (FRAME_COUNT / RENDER_FPS) * 1000;

const renderOptions = readRenderOptions(query);

/* ---------------- renderer / scene / camera ---------------- */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04070f);
scene.fog = new THREE.FogExp2(0x060a16, 0.004);

const camera = new THREE.PerspectiveCamera(55, EXPORT_ASPECT_RATIO, 0.1, 600);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.domElement.className = "webgl-canvas scene-canvas";

const app = getRequiredElement("#app");
const previewShell = getRequiredElement("#preview-shell");
previewShell.prepend(renderer.domElement);

applyRenderLayout();

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 8, 30);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.62;
controls.minDistance = 2;
controls.maxDistance = 220;
controls.enabled = false;

/* ---------------- 静态几何收集器(按材质合并, 减少 draw call) ---------------- */

const roofGeos = [];
const wallGeos = [];
const stoneGeos = [];
const goldGeos = [];
const darkGeos = [];
const windowGeos = [];
const treeTrunkGeos = [];
const treeCrownGeos = [];

function pushBox(list, w, h, d, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  list.push(g);
}

function pushCylinder(list, rt, rb, h, x, y, z, seg = 8) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y, z);
  list.push(g);
}

function pushConeRoof(list, halfW, halfD, h, x, y, z) {
  const r = halfW / SQRT1_2;
  const g = new THREE.ConeGeometry(r, h, 4);
  g.rotateY(Math.PI / 4);
  g.scale(halfD / halfW, 1, 1);
  g.translate(x, y + h / 2, z);
  list.push(g);
}

function pushRidge(list, ax, ay, az, bx, by, bz, t = 0.14) {
  const dir = new THREE.Vector3(bx - ax, by - ay, bz - az);
  const len = dir.length();
  const g = new THREE.BoxGeometry(t, len, t);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize()
  );
  g.applyQuaternion(q);
  g.translate(ax, ay, az);
  list.push(g);
}

/* ---------------- 材质 ---------------- */

const matRoof = new THREE.MeshStandardMaterial({
  color: 0x8a6414,
  emissive: 0xf0b23e,
  emissiveIntensity: 0.52,
  metalness: 0.55,
  roughness: 0.42,
});
const matWall = new THREE.MeshStandardMaterial({
  color: 0x7c211a,
  emissive: 0x5a1610,
  emissiveIntensity: 0.55,
  roughness: 0.72,
});
const matWindow = new THREE.MeshStandardMaterial({
  color: 0x8a5a20,
  emissive: 0xffc36a,
  emissiveIntensity: 2.1,
  roughness: 0.6,
});
const matStone = new THREE.MeshStandardMaterial({
  color: 0x8d97a3,
  emissive: 0x232b36,
  emissiveIntensity: 0.42,
  metalness: 0.18,
  roughness: 0.62,
});
const matGold = new THREE.MeshStandardMaterial({
  color: 0xd9a441,
  emissive: 0xffd76a,
  emissiveIntensity: 1.05,
  metalness: 0.65,
  roughness: 0.32,
});
const matDark = new THREE.MeshStandardMaterial({
  color: 0x0c0d12,
  emissive: 0x05060a,
  emissiveIntensity: 0.2,
  roughness: 0.9,
});
const matTrunk = new THREE.MeshStandardMaterial({
  color: 0x3a2a1c,
  roughness: 0.95,
});
const matCrown = new THREE.MeshStandardMaterial({
  color: 0x0e2013,
  emissive: 0x081a0e,
  emissiveIntensity: 0.45,
  roughness: 0.9,
});

/* ---------------- 匾额文字纹理 ---------------- */

const nameTextureCache = new Map();
function makeNameTexture(text) {
  if (nameTextureCache.has(text)) return nameTextureCache.get(text);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#120b06";
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = "#c9a24a";
  ctx.lineWidth = 6;
  ctx.strokeRect(7, 7, 242, 114);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = text.length <= 3 ? 64 : text.length === 4 ? 52 : 42;
  ctx.font = `700 ${size}px "PingFang SC", "Microsoft YaHei", serif`;
  ctx.shadowColor = "rgba(255, 210, 110, 0.9)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#f3d489";
  ctx.fillText(text, 128, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  nameTextureCache.set(text, texture);
  return texture;
}

/* ---------------- 殿宇构建 ---------------- */

function buildHall({
  w,
  d,
  baseTiers = 2,
  baseTierH = 0.9,
  tierInset = 0.9,
  wallH = 6,
  tiers = 1,
  roofHs = [3.2],
  eave = 2.2,
  style = "hip", // hip(庑殿) | pyramidal(攒尖)
  name = "",
}) {
  let y = 0;
  let halfW = w / 2;
  let halfD = d / 2;
  for (let i = 0; i < baseTiers; i += 1) {
    pushBox(stoneGeos, halfW * 2, baseTierH, halfD * 2, 0, y + baseTierH / 2, 0);
    y += baseTierH;
    halfW -= tierInset;
    halfD -= tierInset;
  }
  // 台基栏杆: 四周压顶 + 望柱
  pushBox(stoneGeos, halfW * 2 + 0.5, 0.28, halfD * 2 + 0.5, 0, y + 0.14, 0);
  const baluster = Math.max(2, Math.round(halfW * 2 / 2.2));
  for (let i = 0; i <= baluster; i += 1) {
    const bx = -halfW + (i / baluster) * halfW * 2;
    pushBox(stoneGeos, 0.32, 0.85, 0.32, bx, y + 0.7, -halfD - 0.22);
    pushBox(stoneGeos, 0.32, 0.85, 0.32, bx, y + 0.7, halfD + 0.22);
  }
  const balusterD = Math.max(2, Math.round(halfD * 2 / 2.2));
  for (let i = 1; i < balusterD; i += 1) {
    const bz = -halfD + (i / balusterD) * halfD * 2;
    pushBox(stoneGeos, 0.32, 0.85, 0.32, -halfW - 0.22, y + 0.7, bz);
    pushBox(stoneGeos, 0.32, 0.85, 0.32, halfW + 0.22, y + 0.7, bz);
  }

  // 屋身
  const wallBaseY = y;
  pushBox(wallGeos, w, wallH, d, 0, wallBaseY + wallH / 2, 0);
  let roofBaseY = wallBaseY + wallH;

  // 前檐立柱 + 斗拱带(金色)
  const colCount = Math.max(4, Math.round(w / 2.4));
  for (let i = 0; i < colCount; i += 1) {
    const cx = -w / 2 + (i / (colCount - 1)) * w;
    pushBox(goldGeos, 0.34, wallH * 0.92, 0.34, cx, wallBaseY + wallH * 0.46, d / 2 + 0.55);
  }
  pushBox(goldGeos, w + 1.2, 0.5, 0.9, 0, roofBaseY - 0.25, d / 2 + 0.55);
  const dogong = Math.round(w / 0.9);
  for (let i = 0; i < dogong; i += 1) {
    const gx = -w / 2 + (i / (dogong - 1)) * w;
    pushBox(goldGeos, 0.42, 0.42, 1.4, gx, roofBaseY + 0.1, d / 2 + 0.9);
  }

  // 灯火窗棂(发光窗带)
  for (const wy of [0.3, 0.58]) {
    const winCount = Math.max(3, Math.round(w / 1.7));
    for (let i = 0; i < winCount; i += 1) {
      const wx = -w / 2 + ((i + 0.5) / winCount) * w;
      pushBox(windowGeos, 0.72, wallH * 0.2, 0.14, wx, wallBaseY + wallH * wy, d / 2 + 0.1);
    }
  }

  // 匾额(正面)
  if (name) {
    const tex = makeNameTexture(name);
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(w * 0.42, 5.2), Math.min(w * 0.42, 5.2) * 0.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: false })
    );
    plaque.position.set(0, wallBaseY + wallH * 0.62, d / 2 + 0.62);
    dynamicMeshes.push(plaque);
  }

  // 屋顶层
  let topY = roofBaseY;
  for (let t = 0; t < tiers; t += 1) {
    const layerW = w + eave * 2 - t * (style === "pyramidal" ? 2.5 : 3.5);
    const layerD = d + eave * 2 - t * (style === "pyramidal" ? 2.5 : 3.5);
    const rh = roofHs[Math.min(t, roofHs.length - 1)];
    const lw = Math.max(layerW / 2, 1.2);
    const ld = Math.max(layerD / 2, 1.2);
    pushConeRoof(roofGeos, lw, ld, rh, 0, topY, 0);
    // 垂脊(檐角 -> 顶)
    const topLocalY = topY + rh;
    const corners = [
      [-lw, -ld],
      [lw, -ld],
      [lw, ld],
      [-lw, ld],
    ];
    for (const [cx, cz] of corners) {
      pushRidge(goldGeos, cx, topY + 0.12, cz, cx * 0.16, topLocalY - 0.3, cz * 0.16, 0.13);
    }
    if (style === "pyramidal") {
      pushCylinder(goldGeos, 0.16, 0.22, 1.4, 0, topLocalY + 0.5, 0, 6);
      const jewel = new THREE.SphereGeometry(0.42, 8, 6);
      jewel.translate(0, topLocalY + 1.35, 0);
      goldGeos.push(jewel);
    } else {
      // 正脊 + 鸱吻
      const ridgeLen = Math.min(lw * 1.15, 9);
      pushBox(goldGeos, ridgeLen, 0.55, 0.7, 0, topLocalY + 0.18, 0);
      pushBox(goldGeos, 0.6, 1.15, 0.9, -ridgeLen / 2 + 0.2, topLocalY + 0.6, 0);
      pushBox(goldGeos, 0.6, 1.15, 0.9, ridgeLen / 2 - 0.2, topLocalY + 0.6, 0);
    }
    topY += rh;
    // 重檐之间的腰檐墙
    if (t < tiers - 1) {
      const waistH = 1.6;
      pushBox(wallGeos, layerW - 1.6, waistH, layerD - 1.6, 0, topY + waistH / 2, 0);
      topY += waistH;
    }
  }
  return topY;
}

const dynamicMeshes = [];

/* ---------------- 城门 ---------------- */

/* 直接以坐标构建的城门(先建于原点, 再由 placeGroupAt 平移) */
function buildGateAt({ w = 30, d = 9, baseH = 4.5, wallH = 6.5, tiers = 2, roofHs = [3, 4.2], eave = 2.4, name = "", doors = 3, facing = 1 }) {
  // 台基(城台): 用门柱+过梁拼出真实门洞, 相机可穿行
  const doorW = w / (doors * 2.2);
  const doorH = baseH * 0.78;
  const pierTops = [];
  for (let i = 0; i < doors; i += 1) {
    const dx = (i - (doors - 1) / 2) * doorW * 2.2;
    pierTops.push([dx - doorW / 2, dx + doorW / 2]);
  }
  // 门柱(门洞之间与两侧)
  let prevEdge = -w / 2;
  const pierSpans = [];
  for (const [a, b] of pierTops) {
    pierSpans.push([prevEdge, a]);
    prevEdge = b;
  }
  pierSpans.push([prevEdge, w / 2]);
  for (const [a, b] of pierSpans) {
    const pw = b - a;
    if (pw <= 0.05) continue;
    pushBox(stoneGeos, pw, baseH, d, (a + b) / 2, baseH / 2, 0);
  }
  // 过梁(门洞上方)
  pushBox(stoneGeos, w, baseH - doorH, d, 0, doorH + (baseH - doorH) / 2, 0);
  // 城台顶栏杆
  pushBox(stoneGeos, w + 0.4, 0.3, d + 0.4, 0, baseH + 0.15, 0);
  // 主楼
  buildHallOn({
    w: w * 0.62,
    d: d * 0.72,
    baseTiers: 1,
    baseTierH: 0.5,
    wallH,
    tiers,
    roofHs,
    eave,
    name,
    facing,
  });
}

/* 在指定几何数组上建殿(城门用) */
function buildHallOn(opts) {
  const { w, d, wallH, tiers = 1, roofHs = [3.2], eave = 2.2, baseTierH = 0.5, name = "", facing = 1 } = opts;
  let y = 0;
  pushBox(stoneGeos, w, baseTierH, d, 0, y + baseTierH / 2, 0);
  y += baseTierH;
  pushBox(wallGeos, w, wallH, d, 0, y + wallH / 2, 0);
  const roofBaseY = y + wallH;
  const colCount = Math.max(4, Math.round(w / 2.4));
  for (let i = 0; i < colCount; i += 1) {
    const cx = -w / 2 + (i / Math.max(1, colCount - 1)) * w;
    pushBox(goldGeos, 0.3, wallH * 0.9, 0.3, cx, y + wallH * 0.45, facing * (d / 2 + 0.4));
  }
  pushBox(goldGeos, w + 1, 0.45, 0.8, 0, roofBaseY - 0.22, facing * (d / 2 + 0.4));
  // 灯火窗棂
  for (const wy of [0.3, 0.58]) {
    const winCount = Math.max(3, Math.round(w / 1.7));
    for (let i = 0; i < winCount; i += 1) {
      const wx = -w / 2 + ((i + 0.5) / winCount) * w;
      pushBox(windowGeos, 0.72, wallH * 0.2, 0.14, wx, y + wallH * wy, facing * (d / 2 + 0.1));
    }
  }
  if (name) {
    const tex = makeNameTexture(name);
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(w * 0.4, 4.6), Math.min(w * 0.4, 4.6) * 0.5),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    plaque.position.set(0, y + wallH * 0.6, facing * (d / 2 + 0.46));
    if (facing < 0) plaque.rotation.y = Math.PI;
    dynamicMeshes.push(plaque);
  }
  let topY = roofBaseY;
  for (let t = 0; t < tiers; t += 1) {
    const lw = (w + eave * 2 - t * 3.2) / 2;
    const ld = (d + eave * 2 - t * 3.2) / 2;
    const rh = roofHs[Math.min(t, roofHs.length - 1)];
    pushConeRoof(roofGeos, lw, ld, rh, 0, topY, 0);
    const topLocalY = topY + rh;
    for (const [cx, cz] of [[-lw, -ld], [lw, -ld], [lw, ld], [-lw, ld]]) {
      pushRidge(goldGeos, cx, topY + 0.1, cz, cx * 0.16, topLocalY - 0.25, cz * 0.16, 0.12);
    }
    const ridgeLen = Math.min(lw * 1.1, 8);
    pushBox(goldGeos, ridgeLen, 0.5, 0.62, 0, topLocalY + 0.15, 0);
    pushBox(goldGeos, 0.55, 1.05, 0.8, -ridgeLen / 2 + 0.18, topLocalY + 0.5, 0);
    pushBox(goldGeos, 0.55, 1.05, 0.8, ridgeLen / 2 - 0.18, topLocalY + 0.5, 0);
    topY += rh;
    if (t < tiers - 1) {
      pushBox(wallGeos, lw * 2 - 1.4, 1.5, ld * 2 - 1.4, 0, topY + 0.75, 0);
      topY += 1.5;
    }
  }
  return topY;
}

/* ---------------- 角楼 ---------------- */

function buildCornerTower(x, z) {
  markBuildStart();
  pushBox(stoneGeos, 11, 6.5, 11, 0, 3.25, 0);
  let y = 6.5;
  pushBox(wallGeos, 9, 3, 9, 0, y + 1.5, 0);
  y += 3;
  pushConeRoof(roofGeos, 6.4, 6.4, 2.6, 0, y, 0);
  y += 2.6;
  pushBox(wallGeos, 7, 2.2, 7, 0, y + 1.1, 0);
  y += 2.2;
  pushConeRoof(roofGeos, 4.9, 4.9, 3.4, 0, y, 0);
  y += 3.4;
  pushConeRoof(roofGeos, 2.6, 2.6, 3.6, 0, y, 0);
  y += 3.6;
  pushCylinder(goldGeos, 0.14, 0.2, 1.6, 0, y + 0.7, 0, 6);
  const jewel = new THREE.SphereGeometry(0.4, 8, 6);
  jewel.translate(0, y + 1.6, 0);
  goldGeos.push(jewel);
  placeGroupAt(x, z);
}

/* ---------------- 树木 ---------------- */

const treeSpots = []; // {x, z, kind, lit}
function addTree(x, z, kind = "pine", lit = false) {
  treeSpots.push({ x, z, kind, lit });
}

/* ---------------- 场景组装 ---------------- */

const gugong = new THREE.Group();
scene.add(gugong);

function buildStaticCity() {
  // 地面
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 460),
    new THREE.MeshStandardMaterial({ color: 0x0d1017, roughness: 0.92, metalness: 0.08 })
  );
  ground.rotation.x = -Math.PI / 2;
  gugong.add(ground);

  // 中轴御道广场
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 168),
    new THREE.MeshStandardMaterial({ color: 0x232833, roughness: 0.42, metalness: 0.35 })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.04, 0);
  gugong.add(plaza);
  // 中轴石板带
  const axis = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 168),
    new THREE.MeshStandardMaterial({
      color: 0x4a4238,
      roughness: 0.35,
      metalness: 0.3,
      emissive: 0x1a140c,
      emissiveIntensity: 0.35,
    })
  );
  axis.rotation.x = -Math.PI / 2;
  axis.position.set(0, 0.08, 0);
  gugong.add(axis);

  // 三大殿大广场
  const outerCourt = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 44),
    new THREE.MeshStandardMaterial({ color: 0x1f242e, roughness: 0.45, metalness: 0.3 })
  );
  outerCourt.rotation.x = -Math.PI / 2;
  outerCourt.position.set(0, 0.05, 24);
  gugong.add(outerCourt);

  // 内金水河(微弧条带, 位于太和门前)
  const riverPts = [];
  const riverW = 3.6;
  for (let x = -18; x <= 18; x += 1.5) {
    const zc = 50 + 1.6 * (x / 18) * (x / 18);
    riverPts.push(new THREE.Vector2(x, -(zc + riverW / 2)));
  }
  for (let x = 18; x >= -18; x -= 1.5) {
    const zc = 50 + 1.6 * (x / 18) * (x / 18);
    riverPts.push(new THREE.Vector2(x, -(zc - riverW / 2)));
  }
  const riverShape = new THREE.Shape(riverPts);
  const riverGeo = new THREE.ShapeGeometry(riverShape);
  riverGeo.rotateX(-Math.PI / 2);
  const river = new THREE.Mesh(
    riverGeo,
    new THREE.MeshStandardMaterial({
      color: 0x0d2c4a,
      emissive: 0x1a5a8a,
      emissiveIntensity: 0.8,
      roughness: 0.15,
      metalness: 0.7,
      side: THREE.DoubleSide,
    })
  );
  river.position.y = 0.1;
  gugong.add(river);

  // 五座内金水桥
  for (const bx of [-12, -6, 0, 6, 12]) {
    const bz = 50 + 1.6 * (bx / 18) * (bx / 18);
    pushBox(stoneGeos, 3.2, 0.7, 8.6, bx, 0.5, bz);
    pushBox(stoneGeos, 3.7, 0.3, 9.0, bx, 0.95, bz);
    for (const rz of [-3.6, 3.6]) {
      pushBox(stoneGeos, 3.7, 0.55, 0.35, bx, 1.25, bz + rz);
    }
  }

  // 城墙
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x6e1f18,
    emissive: 0x38100c,
    emissiveIntensity: 0.35,
    roughness: 0.8,
  });
  const wallN = new THREE.Mesh(new THREE.BoxGeometry(92, 9, 5), wallMat);
  wallN.position.set(0, 4.5, 88);
  const wallS = wallN.clone();
  wallS.position.z = -88;
  const wallE = new THREE.Mesh(new THREE.BoxGeometry(5, 9, 186), wallMat);
  wallE.position.set(44, 4.5, 0);
  const wallW = wallE.clone();
  wallW.position.x = -44;
  gugong.add(wallN, wallS, wallE, wallW);
  // 城墙顶(灰色城砖)
  const rampartMat = new THREE.MeshStandardMaterial({ color: 0x2b303c, roughness: 0.9 });
  const rampartN = new THREE.Mesh(new THREE.BoxGeometry(92, 1.1, 6.2), rampartMat);
  rampartN.position.set(0, 9.4, 88);
  const rampartS = rampartN.clone();
  rampartS.position.z = -88;
  const rampartE = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.1, 186), rampartMat);
  rampartE.position.set(44, 9.4, 0);
  const rampartW = rampartE.clone();
  rampartW.position.x = -44;
  gugong.add(rampartN, rampartS, rampartE, rampartW);
  // 垛口(女墙) — 用 instanced
  const merlonGeo = new THREE.BoxGeometry(1.0, 1.5, 0.6);
  const merlonCount = Math.floor(186 / 2.6) * 2 + Math.floor(92 / 2.6) * 2;
  const merlons = new THREE.InstancedMesh(merlonGeo, rampartMat, merlonCount);
  const m4 = new THREE.Matrix4();
  let mi = 0;
  for (let z = -90; z <= 90; z += 2.6) {
    m4.makeTranslation(0, 10.4, z + 88);
    merlons.setMatrixAt(mi++, m4);
    m4.makeTranslation(0, 10.4, z - 88);
    merlons.setMatrixAt(mi++, m4);
  }
  for (let x = -45; x <= 45; x += 2.6) {
    m4.makeTranslation(x + 44, 10.4, 0);
    merlons.setMatrixAt(mi++, m4);
    m4.makeTranslation(x - 44, 10.4, 0);
    merlons.setMatrixAt(mi++, m4);
  }
  merlons.count = mi;
  gugong.add(merlons);

  // 护城河(筒子河, 环带)
  const moatShape = new THREE.Shape();
  moatShape.moveTo(-58, -104);
  moatShape.lineTo(58, -104);
  moatShape.lineTo(58, 104);
  moatShape.lineTo(-58, 104);
  moatShape.closePath();
  const moatHole = new THREE.Path();
  moatHole.moveTo(-49, -95);
  moatHole.lineTo(-49, 95);
  moatHole.lineTo(49, 95);
  moatHole.lineTo(49, -95);
  moatHole.closePath();
  moatShape.holes.push(moatHole);
  const moatGeo = new THREE.ShapeGeometry(moatShape);
  moatGeo.rotateX(-Math.PI / 2);
  const moat = new THREE.Mesh(
    moatGeo,
    new THREE.MeshStandardMaterial({
      color: 0x0a2440,
      emissive: 0x14507a,
      emissiveIntensity: 0.85,
      roughness: 0.12,
      metalness: 0.75,
    })
  );
  moat.position.y = 0.08;
  gugong.add(moat);
}

/* 建筑群布局 */
function buildPalace() {
  // —— 外朝 ——
  // 午门(南, 凹字形城台)
  markBuildStart();
  buildGateAt({ w: 40, d: 10, baseH: 5, wallH: 7, tiers: 2, roofHs: [3.2, 4.6], eave: 2.6, name: "午门", doors: 3, facing: 1 });
  placeGroupAt(0, 82);
  // 太和门
  markBuildStart();
  buildHall({ w: 24, d: 10, baseTiers: 2, baseTierH: 1.1, wallH: 6.5, tiers: 1, roofHs: [4.2], eave: 2.6, name: "太和门" });
  placeGroupAt(0, 38);
  // 太和殿(三层汉白玉台基, 重檐庑殿)
  markBuildStart();
  buildHall({ w: 36, d: 21, baseTiers: 3, baseTierH: 1.7, tierInset: 1.1, wallH: 8, tiers: 2, roofHs: [3.6, 5.2], eave: 2.8, name: "太和殿" });
  placeGroupAt(0, 24);
  // 中和殿(四角攒尖)
  markBuildStart();
  buildHall({ w: 15, d: 15, baseTiers: 2, baseTierH: 1.2, tierInset: 0.8, wallH: 5, tiers: 1, roofHs: [6.2], eave: 2.0, style: "pyramidal", name: "中和殿" });
  placeGroupAt(0, 2);
  // 保和殿(单檐庑殿)
  markBuildStart();
  buildHall({ w: 30, d: 19, baseTiers: 2, baseTierH: 1.4, tierInset: 1.0, wallH: 6.5, tiers: 1, roofHs: [5.0], eave: 2.6, name: "保和殿" });
  placeGroupAt(0, -16);

  // 贞度门 / 昭德门
  markBuildStart();
  buildHall({ w: 9, d: 5, baseTiers: 1, baseTierH: 1.0, wallH: 4, tiers: 1, roofHs: [2.4], eave: 1.4, name: "贞度门" });
  placeGroupAt(-14, 44);
  markBuildStart();
  buildHall({ w: 9, d: 5, baseTiers: 1, baseTierH: 1.0, wallH: 4, tiers: 1, roofHs: [2.4], eave: 1.4, name: "昭德门" });
  placeGroupAt(14, 44);

  // 文华殿 / 武英殿
  markBuildStart();
  buildHall({ w: 18, d: 11, baseTiers: 2, baseTierH: 1.1, wallH: 5.5, tiers: 1, roofHs: [3.8], eave: 2.4, name: "文华殿" });
  placeGroupAt(30, 44);
  markBuildStart();
  buildHall({ w: 18, d: 11, baseTiers: 2, baseTierH: 1.1, wallH: 5.5, tiers: 1, roofHs: [3.8], eave: 2.4, name: "武英殿" });
  placeGroupAt(-30, 44);

  // —— 内廷 ——
  markBuildStart();
  buildHall({ w: 17, d: 9, baseTiers: 1, baseTierH: 1.1, wallH: 4.5, tiers: 1, roofHs: [3.0], eave: 2.0, name: "乾清门" });
  placeGroupAt(0, -36);
  markBuildStart();
  buildHall({ w: 26, d: 16, baseTiers: 3, baseTierH: 1.1, tierInset: 0.9, wallH: 6.5, tiers: 2, roofHs: [3.0, 4.2], eave: 2.4, name: "乾清宫" });
  placeGroupAt(0, -52);
  markBuildStart();
  buildHall({ w: 24, d: 15, baseTiers: 2, baseTierH: 1.2, tierInset: 0.9, wallH: 6, tiers: 1, roofHs: [4.0], eave: 2.4, name: "坤宁宫" });
  placeGroupAt(0, -72);
  // 养心殿 / 奉先殿
  markBuildStart();
  buildHall({ w: 13, d: 9, baseTiers: 1, baseTierH: 0.9, wallH: 4.5, tiers: 1, roofHs: [3.0], eave: 1.8, name: "养心殿" });
  placeGroupAt(-14, -38);
  markBuildStart();
  buildHall({ w: 12, d: 9, baseTiers: 1, baseTierH: 0.9, wallH: 4.5, tiers: 1, roofHs: [3.0], eave: 1.8, name: "奉先殿" });
  placeGroupAt(22, -58);

  // 东六宫 / 西六宫(简化小院)
  const palaceNamesE = ["景仁宫", "承乾宫", "钟粹宫", "延禧宫", "永和宫", "景阳宫"];
  const palaceNamesW = ["永寿宫", "翊坤宫", "储秀宫", "咸福宫", "长春宫", "启祥宫"];
  palaceNamesE.forEach((n, i) => {
    markBuildStart();
    buildHall({ w: 11, d: 8, baseTiers: 1, baseTierH: 0.7, wallH: 3.8, tiers: 1, roofHs: [2.6], eave: 1.6, name: n });
    placeGroupAt(26 + (i % 2) * 15, -28 - Math.floor(i / 2) * 13);
  });
  palaceNamesW.forEach((n, i) => {
    markBuildStart();
    buildHall({ w: 11, d: 8, baseTiers: 1, baseTierH: 0.7, wallH: 3.8, tiers: 1, roofHs: [2.6], eave: 1.6, name: n });
    placeGroupAt(-26 - (i % 2) * 15, -28 - Math.floor(i / 2) * 13);
  });

  // 神武门(北, 面向南)
  markBuildStart();
  buildGateAt({ w: 30, d: 9, baseH: 4.2, wallH: 6, tiers: 1, roofHs: [4.0], eave: 2.2, name: "神武门", doors: 3, facing: -1 });
  placeGroupAt(0, -84);

  // 角楼
  buildCornerTower(44, 88);
  buildCornerTower(-44, 88);
  buildCornerTower(44, -88);
  buildCornerTower(-44, -88);
}

/* 将最近一次构建生成的几何平移到指定位置 */
function placeGroupAt(x, z) {
  for (const g of roofGeos.splice(currentRoofStart)) g.translate(x, 0, z);
  for (const g of wallGeos.splice(currentWallStart)) g.translate(x, 0, z);
  for (const g of stoneGeos.splice(currentStoneStart)) g.translate(x, 0, z);
  for (const g of goldGeos.splice(currentGoldStart)) g.translate(x, 0, z);
  for (const g of darkGeos.splice(currentDarkStart)) g.translate(x, 0, z);
  for (const plaque of dynamicMeshes.splice(currentDynamicStart)) {
    plaque.position.x += x;
    plaque.position.z += z;
    gugong.add(plaque);
  }
}

let currentRoofStart = 0;
let currentWallStart = 0;
let currentStoneStart = 0;
let currentGoldStart = 0;
let currentDarkStart = 0;
let currentDynamicStart = 0;

function markBuildStart() {
  currentRoofStart = roofGeos.length;
  currentWallStart = wallGeos.length;
  currentStoneStart = stoneGeos.length;
  currentGoldStart = goldGeos.length;
  currentDarkStart = darkGeos.length;
  currentDynamicStart = dynamicMeshes.length;
}

/* ---------------- 树木布置 ---------------- */

function plantTrees() {
  // 宫道两侧整齐列植(松)
  for (let z = 76; z >= -76; z -= 8) {
    addTree(-12.5, z, "pine", false);
    addTree(12.5, z, "pine", false);
  }
  // 御花园古树(带灯串)
  const gy = [
    [-14, -66], [14, -66], [-20, -72], [20, -72], [-8, -76], [8, -76],
    [-16, -62], [16, -62], [-24, -68], [24, -68], [0, -70], [-5, -64], [5, -64],
  ];
  for (const [x, z] of gy) addTree(x, z, "cypress", true);
  // 内廷庭院树
  addTree(-18, -46, "pine", true);
  addTree(18, -46, "pine", true);
  addTree(-18, -62, "pine", false);
  addTree(18, -62, "pine", false);
  // 外朝广场点缀
  addTree(-20, 40, "pine", true);
  addTree(20, 40, "pine", true);
  addTree(-20, 4, "pine", false);
  addTree(20, 4, "pine", false);
  // 城外远景树影(护城河南岸)
  for (let x = -40; x <= 40; x += 7) {
    addTree(x, 96 + (x % 3), "pine", false);
    addTree(x, -96 - (x % 3), "pine", false);
  }
}

/* ---------------- 灯光 ---------------- */

function buildLights() {
  scene.add(new THREE.AmbientLight(0x44548a, 1.35));
  const hemi = new THREE.HemisphereLight(0x2a3a5c, 0x3a2a1a, 0.55);
  scene.add(hemi);
  const moonLight = new THREE.DirectionalLight(0x9db8e8, 1.1);
  moonLight.position.set(-60, 90, -30);
  scene.add(moonLight);
  // 金色广场灯
  const goldPositions = [
    [0, 95], [0, 60], [0, 36], [0, 12], [0, -14], [0, -40], [0, -64],
  ];
  for (const [x, z] of goldPositions) {
    const p = new THREE.PointLight(0xffc966, 280, 60, 2);
    p.position.set(x, 8, z);
    scene.add(p);
  }
  // 红色宫灯点光
  const redPositions = [
    [-14, 47], [14, 47], [-10, -66], [10, -66], [-24, 24], [24, 24],
  ];
  for (const [x, z] of redPositions) {
    const p = new THREE.PointLight(0xff5040, 130, 36, 2);
    p.position.set(x, 4, z);
    scene.add(p);
  }
}

/* ---------------- 宫灯(灯杆+灯笼, instanced) ---------------- */

let lanternGlowMesh;
function buildLanterns() {
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 4.6, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.8 });
  const lampGeo = new THREE.SphereGeometry(0.42, 10, 8);
  lampGeo.scale(1, 0.82, 1);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xb03024,
    emissive: 0xff6a3c,
    emissiveIntensity: 2.4,
    roughness: 0.5,
  });
  const spots = [];
  for (let z = 72; z >= -72; z -= 9) {
    spots.push([-8.5, z]);
    spots.push([8.5, z]);
  }
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, spots.length);
  const m4 = new THREE.Matrix4();
  spots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 2.3, z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(x, 4.85, z);
    lamps.setMatrixAt(i, m4);
  });
  gugong.add(poles, lamps);
  lanternGlowMesh = lamps;
}

/* ---------------- 火树银花: 树灯串 ---------------- */

let crownLightMesh;
function buildCrownLights() {
  const geo = new THREE.SphereGeometry(0.13, 6, 5);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffb35c,
    emissive: 0xffa63e,
    emissiveIntensity: 2.6,
  });
  const litTrees = treeSpots.filter((t) => t.lit);
  const perTree = 14;
  crownLightMesh = new THREE.InstancedMesh(geo, mat, litTrees.length * perTree);
  const m4 = new THREE.Matrix4();
  let idx = 0;
  const rand = createSeededRandom(2024);
  for (const t of litTrees) {
    for (let i = 0; i < perTree; i += 1) {
      const a = rand() * TWO_PI;
      const r = 1.2 + rand() * 2.6;
      const y = 2.2 + rand() * 3.4;
      m4.makeTranslation(t.x + Math.cos(a) * r, y, t.z + Math.sin(a) * r);
      crownLightMesh.setMatrixAt(idx++, m4);
    }
  }
  crownLightMesh.count = idx;
  gugong.add(crownLightMesh);
}

/* ---------------- 游客 ---------------- */

const TOURIST_COUNT = 96;
let touristBodyMesh;
let touristHeadMesh;
const touristSeeds = [];

function buildTourists() {
  const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.75, 3, 8);
  const headGeo = new THREE.SphereGeometry(0.21, 8, 6);
  const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.75 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xe8c39a, roughness: 0.7 });
  touristBodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, TOURIST_COUNT);
  touristHeadMesh = new THREE.InstancedMesh(headGeo, headMat, TOURIST_COUNT);
  const rand = createSeededRandom(777);
  const palette = [0xc94f4f, 0x4f7dc9, 0x53a06b, 0xc9a44f, 0x8a5fc9, 0x4fb8c9, 0xd97ba6, 0x8a8f99];
  const color = new THREE.Color();
  for (let i = 0; i < TOURIST_COUNT; i += 1) {
    const zone = rand();
    let cx, cz;
    if (zone < 0.42) {
      cx = (rand() * 2 - 1) * 13;
      cz = 34 + rand() * 34; // 外朝广场
    } else if (zone < 0.68) {
      cx = (rand() * 2 - 1) * 12;
      cz = -24 - rand() * 44; // 内廷
    } else if (zone < 0.86) {
      cx = (rand() * 2 - 1) * 20;
      cz = 56 + rand() * 22; // 午门广场
    } else {
      cx = (rand() * 2 - 1) * 30;
      cz = -58 + rand() * 14; // 御花园
    }
    touristSeeds.push({
      cx,
      cz,
      r: 1.2 + rand() * 3.2,
      speed: (0.25 + rand() * 0.5) * (rand() > 0.5 ? 1 : -1),
      phase: rand() * TWO_PI,
      scale: 0.85 + rand() * 0.35,
      mode: rand() > 0.45 ? 0 : 1,
    });
    color.setHex(palette[Math.floor(rand() * palette.length)]);
    touristBodyMesh.setColorAt(i, color);
  }
  if (touristBodyMesh.instanceColor) touristBodyMesh.instanceColor.needsUpdate = true;
  gugong.add(touristBodyMesh, touristHeadMesh);
}

const _touristM4 = new THREE.Matrix4();
const _touristPos = new THREE.Vector3();
const _touristQuat = new THREE.Quaternion();
const _touristScale = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);

function updateTourists(timeSec) {
  for (let i = 0; i < TOURIST_COUNT; i += 1) {
    const s = touristSeeds[i];
    let x = s.cx;
    let z = s.cz;
    if (s.mode === 0) {
      const a = timeSec * s.speed + s.phase;
      x += Math.cos(a) * s.r;
      z += Math.sin(a) * s.r;
    } else {
      const k = (timeSec * s.speed * 0.35 + s.phase) % 2;
      const f = k < 1 ? k : 2 - k;
      x += (f * 2 - 1) * s.r;
    }
    _touristPos.set(x, 0.7 * s.scale, z);
    _touristScale.setScalar(s.scale);
    _touristM4.compose(_touristPos, _touristQuat, _touristScale);
    touristBodyMesh.setMatrixAt(i, _touristM4);
    _touristPos.y = 1.72 * s.scale;
    _touristM4.compose(_touristPos, _touristQuat, _touristScale);
    touristHeadMesh.setMatrixAt(i, _touristM4);
  }
  touristBodyMesh.instanceMatrix.needsUpdate = true;
  touristHeadMesh.instanceMatrix.needsUpdate = true;
}

/* ---------------- 星空 / 月亮 / 银河 ---------------- */

let softDotTexture = null;
function getSoftDotTexture() {
  if (softDotTexture) return softDotTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  softDotTexture = new THREE.CanvasTexture(c);
  return softDotTexture;
}

function buildSky() {
  // 渐变天穹
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 4;
  skyCanvas.height = 512;
  const sctx = skyCanvas.getContext("2d");
  const grad = sctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#02040c");
  grad.addColorStop(0.5, "#061026");
  grad.addColorStop(0.72, "#0d2038");
  grad.addColorStop(0.86, "#14304a");
  grad.addColorStop(1, "#1a3a55");
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 4, 512);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(430, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  gugong.add(sky);

  const rand = createSeededRandom(42);
  // 普通星星
  const starCount = 2600;
  const pos = new Float32Array(starCount * 3);
  const col = new Float32Array(starCount * 3);
  const c = new THREE.Color();
  for (let i = 0; i < starCount; i += 1) {
    const theta = rand() * TWO_PI;
    const y = 0.08 + rand() * 0.92;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const R = 380;
    pos[i * 3] = Math.cos(theta) * r * R;
    pos[i * 3 + 1] = y * R;
    pos[i * 3 + 2] = Math.sin(theta) * r * R;
    const warm = rand();
    c.setHSL(warm > 0.8 ? 0.08 : 0.6, rand() * 0.35, 0.75 + rand() * 0.25);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      size: 2.4,
      sizeAttenuation: false,
      map: getSoftDotTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: false,
    })
  );
  gugong.add(stars);

  // 银河斜带
  const mwCount = 1400;
  const mwPos = new Float32Array(mwCount * 3);
  const axis1 = new THREE.Vector3(0.42, 1, 0.28).normalize();
  const axis2 = new THREE.Vector3(1, -0.35, 0.2).normalize();
  const center = new THREE.Vector3(0, 170, -60);
  for (let i = 0; i < mwCount; i += 1) {
    const u = (rand() * 2 - 1) * 190;
    const v = (rand() + rand() + rand() - 1.5) * 9;
    const p = center.clone().addScaledVector(axis1, u).addScaledVector(axis2, v);
    mwPos[i * 3] = p.x;
    mwPos[i * 3 + 1] = Math.max(p.y, 26);
    mwPos[i * 3 + 2] = p.z;
  }
  const mwGeo = new THREE.BufferGeometry();
  mwGeo.setAttribute("position", new THREE.BufferAttribute(mwPos, 3));
  const mw = new THREE.Points(
    mwGeo,
    new THREE.PointsMaterial({
      color: 0xbcd2f5,
      size: 1.6,
      sizeAttenuation: false,
      map: getSoftDotTexture(),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      fog: false,
    })
  );
  gugong.add(mw);

  // 月亮(发光圆盘 + 光晕)
  const moonCanvas = document.createElement("canvas");
  moonCanvas.width = moonCanvas.height = 256;
  const mctx = moonCanvas.getContext("2d");
  const mgrad = mctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  mgrad.addColorStop(0, "rgba(255, 250, 235, 1)");
  mgrad.addColorStop(0.35, "rgba(255, 244, 214, 0.95)");
  mgrad.addColorStop(0.55, "rgba(250, 230, 180, 0.35)");
  mgrad.addColorStop(1, "rgba(250, 230, 180, 0)");
  mctx.fillStyle = mgrad;
  mctx.fillRect(0, 0, 256, 256);
  const moonTex = new THREE.CanvasTexture(moonCanvas);
  moonTex.colorSpace = THREE.SRGBColorSpace;
  const moon = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false })
  );
  moon.position.set(-80, 120, -90);
  moon.scale.setScalar(46);
  gugong.add(moon);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: moonTex,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      fog: false,
    })
  );
  halo.position.copy(moon.position);
  halo.scale.setScalar(120);
  gugong.add(halo);
}

/* ---------------- 烟花 ---------------- */

const FIREWORK_GROUPS = 3;
const PARTICLES_PER_GROUP = 130;
let fireworkPoints;
let fireworkData = [];

function buildFireworks() {
  const total = FIREWORK_GROUPS * PARTICLES_PER_GROUP;
  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  fireworkPoints = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 2.6,
      map: getSoftDotTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
  );
  gugong.add(fireworkPoints);

  const rand = createSeededRandom(99);
  const palette = [
    new THREE.Color(0xffd76a),
    new THREE.Color(0xff8a5c),
    new THREE.Color(0xff5c7a),
    new THREE.Color(0x9fe8ff),
  ];
  for (let g = 0; g < FIREWORK_GROUPS; g += 1) {
    const origin = new THREE.Vector3(
      (rand() * 2 - 1) * 38,
      30 + rand() * 24,
      -60 + rand() * 100
    );
    for (let i = 0; i < PARTICLES_PER_GROUP; i += 1) {
      const theta = rand() * TWO_PI;
      const phi = Math.acos(2 * rand() - 1);
      const speed = 7 + rand() * 9;
      fireworkData.push({
        group: g,
        origin,
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.cos(phi) * speed * 0.9 + 2.5,
        vz: Math.sin(phi) * Math.sin(theta) * speed,
        color: palette[Math.floor(rand() * palette.length)],
        life: 1.6 + rand() * 0.9,
      });
    }
  }
}

function updateFireworks(timeSec) {
  const posAttr = fireworkPoints.geometry.getAttribute("position");
  const colAttr = fireworkPoints.geometry.getAttribute("color");
  const arr = posAttr.array;
  const carr = colAttr.array;
  for (let i = 0; i < fireworkData.length; i += 1) {
    const p = fireworkData[i];
    const cycle = 5.2;
    const first = p.group * 1.7;
    const k = Math.max(0, Math.floor((timeSec - first) / cycle));
    const burst = first + k * cycle;
    const local = timeSec - burst;
    const idx = i * 3;
    if (local < 0 || local > p.life) {
      arr[idx] = 0;
      arr[idx + 1] = -200;
      arr[idx + 2] = 0;
      continue;
    }
    const drag = 1 - local * 0.32;
    arr[idx] = p.origin.x + p.vx * local * drag;
    arr[idx + 1] = p.origin.y + p.vy * local * drag - 3.2 * local * local;
    arr[idx + 2] = p.origin.z + p.vz * local * drag;
    const fade = Math.max(0, 1 - local / p.life);
    carr[idx] = p.color.r * fade;
    carr[idx + 1] = p.color.g * fade;
    carr[idx + 2] = p.color.b * fade;
  }
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
}

/* ---------------- 孔明灯 ---------------- */

const SKY_LANTERN_COUNT = 18;
let skyLanternMesh;
const skyLanternSeeds = [];

function buildSkyLanterns() {
  const geo = new THREE.BoxGeometry(0.55, 0.8, 0.55);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd98a4a,
    emissive: 0xffb35c,
    emissiveIntensity: 1.8,
  });
  skyLanternMesh = new THREE.InstancedMesh(geo, mat, SKY_LANTERN_COUNT);
  const rand = createSeededRandom(555);
  for (let i = 0; i < SKY_LANTERN_COUNT; i += 1) {
    skyLanternSeeds.push({
      x: (rand() * 2 - 1) * 30,
      z: 40 - rand() * 120,
      speed: 0.9 + rand() * 0.8,
      phase: rand() * TWO_PI,
      sway: 0.6 + rand() * 1.2,
    });
  }
  gugong.add(skyLanternMesh);
}

function updateSkyLanterns(timeSec) {
  for (let i = 0; i < SKY_LANTERN_COUNT; i += 1) {
    const s = skyLanternSeeds[i];
    const cycle = 46;
    const t = (timeSec * s.speed + s.phase * 8) % cycle;
    const y = 2 + t * 1.35;
    const x = s.x + Math.sin(timeSec * 0.4 + s.phase) * s.sway;
    const z = s.z + Math.cos(timeSec * 0.3 + s.phase) * s.sway * 0.6;
    _touristPos.set(x, y, z);
    _touristScale.setScalar(1);
    _touristM4.compose(_touristPos, _touristQuat, _touristScale);
    skyLanternMesh.setMatrixAt(i, _touristM4);
  }
  skyLanternMesh.instanceMatrix.needsUpdate = true;
}

/* ---------------- 树木实例化 ---------------- */

function buildTreeInstances() {
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.6, 6);
  const crownGeo = new THREE.ConeGeometry(1.9, 2.6, 7);
  const trunks = new THREE.InstancedMesh(trunkGeo, matTrunk, treeSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, matCrown, treeSpots.length * 3);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pv = new THREE.Vector3();
  treeSpots.forEach((t, i) => {
    const s = t.kind === "cypress" ? 1.25 : 0.95 + ((i * 37) % 10) / 28;
    sc.set(s, s, s);
    pv.set(t.x, 1.3 * s, t.z);
    m4.compose(pv, q, sc);
    trunks.setMatrixAt(i, m4);
    for (let layer = 0; layer < 3; layer += 1) {
      const ly = (2.4 + layer * 1.5) * s;
      const ls = s * (1 - layer * 0.24);
      sc.set(ls, ls, ls);
      pv.set(t.x, ly, t.z);
      m4.compose(pv, q, sc);
      crowns.setMatrixAt(i * 3 + layer, m4);
    }
  });
  gugong.add(trunks, crowns);
}

/* ---------------- 相机时间线 ---------------- */

const CAM_POS_POINTS = [
  [0, 7, 112],
  [0, 2.6, 90],
  [0, 3.2, 64],
  [0, 9, 60],
  [0, 20, 44],
  [0, 26, 30],
  [0, 26, 12],
  [0, 20, -2],
  [0, 17, -14],
  [0, 13, -30],
  [0, 15, -44],
  [0, 12, -62],
  [0, 16, -74],
  [0, 30, -60],
  [0, 55, -10],
  [0, 85, 55],
];
const CAM_LOOK_POINTS = [
  [0, 15, 72],
  [0, 7, 55],
  [0, 9, 34],
  [0, 11, 36],
  [0, 14, 20],
  [0, 14, 16],
  [0, 12, 0],
  [0, 10, -16],
  [0, 9, -36],
  [0, 10, -52],
  [0, 8, -72],
  [0, 6, -84],
  [0, 4, -40],
  [0, 2, 0],
  [0, 0, 20],
  [0, 0, -15],
];

const camPosCurve = new THREE.CatmullRomCurve3(
  CAM_POS_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  false,
  "centripetal"
);
const camLookCurve = new THREE.CatmullRomCurve3(
  CAM_LOOK_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  false,
  "centripetal"
);

/* ---------------- 解说字幕 ---------------- */

const SUBTITLE_SEGMENTS = [
  { t0: 0.0, t1: 0.09, location: "午门 · 紫禁城南门", text: "夜幕降临，我们来到紫禁城的南门——午门。" },
  { t0: 0.09, t1: 0.16, location: "午门广场", text: "穿过这道六百年的城门，眼前是气势恢宏的外朝广场。" },
  { t0: 0.16, t1: 0.24, location: "内金水桥", text: "沿中轴线北行，跨过弯弯的内金水桥。" },
  { t0: 0.24, t1: 0.4, location: "太和殿 · 三大殿之首", text: "正中的太和殿重檐金瓦，灯火通明，是整座紫禁城的中心。" },
  { t0: 0.4, t1: 0.52, location: "中和殿 · 保和殿", text: "中和殿、保和殿依次矗立，与太和殿并称三大殿。" },
  { t0: 0.52, t1: 0.62, location: "乾清宫 · 内廷", text: "北入内廷，这里是皇帝理政居住的乾清宫。" },
  { t0: 0.62, t1: 0.72, location: "坤宁宫 · 御花园", text: "坤宁宫后便是御花园，古树灯影，火树银花。" },
  { t0: 0.72, t1: 1.01, location: "紫禁城全景", text: "升至高空，六百年紫禁城的璀璨夜色，尽收眼底。" },
];

const locationTagEl = document.querySelector("#location-tag");
const subtitleTextEl = document.querySelector("#subtitle-text");
let currentSegmentIndex = -1;

function updateSubtitle(t) {
  let idx = -1;
  for (let i = 0; i < SUBTITLE_SEGMENTS.length; i += 1) {
    if (t >= SUBTITLE_SEGMENTS[i].t0 && t < SUBTITLE_SEGMENTS[i].t1) {
      idx = i;
      break;
    }
  }
  if (idx === currentSegmentIndex) return;
  currentSegmentIndex = idx;
  if (idx === -1) {
    locationTagEl.classList.remove("is-visible");
    subtitleTextEl.classList.remove("is-visible");
    return;
  }
  const seg = SUBTITLE_SEGMENTS[idx];
  locationTagEl.textContent = seg.location;
  subtitleTextEl.textContent = seg.text;
  locationTagEl.classList.add("is-visible");
  subtitleTextEl.classList.add("is-visible");
}

/* ---------------- 场景状态(按帧确定性更新) ---------------- */

function setSceneStateForFrame(frame) {
  const progress = clampFrame(frame) / Math.max(1, FRAME_COUNT - 1);
  const timeSec = clampFrame(frame) / RENDER_FPS;

  // 相机
  if (!freeCameraEnabled) {
    const pos = camPosCurve.getPoint(progress);
    const look = camLookCurve.getPoint(progress);
    const bob = Math.sin(progress * 46) * 0.14;
    camera.position.set(pos.x, pos.y + bob, pos.z);
    camera.lookAt(look);
  }

  updateTourists(timeSec);
  updateFireworks(timeSec);
  updateSkyLanterns(timeSec);
  updateSubtitle(progress);

  // 灯笼呼吸闪烁
  if (lanternGlowMesh) {
    const flicker = 2.1 + Math.sin(timeSec * 5.2) * 0.35 + Math.sin(timeSec * 13.7) * 0.15;
    lanternGlowMesh.material.emissiveIntensity = flicker;
  }
}

/* ---------------- 组装场景 ---------------- */

buildStaticCity();
buildPalace();
plantTrees();
buildTreeInstances();
buildLights();
buildLanterns();
buildCrownLights();
buildTourists();
buildSky();
buildFireworks();
buildSkyLanterns();

// 合并静态几何
function addMerged(geos, material, name) {
  if (geos.length === 0) return;
  const merged = mergeGeometries(geos, false);
  const mesh = new THREE.Mesh(merged, material);
  mesh.name = name;
  gugong.add(mesh);
}
addMerged(roofGeos, matRoof, "roofs");
addMerged(wallGeos, matWall, "walls");
addMerged(stoneGeos, matStone, "stone");
addMerged(goldGeos, matGold, "gold");
addMerged(darkGeos, matDark, "dark");
addMerged(windowGeos, matWindow, "windows");

// 匾额加入场景
for (const plaque of dynamicMeshes) {
  gugong.add(plaque);
}

/* ---------------- 交互 / 导出(沿用脚手架) ---------------- */

const crc32Table = createCrc32Table();
let freeCameraEnabled = false;
let renderControls = null;
let currentRenderFrame = 0;
let timelinePlaying = !renderOptions.isExportMode;
let timelineStartTime = null;
let isSceneReady = false;

const cameraControlsPanel = createSceneControls({
  camera,
  isFreeCameraEnabled: () => freeCameraEnabled,
  onToggleFreeCamera: setFreeCameraEnabled,
});

resizeRenderers();
renderControls = bindRenderControls();
installSceneExportBridge();
setRenderFrame(0, { playing: timelinePlaying });
isSceneReady = true;
syncRenderControls();
requestAnimationFrame(animate);

function getRequiredElement(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function readRenderOptions(params) {
  const exportMode = params.get("exportMode");
  const renderScale = Number(params.get("renderScale"));

  return {
    isExportMode:
      exportMode === "composite" || exportMode === "composite-transparent",
    renderScale: Number.isFinite(renderScale)
      ? THREE.MathUtils.clamp(renderScale, 1, 16)
      : DEFAULT_EXPORT_RENDER_SCALE,
  };
}

function applyRenderLayout() {
  if (!renderOptions.isExportMode) {
    return;
  }

  app.classList.add("app-export");
  document.body.classList.add("is-export-mode");
  previewShell.style.width = `${Math.round(EXPORT_WIDTH * renderOptions.renderScale)}px`;
  previewShell.style.height = `${Math.round(EXPORT_HEIGHT * renderOptions.renderScale)}px`;
}

function clampFrame(frame) {
  if (!Number.isFinite(frame)) {
    return 0;
  }
  return THREE.MathUtils.clamp(Math.round(frame), 0, FRAME_COUNT - 1);
}

function readPreviewSize() {
  return {
    width: Math.max(1, Math.round(previewShell.clientWidth || EXPORT_WIDTH)),
    height: Math.max(1, Math.round(previewShell.clientHeight || EXPORT_HEIGHT)),
  };
}

function resizeRenderersTo({ width, height, pixelRatio }) {
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
}

function resizeRenderers() {
  const { width, height } = readPreviewSize();
  resizeRenderersTo({
    width,
    height,
    pixelRatio: renderOptions.isExportMode
      ? 1
      : Math.min(window.devicePixelRatio || 1, 2),
  });
}

function renderScene() {
  if (freeCameraEnabled) {
    controls.update();
  }
  cameraControlsPanel.update();
  renderer.render(scene, camera);
}

function setRenderFrame(frame, { playing = false } = {}) {
  if (freeCameraEnabled) {
    setFreeCameraEnabled(false);
  }

  currentRenderFrame = clampFrame(frame);
  timelinePlaying = Boolean(playing);
  timelineStartTime = null;
  setSceneStateForFrame(currentRenderFrame);
  renderScene();
  syncRenderControls();
}

function animate(now) {
  requestAnimationFrame(animate);

  if (renderOptions.isExportMode) {
    return;
  }

  if (freeCameraEnabled) {
    renderScene();
    return;
  }

  if (!timelinePlaying) {
    return;
  }

  if (timelineStartTime === null) {
    timelineStartTime = now - (currentRenderFrame / RENDER_FPS) * 1000;
  }

  const elapsedMs = (now - timelineStartTime) % FRAME_DURATION_MS;
  currentRenderFrame = clampFrame((elapsedMs / 1000) * RENDER_FPS);
  setSceneStateForFrame(currentRenderFrame);
  renderScene();
  syncRenderControls();
}

function handleWindowResize() {
  resizeRenderers();
  setSceneStateForFrame(currentRenderFrame);
  renderScene();
}

window.addEventListener("resize", handleWindowResize, false);

function setFreeCameraEnabled(enabled) {
  const nextEnabled = Boolean(enabled);
  if (freeCameraEnabled === nextEnabled) {
    return;
  }

  freeCameraEnabled = nextEnabled;
  if (freeCameraEnabled) {
    timelinePlaying = false;
    timelineStartTime = null;
    controls.enabled = true;
    controls.update();
  } else {
    controls.enabled = false;
    controls.screenSpacePanning = false;
    setRenderFrame(currentRenderFrame, { playing: false });
    return;
  }

  renderScene();
  syncRenderControls();
}

function setFreeCameraPanning(enabled) {
  if (!freeCameraEnabled) {
    return;
  }

  controls.screenSpacePanning = Boolean(enabled);
  controls.mouseButtons.LEFT = enabled ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
}

function isEditingText(element) {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element?.isContentEditable
  );
}

function syncFreeCameraPan(event, panning) {
  if (!freeCameraEnabled || event.code !== "Space" || isEditingText(event.target)) {
    return;
  }

  event.preventDefault();
  setFreeCameraPanning(panning);
}

window.addEventListener("keydown", (event) => {
  if (!event.repeat) {
    syncFreeCameraPan(event, true);
  }
});
window.addEventListener("keyup", (event) => syncFreeCameraPan(event, false));
window.addEventListener("blur", () => setFreeCameraPanning(false));

function bindRenderControls() {
  const frameInput = document.querySelector("#render-frame");
  const frameRange = document.querySelector("#render-frame-range");
  const frameCount = document.querySelector("#render-frame-count");
  const exportFrameButton = document.querySelector("#export-frame");
  const exportSequenceButton = document.querySelector("#export-sequence");
  const exportScaleSelect = document.querySelector("#export-scale");
  const exportStatus = document.querySelector("#export-status");

  if (!frameInput || !frameRange || !frameCount) {
    return null;
  }

  const controlsPanel = {
    frameInput,
    frameRange,
    frameCount,
    exportFrameButton,
    exportSequenceButton,
    exportScaleSelect,
    exportStatus,
  };

  exportScaleSelect.value = String(DEFAULT_EXPORT_RENDER_SCALE);
  frameInput.addEventListener("change", () => {
    setRenderFrame(Number(frameInput.value), { playing: false });
  });
  frameRange.addEventListener("input", () => {
    setRenderFrame(Number(frameRange.value), { playing: false });
  });
  exportFrameButton.addEventListener("click", () => {
    void exportCurrentFrame();
  });
  exportSequenceButton.addEventListener("click", () => {
    void exportSequence();
  });

  return controlsPanel;
}

function syncRenderControls() {
  if (!renderControls) {
    return;
  }

  const maxFrame = FRAME_COUNT - 1;
  renderControls.frameInput.max = String(maxFrame);
  renderControls.frameInput.value = String(currentRenderFrame);
  renderControls.frameRange.max = String(maxFrame);
  renderControls.frameRange.value = String(currentRenderFrame);
  renderControls.frameCount.value = `${currentRenderFrame + 1} / ${FRAME_COUNT}`;
  setExportButtonsDisabled(!isSceneReady);
}

function setExportButtonsDisabled(disabled) {
  if (!renderControls) {
    return;
  }

  renderControls.exportFrameButton.disabled =
    disabled || renderOptions.isExportMode;
  renderControls.exportSequenceButton.disabled =
    disabled || renderOptions.isExportMode;
}

function readExportRenderScale() {
  const value = Number(renderControls?.exportScaleSelect?.value);
  return EXPORT_RENDER_SCALES.has(value) ? value : DEFAULT_EXPORT_RENDER_SCALE;
}

function readExportSize(renderScale) {
  return {
    width: Math.round(EXPORT_WIDTH * renderScale),
    height: Math.round(EXPORT_HEIGHT * renderScale),
  };
}

async function exportCurrentFrame() {
  if (!renderControls?.exportStatus) {
    return;
  }

  const renderScale = readExportRenderScale();
  const exportSize = readExportSize(renderScale);
  const filename = `gugong-frame-${String(currentRenderFrame).padStart(4, "0")}.png`;
  const status = renderControls.exportStatus;

  setExportButtonsDisabled(true);
  status.textContent =
    `Exporting ${exportSize.width}x${exportSize.height} frame ` +
    `${currentRenderFrame + 1}/${FRAME_COUNT}...`;

  try {
    const blob = await renderFixedSizePngBlob({
      frame: currentRenderFrame,
      renderScale,
    });
    downloadBlob(blob, filename);
    status.textContent = `PNG exported at ${exportSize.width}x${exportSize.height}.`;
  } catch (error) {
    status.textContent = `Export failed: ${error.message}`;
  } finally {
    setExportButtonsDisabled(false);
  }
}

async function exportSequence() {
  if (!renderControls?.exportStatus) {
    return;
  }

  const renderScale = readExportRenderScale();
  const exportSize = readExportSize(renderScale);
  const status = renderControls.exportStatus;
  const filename = `gugong-frames-${String(FRAME_COUNT).padStart(4, "0")}.zip`;

  setExportButtonsDisabled(true);
  status.textContent =
    `Exporting ${FRAME_COUNT} frames at ${exportSize.width}x${exportSize.height}...`;

  try {
    const blob = await renderFixedSizeZipBlob({
      startFrame: 0,
      endFrame: FRAME_COUNT - 1,
      renderScale,
      onFrame: (frame) => {
        status.textContent =
          `Exporting ${exportSize.width}x${exportSize.height} frame ` +
          `${frame + 1}/${FRAME_COUNT}...`;
      },
    });
    downloadBlob(blob, filename);
    status.textContent = `ZIP exported at ${exportSize.width}x${exportSize.height}.`;
  } catch (error) {
    status.textContent = `Export failed: ${error.message}`;
  } finally {
    setExportButtonsDisabled(false);
  }
}

async function renderFixedSizePngBlob({ frame, renderScale }) {
  return await withFixedSizeRenderer(renderScale, async () => {
    setRenderFrame(frame, { playing: false });
    await waitForAnimationFrames(2);
    return await previewShellToPngBlob();
  });
}

async function renderFixedSizeZipBlob({
  startFrame,
  endFrame,
  renderScale,
  onFrame,
}) {
  return await withFixedSizeRenderer(renderScale, async () => {
    const entries = [];
    const clampedStartFrame = clampFrame(startFrame);
    const clampedEndFrame = Math.max(clampedStartFrame, clampFrame(endFrame));

    for (let frame = clampedStartFrame; frame <= clampedEndFrame; frame += 1) {
      onFrame?.(frame);
      setRenderFrame(frame, { playing: false });
      await waitForAnimationFrames(2);

      const blob = await previewShellToPngBlob();
      entries.push({
        name: formatFrameFileName(frame),
        data: new Uint8Array(await blob.arrayBuffer()),
      });
    }

    return createStoredZipBlob(entries);
  });
}

async function withFixedSizeRenderer(renderScale, task) {
  const { width, height } = readExportSize(renderScale);
  const previousPixelRatio = renderer.getPixelRatio();
  const previousFrame = currentRenderFrame;
  const previousTimelinePlaying = timelinePlaying;
  const previousWidth = previewShell.style.width;
  const previousHeight = previewShell.style.height;

  timelinePlaying = false;
  previewShell.style.width = `${width}px`;
  previewShell.style.height = `${height}px`;
  resizeRenderersTo({ width, height, pixelRatio: 1 });

  try {
    return await task();
  } finally {
    previewShell.style.width = previousWidth;
    previewShell.style.height = previousHeight;
    renderer.setPixelRatio(previousPixelRatio);
    resizeRenderers();
    setRenderFrame(previousFrame, { playing: previousTimelinePlaying });
    syncRenderControls();
  }
}

async function previewShellToPngBlob() {
  const { width, height } = readPreviewSize();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }

  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  context.drawImage(renderer.domElement, 0, 0, width, height);

  return await canvasToBlob(canvas, "image/png");
}

function formatFrameFileName(frame) {
  return `frame-${String(frame).padStart(4, "0")}.png`;
}

function createStoredZipBlob(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    if (entry.data.length > 0xffffffff) {
      throw new Error("A ZIP entry is too large for browser export.");
    }

    const nameBytes = encoder.encode(entry.name);
    const crc = computeCrc32(entry.data);
    const localHeader = createZipLocalHeader({ nameBytes, data: entry.data, crc });
    const centralHeader = createZipCentralHeader({
      nameBytes,
      data: entry.data,
      crc,
      localHeaderOffset: offset,
    });

    localParts.push(localHeader, entry.data);
    centralParts.push(centralHeader);
    offset += localHeader.length + entry.data.length;
    centralSize += centralHeader.length;

    if (offset > 0xffffffff || centralSize > 0xffffffff) {
      throw new Error("ZIP is too large for browser export.");
    }
  }

  const centralOffset = offset;
  const endRecord = createZipEndRecord({
    entryCount: entries.length,
    centralSize,
    centralOffset,
  });

  return new Blob([...localParts, ...centralParts, endRecord], {
    type: "application/zip",
  });
}

function createZipLocalHeader({ nameBytes, data, crc }) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, ZIP_VERSION_NEEDED, true);
  view.setUint16(8, ZIP_STORE_METHOD, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, data.length, true);
  view.setUint32(22, data.length, true);
  view.setUint16(26, nameBytes.length, true);
  header.set(nameBytes, 30);
  return header;
}

function createZipCentralHeader({ nameBytes, data, crc, localHeaderOffset }) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, ZIP_VERSION_NEEDED, true);
  view.setUint16(6, ZIP_VERSION_NEEDED, true);
  view.setUint16(10, ZIP_STORE_METHOD, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, data.length, true);
  view.setUint32(24, data.length, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint32(42, localHeaderOffset, true);
  header.set(nameBytes, 46);
  return header;
}

function createZipEndRecord({ entryCount, centralSize, centralOffset }) {
  if (entryCount > 0xffff) {
    throw new Error("ZIP has too many files.");
  }

  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return record;
}

function computeCrc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createCrc32Table() {
  const table = new Uint32Array(256);

  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
}

function canvasToBlob(canvas, type) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Canvas export failed."));
    }, type);
  });
}

function downloadBlob(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

function installSceneExportBridge() {
  window.__SCENE_3D_EXPORT__ = {
    isReady: () => isSceneReady,
    getCurrentFrame: () => currentRenderFrame,
    getTotalFrames: () => FRAME_COUNT,
    getSize: () => ({
      width: EXPORT_WIDTH,
      height: EXPORT_HEIGHT,
      aspectRatio: EXPORT_ASPECT_RATIO,
      fps: RENDER_FPS,
    }),
    setFrame: async (frame) => {
      setRenderFrame(frame, { playing: false });
      await waitForAnimationFrames(2);
      return currentRenderFrame;
    },
  };
}

function waitForAnimationFrames(frameCount = 1) {
  return new Promise((resolve) => {
    let remaining = Math.max(1, frameCount);
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) {
        resolve();
        return;
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
}

function createSeededRandom(seed) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}
