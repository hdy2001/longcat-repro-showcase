// ============ 世界：海底场景 / 遗迹 / 文物 ============

const W = {}; // 世界引用

const PATH_POINTS = [
  [0, -6, 15], [0, -9, -5], [1, -13, -25], [0, -17, -38], [-4, -19, -55],
  [-12, -22, -70], [-2, -20, -90], [8, -18, -108], [12, -17, -118], [2, -21, -132],
  [-6, -23, -148], [4, -22, -162], [8, -21, -170], [0, -16, -182], [0, -8, -198], [0, -2, -210]
];
const STREAM_POINTS = [
  [0, -12, -10], [12, -16, -50], [-10, -18, -90], [8, -20, -130], [-4, -16, -170], [0, -12, -200]
];

function seabedY(x, z) {
  return fbm(x * 0.018 + 13.7, z * 0.018 + 7.1) * 7 - 30;
}

function initWorld() {
  // 渲染器
  W.renderer = new THREE.WebGLRenderer({ antialias: true });
  W.renderer.setSize(innerWidth, innerHeight);
  W.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  W.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  W.renderer.toneMappingExposure = 1.15;
  document.body.appendChild(W.renderer.domElement);

  // 场景与雾
  W.scene = new THREE.Scene();
  W.scene.background = new THREE.Color(0x06231b);
  W.scene.fog = new THREE.FogExp2(0x072a20, 0.016);

  W.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);
  W.camera.position.set(0, -4, 26);

  // ---- 灯光 ----
  W.scene.add(new THREE.HemisphereLight(0x2a5a4a, 0x0a1a14, 0.7));
  const dir = new THREE.DirectionalLight(0x9fd8b0, 1.1);
  dir.position.set(12, 80, 8);
  W.scene.add(dir);
  // 顶部"日光"（昼深）
  W.sunSpot = new THREE.SpotLight(0xbfe8c8, 900, 260, 0.5, 0.65, 1.6);
  W.sunSpot.position.set(0, 90, -60);
  W.sunSpot.target.position.set(0, -30, -60);
  W.scene.add(W.sunSpot, W.sunSpot.target);
  // 遗迹冷色补光
  for (const [lx, lz, col] of [[-20, -110, 0x3a8a6a], [18, -150, 0x2a6a8a], [0, -190, 0x3a7a5a]]) {
    const pl = new THREE.PointLight(col, 50, 55, 1.8);
    pl.position.set(lx, -22, lz);
    W.scene.add(pl);
  }

  // ---- 海床 ----
  const seabedGeo = new THREE.PlaneGeometry(520, 520, 130, 130);
  seabedGeo.rotateX(-Math.PI / 2);
  const sp = seabedGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    sp.setY(i, seabedY(sp.getX(i), sp.getZ(i)));
  }
  seabedGeo.computeVertexNormals();
  const seabedMat = new THREE.MeshStandardMaterial({ color: 0x33523f, roughness: 1, metalness: 0 });
  W.scene.add(new THREE.Mesh(seabedGeo, seabedMat));

  // 海床焦散
  W.causticsTex = makeCausticsTexture();
  W.causticsTex.repeat.set(7, 7);
  const causticMat = new THREE.MeshBasicMaterial({
    map: W.causticsTex, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const causticPlane = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), causticMat);
  causticPlane.rotation.x = -Math.PI / 2;
  causticPlane.position.y = -29.55;
  W.scene.add(causticPlane);
  W.causticMat = causticMat;

  // ---- 水面（从水下仰望） ----
  W.waterTex = makeWaterTexture();
  W.waterTex.repeat.set(4, 4);
  const waterMat = new THREE.MeshBasicMaterial({
    map: W.waterTex, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    color: 0x9fe8c0
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), waterMat);
  water.rotation.x = Math.PI / 2;
  water.position.y = 42;
  W.scene.add(water);
  W.waterMat = waterMat;

  // ---- 光柱 ----
  W.godrays = [];
  const rayTex = makeGodrayTexture();
  for (let i = 0; i < 7; i++) {
    const w = 6 + Math.random() * 14;
    const m = new THREE.MeshBasicMaterial({
      map: rayTex, transparent: true, opacity: 0.05 + Math.random() * 0.07,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      color: 0x86d8a8, fog: false
    });
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(w, 110), m);
    ray.position.set((Math.random() - 0.5) * 130, -4, -40 - Math.random() * 150);
    ray.rotation.y = Math.random() * Math.PI;
    ray.rotation.z = (Math.random() - 0.5) * 0.25;
    W.scene.add(ray);
    W.godrays.push(ray);
  }

  // ---- 远景雾霭罩 ----
  const hazeMat = new THREE.MeshBasicMaterial({
    color: 0x0a352a, transparent: true, opacity: 0.35,
    side: THREE.BackSide, depthWrite: false, fog: false
  });
  const haze = new THREE.Mesh(new THREE.CylinderGeometry(200, 200, 140, 48, 1, true), hazeMat);
  haze.position.y = 5;
  W.scene.add(haze);
  W.hazeMat = hazeMat;

  // ---- 材质库 ----
  W.patinaTex = makePatinaTexture();
  W.bronzeMat = new THREE.MeshStandardMaterial({
    map: W.patinaTex, color: 0x9aa88e, metalness: 0.75, roughness: 0.5
  });
  W.goldMat = new THREE.MeshStandardMaterial({
    color: 0xd8a828, metalness: 0.9, roughness: 0.32,
    emissive: 0x664400, emissiveIntensity: 0.3
  });
  W.goldBrightMat = new THREE.MeshStandardMaterial({
    color: 0xe8b83a, metalness: 0.85, roughness: 0.28,
    emissive: 0x8a5f10, emissiveIntensity: 0.45
  });
  W.stoneMat = new THREE.MeshStandardMaterial({ color: 0x46584a, roughness: 0.95, metalness: 0.05 });

  // ---- 岩石 ----
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 46; i++) {
    const rock = new THREE.Mesh(rockGeo, W.stoneMat);
    const s = 0.5 + Math.random() * 2.6;
    const rx = (Math.random() - 0.5) * 320, rz = -100 + (Math.random() - 0.5) * 320;
    rock.scale.set(s, s * (0.6 + Math.random() * 0.6), s);
    rock.position.set(rx, seabedY(rx, rz) + s * 0.25, rz);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    W.scene.add(rock);
  }

  // ---- 石柱群 ----
  const columnGeoBase = new THREE.BoxGeometry(1.7, 0.5, 1.7);
  const columnGeoCap = new THREE.BoxGeometry(1.6, 0.45, 1.6);
  const columnGeoShaft = new THREE.CylinderGeometry(0.45, 0.58, 1, 10);
  const columnPos = [
    [-16, -100], [-8, -108], [2, -104], [12, -112], [20, -122], [14, -134],
    [-18, -128], [-6, -140], [6, -146], [-14, -152], [0, -162], [24, -100]
  ];
  for (const [cx, cz] of columnPos) {
    const h = 3 + Math.random() * 5;
    const g = new THREE.Group();
    const base = new THREE.Mesh(columnGeoBase, W.stoneMat);
    base.position.y = 0.25;
    const shaft = new THREE.Mesh(columnGeoShaft, W.stoneMat);
    shaft.scale.y = h;
    shaft.position.y = 0.5 + h / 2;
    g.add(base, shaft);
    if (Math.random() > 0.35) {
      const cap = new THREE.Mesh(columnGeoCap, W.stoneMat);
      cap.position.y = 0.5 + h + 0.22;
      g.add(cap);
    }
    g.position.set(cx, seabedY(cx, cz), cz);
    g.rotation.set((Math.random() - 0.5) * 0.22, Math.random() * 3, (Math.random() - 0.5) * 0.22);
    W.scene.add(g);
  }
  // 倒塌的柱段
  for (let i = 0; i < 5; i++) {
    const h = 2 + Math.random() * 2.5;
    const seg = new THREE.Mesh(columnGeoShaft, W.stoneMat);
    seg.scale.y = h;
    const cx = (Math.random() - 0.5) * 70, cz = -100 - Math.random() * 70;
    seg.position.set(cx, seabedY(cx, cz) + 0.5, cz);
    seg.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.4, Math.random() * 3, 0);
    W.scene.add(seg);
  }

  // ---- 平台与台阶 ----
  const platGeo = new THREE.BoxGeometry(9, 1, 9);
  for (const [px, pz] of [[-22, -122], [16, -142], [0, -98]]) {
    const p = new THREE.Mesh(platGeo, W.stoneMat);
    p.position.set(px, seabedY(px, pz) + 0.5, pz);
    p.rotation.y = Math.random() * 0.6;
    W.scene.add(p);
  }
  for (let i = 0; i < 5; i++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(5 - i * 0.7, 0.5, 1.4), W.stoneMat);
    st.position.set(-22, seabedY(-22, -122) + 0.25 + i * 0.5, -116.5 - i * 1.1);
    W.scene.add(st);
  }

  // ---- 石拱门 ----
  const arch = new THREE.Group();
  const legL = new THREE.Mesh(columnGeoShaft, W.stoneMat);
  legL.scale.y = 6.5; legL.position.set(-2.2, 3.25, 0);
  const legR = legL.clone(); legR.position.x = 2.2;
  const top = new THREE.Mesh(new THREE.BoxGeometry(7, 0.9, 1.8), W.stoneMat);
  top.position.y = 6.9;
  arch.add(legL, legR, top);
  arch.position.set(0, seabedY(0, -100), -100);
  arch.rotation.y = 0.15;
  W.scene.add(arch);

  // ---- 青铜立人像群 ----
  W.scene.add(makeFigurine(-6, -116, 0.3), makeFigurine(-3, -118, 0.1), makeFigurine(0, -117, -0.2),
    makeFigurine(3, -119, 0.4), makeFigurine(6, -116.5, 0), makeFigurine(-10, -96, 1.2),
    makeFigurine(9, -138, 2.6), makeFigurine(-4, -158, 0.8));

  // ---- 太阳轮（车轮形遗迹） ----
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.3, 10, 40), W.bronzeMat));
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.4, 6), W.bronzeMat);
    spoke.rotation.z = i * Math.PI / 3;
    wheel.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.8, 12), W.bronzeMat);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  wheel.position.set(-12, seabedY(-12, -132) + 1.2, -132);
  wheel.rotation.set(0.5, 0.8, 0.35);
  W.scene.add(wheel);

  // ---- 太阳神鸟金饰 ----
  const sunbirdTex = makeSunbirdTexture();
  const sunbirdMat = new THREE.MeshStandardMaterial({
    map: sunbirdTex, emissiveMap: sunbirdTex, emissive: 0xffb830, emissiveIntensity: 0.5,
    metalness: 0.85, roughness: 0.32, side: THREE.DoubleSide
  });
  W.sunbird = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.9, 6, 128), sunbirdMat);
  W.sunbird.add(ring);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0xffc860, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  sunGlow.scale.set(20, 20, 1);
  W.sunbird.add(sunGlow);
  W.sunbirdLight = new THREE.PointLight(0xffc24d, 350, 85, 1.8);
  W.sunbird.add(W.sunbirdLight);
  W.sunbird.position.set(0, -20, -40);
  W.sunbird.rotation.x = -0.35;
  W.scene.add(W.sunbird);

  // 神鸟周围金屑
  W.shards = [];
  const shardGeo = new THREE.TetrahedronGeometry(0.22, 0);
  for (let i = 0; i < 26; i++) {
    const sh = new THREE.Mesh(shardGeo, W.goldBrightMat);
    const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 8;
    sh.position.set(Math.cos(a) * r, -20 + (Math.random() - 0.5) * 10, -40 + Math.sin(a) * r);
    sh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    sh.userData = { a, r, y: sh.position.y, s: 0.3 + Math.random() * 0.8 };
    W.scene.add(sh);
    W.shards.push(sh);
  }

  // ---- 青铜神树 ----
  W.tree = makeTree();
  const treePos = [-20, -70];
  W.tree.position.set(treePos[0], seabedY(treePos[0], treePos[1]), treePos[1]);
  W.scene.add(W.tree);

  // ---- 纵目面具（大，悬空） ----
  W.bigMask = makeMask(3.6, W.goldMat);
  W.bigMask.position.set(14, -15, -112);
  W.bigMask.rotation.y = -0.5;
  const maskGlow = new THREE.PointLight(0xffd27a, 90, 50, 1.8);
  maskGlow.position.set(14, -14, -106);
  W.scene.add(maskGlow);
  W.scene.add(W.bigMask);
  // 小面具（半埋）
  const sm1 = makeMask(1.15, W.bronzeMat);
  sm1.position.set(-8, seabedY(-8, -128) + 0.4, -128);
  sm1.rotation.set(0.4, 0.7, 0.55);
  const sm2 = makeMask(1.15, W.bronzeMat);
  sm2.position.set(10, seabedY(10, -148) + 0.3, -148);
  sm2.rotation.set(-0.3, 2.2, -0.4);
  const sm3 = makeMask(0.9, W.bronzeMat);
  sm3.position.set(-16, seabedY(-16, -96) + 0.3, -96);
  sm3.rotation.set(0.2, 1.1, 0.3);
  W.scene.add(sm1, sm2, sm3);

  // ---- 金杖 ----
  W.staff = new THREE.Group();
  const staffMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 3.4, 10),
    new THREE.MeshStandardMaterial({
      map: makeStaffTexture(), metalness: 0.85, roughness: 0.3,
      emissive: 0x8a5f10, emissiveIntensity: 0.35
    })
  );
  W.staff.add(staffMesh);
  const staffGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0xffd88a, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  staffGlow.scale.set(6, 10, 1);
  W.staff.add(staffGlow);
  const staffLight = new THREE.PointLight(0xffd27a, 70, 34, 1.8);
  W.staff.add(staffLight);
  W.staff.position.set(8, -22, -170);
  W.scene.add(W.staff);

  // ---- 路径与鱼群曲线 ----
  W.path = new THREE.CatmullRomCurve3(
    PATH_POINTS.map(p => new THREE.Vector3(...p)), false, 'centripetal'
  );
  W.streamCurve = new THREE.CatmullRomCurve3(
    STREAM_POINTS.map(p => new THREE.Vector3(...p)), false, 'centripetal'
  );
}

// ---- 青铜立人像 ----
function makeFigurine(px, pz, ry) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.15, 8), W.bronzeMat);
  body.position.y = 0.58;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), W.bronzeMat);
  head.position.y = 1.32;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 8), W.bronzeMat);
  hat.position.y = 1.58;
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6), W.bronzeMat);
  armL.position.set(-0.28, 1.0, 0.12);
  armL.rotation.set(0.9, 0, 0.5);
  const armR = armL.clone();
  armR.position.x = 0.28;
  armR.rotation.set(0.9, 0, -0.5);
  g.add(body, head, hat, armL, armR);
  g.position.set(px, seabedY(px, pz), pz);
  g.rotation.y = ry;
  const s = 0.9 + Math.random() * 0.5;
  g.scale.set(s, s, s);
  return g;
}

// ---- 青铜神树 ----
function makeTree() {
  const g = new THREE.Group();
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 0.9, 12), W.stoneMat);
  pedestal.position.y = 0.45;
  g.add(pedestal);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, 4.6, 8), W.bronzeMat);
  trunk.position.y = 3.1;
  g.add(trunk);
  // 三层枝桠
  for (let lv = 0; lv < 3; lv++) {
    const y = 2.2 + lv * 1.35;
    const n = lv === 2 ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + lv * 0.7;
      const br = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 6, 12, Math.PI / 2), W.bronzeMat);
      br.position.set(Math.cos(a) * 0.3, y, Math.sin(a) * 0.3);
      br.rotation.set(0, -a + Math.PI / 2, 0.9);
      g.add(br);
      // 枝端小鸟
      if (lv > 0 || i % 2 === 0) {
        const bird = new THREE.Group();
        const bb = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 5), W.goldMat);
        bb.rotation.x = Math.PI / 2;
        bird.add(bb);
        bird.position.set(Math.cos(a) * 1.1, y + 0.55, Math.sin(a) * 1.1);
        g.add(bird);
      }
    }
  }
  const topBird = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 5), W.goldMat);
  topBird.position.y = 5.85;
  g.add(topBird);
  return g;
}

// ---- 青铜面具（纵目） ----
function makeMask(scale, mat) {
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), mat);
  face.scale.set(1.15, 1.35, 0.55);
  g.add(face);
  // 纵目（前突圆柱眼）
  for (const sx of [-0.42, 0.42]) {
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.75, 10), mat);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(sx, 0.28, 0.62);
    g.add(eye);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), W.goldMat);
    tip.position.set(sx, 0.28, 1.0);
    g.add(tip);
    // 眉弓
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 8, 14, Math.PI), mat);
    brow.position.set(sx, 0.62, 0.5);
    brow.rotation.x = -0.4;
    g.add(brow);
  }
  // 鼻
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), mat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.02, 0.72);
  g.add(nose);
  // 耳（大翼状）
  for (const sx of [-1.15, 1.15]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.5), mat);
    ear.position.set(sx, 0.1, -0.1);
    ear.rotation.z = sx > 0 ? -0.25 : 0.25;
    g.add(ear);
  }
  // 嘴
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x141e18, roughness: 0.9 }));
  mouth.position.set(0, -0.52, 0.52);
  g.add(mouth);
  // 冠
  const crown = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.4), mat);
  crown.position.y = 1.45;
  g.add(crown);
  g.scale.set(scale, scale, scale);
  return g;
}
