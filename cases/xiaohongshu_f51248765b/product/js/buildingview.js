/* ========== 视图三：建筑分层拆解 ========== */

const BuildingView = {
  scene: null, camera: null, renderer: null, controls: null,
  raf: 0, inited: false,
  host: null, labelLayer: null, tip: null,
  building: null, comps: [], pickMeshes: [], labels: [],
  selected: null, hovered: null,
  explodeT: 0, explodeTarget: 0,
  isolated: false, savedVisible: null,
  autoRotate: false,
  camHome: { pos: new THREE.Vector3(36, 24, 50), tgt: new THREE.Vector3(0, 30, 0) },

  /* ---------------- 材质 ---------------- */
  makeMats() {
    return {
      stone: new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.92 }),
      column: new THREE.MeshStandardMaterial({ color: 0x7a3b2e, roughness: 0.65 }),
      wall: new THREE.MeshStandardMaterial({ color: 0xa0663a, roughness: 0.85 }),
      wallIn: new THREE.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.9, side: THREE.DoubleSide }),
      bracket: new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.75 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x3d4a44, roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide }),
      roofDark: new THREE.MeshStandardMaterial({ color: 0x22281f, roughness: 0.9 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xc9a06a, metalness: 0.65, roughness: 0.35 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1f1c18, roughness: 0.95 }),
      door: new THREE.MeshStandardMaterial({ color: 0x4a2e20, roughness: 0.8 })
    };
  },

  /* ---------------- 场景 ---------------- */
  init() {
    if (this.inited) return;
    this.inited = true;
    this.host = document.getElementById("building-canvas");
    this.labelLayer = document.getElementById("building-labels");
    this.tip = document.getElementById("hover-tip");

    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0b10);
    this.scene.fog = new THREE.Fog(0x0b0b10, 130, 280);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 600);
    this.camera.position.copy(this.camHome.pos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.host.appendChild(this.renderer.domElement);

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 220;
    this.controls.target.copy(this.camHome.tgt);

    this.scene.add(new THREE.AmbientLight(0x8a8a9a, 0.5));
    this.scene.add(new THREE.HemisphereLight(0xcfd4e8, 0x2a2418, 0.45));
    const sun = new THREE.DirectionalLight(0xffe0b0, 1.2);
    sun.position.set(45, 70, 35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -20;
    sun.shadow.camera.far = 240;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x6a7aff, 0.28);
    rim.position.set(-40, 30, -45);
    this.scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(95, 64),
      new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.bindEvents();
    window.addEventListener("resize", () => this.onResize());
  },

  /* ---------------- 小工具 ---------------- */
  mesh(geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  },

  beamBetween(p1, p2, thick, mat) {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, len), mat);
    m.position.copy(p1).add(p2).multiplyScalar(0.5);
    m.lookAt(p2);
    m.castShadow = true;
    return m;
  },

  octRing(rOut, rIn, h, mat) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * rOut, y = Math.sin(a) * rOut;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const hole = new THREE.Path();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * rIn, y = Math.sin(a) * rIn;
      if (i === 0) hole.moveTo(x, y); else hole.lineTo(x, y);
    }
    hole.closePath();
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    return m;
  },

  /* ================= 应县木塔 · 构件几何 ================= */

  buildPlatform(g, M, geo) {
    const m = this.mesh(new THREE.CylinderGeometry(geo.r, geo.r + 1.2, geo.h, 8), M.stone, 0, geo.h / 2, 0);
    m.rotation.y = Math.PI / 8;
    g.add(m);
    const cap = this.mesh(new THREE.CylinderGeometry(geo.r + 0.4, geo.r + 0.4, 0.5, 8), M.stone, 0, geo.h + 0.25, 0);
    cap.rotation.y = Math.PI / 8;
    g.add(cap);
  },

  buildPorchColumns(g, M, geo, yBase) {
    for (let i = 0; i < geo.n; i++) {
      const a = (i / geo.n) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const col = this.mesh(new THREE.CylinderGeometry(0.34, 0.4, geo.h, 10), M.column, ca * geo.r, yBase + geo.h / 2, sa * geo.r);
      col.userData.radial = [ca, sa];
      g.add(col);
      const base = this.mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.5, 10), M.stone, ca * geo.r, yBase + 0.25, sa * geo.r);
      base.userData.radial = [ca, sa];
      g.add(base);
    }
  },

  buildStoryColumns(g, M, geo, yBase) {
    for (let i = 0; i < geo.n; i++) {
      const a = (i / geo.n) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const outer = this.mesh(new THREE.CylinderGeometry(0.32, 0.38, geo.h, 10), M.column, ca * geo.r, yBase + geo.h / 2, sa * geo.r);
      outer.userData.radial = [ca, sa];
      g.add(outer);
      const inner = this.mesh(new THREE.CylinderGeometry(0.3, 0.36, geo.h * 0.92, 10), M.column, ca * (geo.r - 2.6), yBase + geo.h * 0.46, sa * (geo.r - 2.6));
      inner.userData.radial = [ca * 0.7, sa * 0.7];
      g.add(inner);
    }
  },

  /* 八角塔身：八块墙板，正面设板门，其余设直棂窗 */
  buildWall(g, M, geo, yBase) {
    const w = 2 * geo.r * Math.tan(Math.PI / 8) - 0.3;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const px = ca * geo.r, pz = sa * geo.r;
      const isFront = (i === 2); // 面向 +z 的面板
      if (isFront) {
        const sideW = (w - w * 0.42) / 2;
        const doorH = geo.h * 0.72;
        for (const s of [-1, 1]) {
          const seg = this.mesh(new THREE.BoxGeometry(sideW, geo.h, 0.45), M.wall, 0, 0, 0);
          const off = (w * 0.42 / 2 + sideW / 2);
          seg.position.set(px - sa * s * off, yBase + geo.h / 2, pz + ca * s * off);
          seg.rotation.y = Math.PI / 2 - a;
          seg.userData.radial = [ca, sa];
          g.add(seg);
        }
        const lintel = this.mesh(new THREE.BoxGeometry(w * 0.42, geo.h - doorH, 0.45), M.wall, px, yBase + doorH + (geo.h - doorH) / 2, pz);
        lintel.rotation.y = Math.PI / 2 - a;
        lintel.userData.radial = [ca, sa];
        g.add(lintel);
        for (const s of [-1, 1]) {
          const leaf = this.mesh(new THREE.BoxGeometry(w * 0.19, doorH, 0.14), M.door, 0, 0, 0);
          leaf.position.set(px - sa * s * w * 0.095 + ca * 0.26, yBase + doorH / 2, pz + ca * s * w * 0.095 + sa * 0.26);
          leaf.rotation.y = (Math.PI / 2 - a) + s * 0.35;
          leaf.userData.radial = [ca, sa];
          g.add(leaf);
        }
      } else {
        const panel = this.mesh(new THREE.BoxGeometry(w, geo.h, 0.45), M.wall, px, yBase + geo.h / 2, pz);
        panel.rotation.y = Math.PI / 2 - a;
        panel.userData.radial = [ca, sa];
        g.add(panel);
        const win = this.mesh(new THREE.BoxGeometry(w * 0.4, geo.h * 0.34, 0.12), M.dark,
          ca * (geo.r + 0.26), yBase + geo.h * 0.55, sa * (geo.r + 0.26));
        win.rotation.y = Math.PI / 2 - a;
        win.userData.radial = [ca, sa];
        g.add(win);
      }
    }
  },

  buildBrackets(g, M, geo, yBase) {
    for (let i = 0; i < geo.n; i++) {
      const a = (i / geo.n) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const asm = new THREE.Group();
      asm.position.set(ca * geo.r, yBase, sa * geo.r);
      asm.rotation.y = Math.PI / 2 - a;
      asm.add(this.mesh(new THREE.BoxGeometry(0.55, 0.4, 0.55), M.bracket, 0, 0.2, 0));
      asm.add(this.mesh(new THREE.BoxGeometry(1.8, 0.3, 0.5), M.bracket, 0, 0.55, 0));
      for (const s of [-1, 1]) {
        asm.add(this.mesh(new THREE.BoxGeometry(0.38, 0.32, 0.4), M.bracket, s * 0.7, 0.85, 0));
      }
      const ang = this.mesh(new THREE.BoxGeometry(1.5, 0.26, 0.4), M.bracket, 0, 0.75, 0.55);
      ang.rotation.x = -0.42;
      asm.add(ang);
      asm.userData.radial = [ca, sa];
      g.add(asm);
    }
  },

  buildEave(g, M, geo, yBase) {
    const cone = this.mesh(new THREE.CylinderGeometry(1.1, geo.r, geo.h, 8, 1, true), M.roof, 0, yBase + geo.h / 2, 0);
    cone.rotation.y = Math.PI / 8;
    g.add(cone);
    const edge = this.mesh(new THREE.CylinderGeometry(geo.r + 0.06, geo.r + 0.06, 0.22, 8, 1, true), M.roofDark, 0, yBase + 0.11, 0);
    edge.rotation.y = Math.PI / 8;
    g.add(edge);
    const cap = this.mesh(new THREE.CircleGeometry(1.15, 8), M.roofDark, 0, yBase + geo.h, 0);
    cap.rotation.x = -Math.PI / 2;
    cap.rotation.z = Math.PI / 8;
    g.add(cap);
  },

  buildBalcony(g, M, geo, yBase) {
    const deck = this.octRing(geo.r, geo.r - 1.7, 0.55, M.stone);
    deck.position.y = yBase;
    g.add(deck);
    const rail = this.octRing(geo.r, geo.r - 0.5, 0.16, M.column);
    rail.position.y = yBase + 0.85;
    g.add(rail);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      g.add(this.mesh(new THREE.BoxGeometry(0.13, 0.85, 0.13), M.column,
        Math.cos(a) * (geo.r - 0.28), yBase + 0.45, Math.sin(a) * (geo.r - 0.28)));
    }
  },

  buildSpire(g, M, yBase) {
    const base = this.mesh(new THREE.CylinderGeometry(2.3, 2.6, 0.6, 8), M.gold, 0, yBase + 0.3, 0);
    base.rotation.y = Math.PI / 8;
    g.add(base);
    g.add(this.mesh(new THREE.CylinderGeometry(0.16, 0.2, 7.6, 8), M.gold, 0, yBase + 4.2, 0));
    const bowl = this.mesh(new THREE.SphereGeometry(1.35, 12, 10), M.gold, 0, yBase + 1.5, 0);
    bowl.scale.y = 0.72;
    g.add(bowl);
    for (let i = 0; i < 5; i++) {
      g.add(this.mesh(new THREE.CylinderGeometry(1.05 - i * 0.13, 1.05 - i * 0.13, 0.2, 12), M.gold, 0, yBase + 2.5 + i * 0.58, 0));
    }
    g.add(this.mesh(new THREE.SphereGeometry(0.48, 10, 8), M.gold, 0, yBase + 5.9, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const top = new THREE.Vector3(Math.cos(a) * 0.5, yBase + 4.6, Math.sin(a) * 0.5);
      const corner = new THREE.Vector3(Math.cos(a) * 8.4, yBase + 0.4, Math.sin(a) * 8.4);
      g.add(this.beamBetween(top, corner, 0.06, M.gold));
    }
  },

  /* ================= 南禅寺大殿 · 构件几何 ================= */

  buildBoxPlatform(g, M, geo) {
    g.add(this.mesh(new THREE.BoxGeometry(geo.w, geo.h, geo.d), M.stone, 0, geo.h / 2, 0));
    g.add(this.mesh(new THREE.BoxGeometry(geo.w * 0.5, 0.5, geo.d + 1.6), M.stone, 0, 0.25, 0.6));
  },

  buildPerimColumns(g, M, geo, yBase) {
    const xs = [-geo.w / 2, -geo.w / 6, geo.w / 6, geo.w / 2];
    const zs = [-geo.d / 2, -geo.d / 6, geo.d / 6, geo.d / 2];
    for (const x of xs) {
      for (const z of zs) {
        if (Math.abs(x) < geo.w / 2 - 0.01 && Math.abs(z) < geo.d / 2 - 0.01) continue;
        const col = this.mesh(new THREE.CylinderGeometry(geo.r, geo.r * 1.12, geo.h, 10), M.column, x, yBase + geo.h / 2, z);
        col.userData.radial = [Math.sign(x) * (Math.abs(x) > 0.01 ? 1 : 0), Math.sign(z) * (Math.abs(z) > 0.01 ? 1 : 0)];
        g.add(col);
        const base = this.mesh(new THREE.CylinderGeometry(geo.r * 1.7, geo.r * 1.9, 0.4, 10), M.stone, x, yBase + 0.2, z);
        base.userData.radial = col.userData.radial;
        g.add(base);
      }
    }
  },

  buildInnerColumns(g, M, geo, yBase) {
    const xs = [-1.958, 1.958], zs = [-1.667, 1.667];
    for (const x of xs) {
      for (const z of zs) {
        const col = this.mesh(new THREE.CylinderGeometry(geo.r, geo.r * 1.1, geo.h, 10), M.column, x, yBase + geo.h / 2, z);
        col.userData.radial = [Math.sign(x) * 0.5, Math.sign(z) * 0.5];
        g.add(col);
        const base = this.mesh(new THREE.CylinderGeometry(geo.r * 1.7, geo.r * 1.9, 0.4, 10), M.stone, x, yBase + 0.2, z);
        base.userData.radial = col.userData.radial;
        g.add(base);
      }
    }
  },

  buildHallWalls(g, M, geo, yBase) {
    const t = 0.35, h = geo.h;
    const frontZ = geo.d / 2, backZ = -geo.d / 2;
    const leftX = -geo.w / 2, rightX = geo.w / 2;
    const back = this.mesh(new THREE.BoxGeometry(geo.w, h, t), M.wall, 0, yBase + h / 2, backZ);
    back.userData.radial = [0, -1];
    g.add(back);
    for (const s of [-1, 1]) {
      const side = this.mesh(new THREE.BoxGeometry(t, h, geo.d - 1.2), M.wall, s * leftX, yBase + h / 2, 0);
      side.userData.radial = [s, 0];
      g.add(side);
      const win = this.mesh(new THREE.BoxGeometry(0.12, h * 0.4, geo.d * 0.3), M.dark, s * (leftX + 0.24), yBase + h * 0.55, 0);
      win.userData.radial = [s, 0];
      g.add(win);
    }
    const bayW = geo.w / 3;
    for (let b = -1; b <= 1; b++) {
      const cx = b * bayW;
      const sideW = (bayW - bayW * 0.4) / 2;
      for (const s of [-1, 1]) {
        const seg = this.mesh(new THREE.BoxGeometry(sideW, h, t), M.wall, cx + s * (bayW * 0.2 + sideW / 2), yBase + h / 2, frontZ);
        seg.userData.radial = [0, 1];
        g.add(seg);
      }
      const doorH = h * 0.74;
      const lintel = this.mesh(new THREE.BoxGeometry(bayW * 0.4, h - doorH, t), M.wall, cx, yBase + doorH + (h - doorH) / 2, frontZ);
      lintel.userData.radial = [0, 1];
      g.add(lintel);
      for (const s of [-1, 1]) {
        const leaf = this.mesh(new THREE.BoxGeometry(bayW * 0.18, doorH, 0.12), M.door, cx + s * bayW * 0.09, yBase + doorH / 2, frontZ + 0.24);
        leaf.userData.radial = [0, 1];
        g.add(leaf);
      }
    }
  },

  buildHallBrackets(g, M, geo, yBase) {
    const archH = 0.35;
    const fb = this.mesh(new THREE.BoxGeometry(geo.w + 0.6, archH, 0.32), M.bracket, 0, yBase + archH / 2, geo.d / 2);
    g.add(fb);
    const fb2 = fb.clone(); fb2.position.z = -geo.d / 2; g.add(fb2);
    const lr = this.mesh(new THREE.BoxGeometry(0.32, archH, geo.d + 0.6), M.bracket, geo.w / 2, yBase + archH / 2, 0);
    g.add(lr);
    const lr2 = lr.clone(); lr2.position.x = -geo.w / 2; g.add(lr2);
    const xs = [-geo.w / 2, -geo.w / 6, geo.w / 6, geo.w / 2];
    const zs = [-geo.d / 2, -geo.d / 6, geo.d / 6, geo.d / 2];
    for (const x of xs) {
      for (const z of zs) {
        const isInner = Math.abs(x) < geo.w / 2 - 0.01 && Math.abs(z) < geo.d / 2 - 0.01;
        const asm = new THREE.Group();
        asm.position.set(x, yBase + archH, z);
        asm.rotation.y = (Math.abs(x) > Math.abs(z)) ? 0 : Math.PI / 2;
        asm.add(this.mesh(new THREE.BoxGeometry(0.6, 0.42, 0.6), M.bracket, 0, 0.21, 0));
        asm.add(this.mesh(new THREE.BoxGeometry(1.7, 0.3, 0.46), M.bracket, 0, 0.56, 0));
        for (const s of [-1, 1]) {
          asm.add(this.mesh(new THREE.BoxGeometry(0.4, 0.34, 0.42), M.bracket, s * 0.68, 0.88, 0));
        }
        const ang = this.mesh(new THREE.BoxGeometry(1.6, 0.26, 0.4), M.bracket, 0, 0.78, 0.6);
        ang.rotation.x = -0.4;
        asm.add(ang);
        if (isInner) asm.scale.setScalar(0.9);
        asm.userData.radial = [Math.sign(x) * (Math.abs(x) > 0.01 ? 0.4 : 0), Math.sign(z) * (Math.abs(z) > 0.01 ? 0.4 : 0)];
        g.add(asm);
      }
    }
  },

  buildBeams(g, M, geo, yBase) {
    for (const x of [-1.958, 1.958]) {
      g.add(this.mesh(new THREE.BoxGeometry(0.55, 0.72, geo.d), M.column, x, yBase + 0.36, 0));
      for (const z of [-1.667, 1.667]) {
        g.add(this.mesh(new THREE.BoxGeometry(0.72, 0.18, 0.72), M.bracket, x, yBase + 0.09, z));
        g.add(this.mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.85, 8), M.column, x, yBase + 1.1, z));
      }
    }
    for (const z of [-geo.d / 2, geo.d / 2]) {
      const purlin = this.mesh(new THREE.CylinderGeometry(0.17, 0.17, geo.w + 0.4, 8), M.column, 0, yBase, z);
      purlin.rotation.z = Math.PI / 2;
      g.add(purlin);
    }
  },

  buildPingliang(g, M, geo, yBase) {
    for (const x of [-1.958, 1.958]) {
      g.add(this.mesh(new THREE.BoxGeometry(0.42, 0.5, geo.d / 3 + 0.4), M.column, x, yBase + 0.25, 0));
      g.add(this.mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.8, 8), M.column, x, yBase + 0.9, 0));
    }
    const ridge = this.mesh(new THREE.CylinderGeometry(0.19, 0.19, geo.w + 0.4, 8), M.column, 0, yBase + 1.45, 0);
    ridge.rotation.z = Math.PI / 2;
    g.add(ridge);
    for (const z of [-geo.d / 6, geo.d / 6]) {
      const purlin = this.mesh(new THREE.CylinderGeometry(0.16, 0.16, geo.w + 0.4, 8), M.column, 0, yBase + 0.62, z);
      purlin.rotation.z = Math.PI / 2;
      g.add(purlin);
    }
  },

  buildChashou(g, M, geo, yBase) {
    for (const x of [-1.958, 1.958]) {
      for (const s of [-1, 1]) {
        const from = new THREE.Vector3(x, yBase - 0.25, s * (geo.d / 6 + 0.2));
        const to = new THREE.Vector3(x, yBase + 0.7, 0);
        g.add(this.beamBetween(from, to, 0.2, M.column));
      }
      for (const s of [-1, 1]) {
        const from = new THREE.Vector3(x, yBase - 0.25, 0);
        const to = new THREE.Vector3(x, yBase - 0.13, s * (geo.d / 6));
        g.add(this.beamBetween(from, to, 0.16, M.column));
      }
    }
  },

  hipRoofGeometry(w, d, rise, ridgeHalf) {
    const A = [-w / 2, 0, -d / 2], B = [w / 2, 0, -d / 2];
    const C = [w / 2, 0, d / 2], D = [-w / 2, 0, d / 2];
    const E = [-ridgeHalf, rise, 0], F = [ridgeHalf, rise, 0];
    const tris = [
      [A, B, F], [A, F, E],
      [C, D, E], [C, E, F],
      [D, A, E],
      [B, C, F]
    ];
    const pos = [];
    for (const t of tris) for (const v of t) pos.push(v[0], v[1], v[2]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    return geo;
  },

  buildHipRoof(g, M, geo, yBase) {
    const roof = new THREE.Mesh(this.hipRoofGeometry(geo.w, geo.d, geo.rise, geo.ridge), M.roof);
    roof.position.y = yBase;
    roof.castShadow = true;
    g.add(roof);
    // 山花（歇山意象）：脊端下三角山板
    for (const s of [-1, 1]) {
      const x = s * (geo.ridge + 0.2);
      const verts = new Float32Array([
        x, yBase + geo.rise + 0.1, 0,
        x, yBase + geo.rise - 1.7, -1.8,
        x, yBase + geo.rise - 1.7, 1.8
      ]);
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.BufferAttribute(verts, 3));
      sg.computeVertexNormals();
      const m = new THREE.Mesh(sg, M.wallIn);
      g.add(m);
    }
  },

  buildRidge(g, M, geo, yBase) {
    const topY = yBase + geo.rise;
    g.add(this.mesh(new THREE.BoxGeometry(geo.ridge * 2 + 0.9, 0.5, 0.55), M.roofDark, 0, topY + 0.22, 0));
    for (const s of [-1, 1]) {
      for (const t of [-1, 1]) {
        const from = new THREE.Vector3(s * geo.ridge, topY + 0.1, 0);
        const to = new THREE.Vector3(s * geo.w / 2, yBase + 0.05, t * geo.d / 2);
        g.add(this.beamBetween(from, to, 0.3, M.roofDark));
      }
    }
    for (const s of [-1, 1]) {
      g.add(this.mesh(new THREE.BoxGeometry(0.7, 1.1, 0.6), M.roofDark, s * (geo.ridge + 0.35), topY + 0.75, 0));
      const tail = this.mesh(new THREE.TorusGeometry(0.42, 0.14, 8, 10, Math.PI * 0.9), M.roofDark, s * (geo.ridge + 0.35), topY + 1.35, 0);
      tail.rotation.z = s * 0.5;
      g.add(tail);
    }
  },

  /* ---------------- 构件注册 ---------------- */
  buildComponent(comp) {
    const M = this.makeMats();
    const g = new THREE.Group();
    const geo = comp.geo;
    const def = this.building;

    if (def.id === "yx") {
      // 竖直定位（自下而上）
      const colBase = { 1: 2.5, 2: 21.8, 3: 34.1, 4: 45.9, 5: 57.2 };
      const colH = { 2: 8, 3: 7.5, 4: 7, 5: 6.5 };
      const wallBase = { 1: 8.5, 2: 21.8, 3: 34.1, 4: 45.9, 5: 57.2 };
      const brBase = { 1: 17.5, 2: 29.8, 3: 41.6, 4: 52.9, 5: 63.7 };
      const eaveBase = { 2: 30.8, 3: 42.6, 4: 53.9, 5: 64.7 };
      const balBase = { 1: 21.1, 2: 33.4, 3: 45.2, 4: 56.5 };
      if (geo.kind === "platform") this.buildPlatform(g, M, geo);
      else if (geo.kind === "porchColumns") this.buildPorchColumns(g, M, geo, colBase[1]);
      else if (geo.kind === "storyColumns") this.buildStoryColumns(g, M, geo, colBase[geo.story]);
      else if (geo.kind === "wall") this.buildWall(g, M, geo, wallBase[geo.story]);
      else if (geo.kind === "brackets") this.buildBrackets(g, M, geo, brBase[geo.story]);
      else if (geo.kind === "eave") {
        const yB = geo.story === 1 ? (comp.id === "YX-14" ? 8.5 : 18.7) : eaveBase[geo.story];
        this.buildEave(g, M, geo, yB);
      }
      else if (geo.kind === "balcony") this.buildBalcony(g, M, geo, balBase[geo.story]);
      else if (geo.kind === "spire") this.buildSpire(g, M, 67.3);
    } else {
      const yCol = 1.2;
      if (geo.kind === "boxPlatform") this.buildBoxPlatform(g, M, geo);
      else if (geo.kind === "perimColumns") this.buildPerimColumns(g, M, geo, yCol);
      else if (geo.kind === "innerColumns") this.buildInnerColumns(g, M, geo, yCol);
      else if (geo.kind === "walls") this.buildHallWalls(g, M, geo, yCol);
      else if (geo.kind === "brackets") this.buildHallBrackets(g, M, geo, yCol + 5);
      else if (geo.kind === "beams") this.buildBeams(g, M, geo, yCol + 6.45);
      else if (geo.kind === "pingliang") this.buildPingliang(g, M, geo, yCol + 7.6);
      else if (geo.kind === "chashou") this.buildChashou(g, M, geo, yCol + 8.35);
      else if (geo.kind === "roof") this.buildHipRoof(g, M, geo, yCol + 8.8);
      else if (geo.kind === "ridge") this.buildRidge(g, M, geo, yCol + 8.8);
    }

    // 注册网格：基准位置 + 拆解位移
    const radial = comp.radial || 0;
    const meshes = [];
    g.traverse((o) => {
      if (o.isMesh) {
        o.userData.compId = comp.id;
        const rv = o.userData.radial || [0, 0];
        o.userData.basePos = o.position.clone();
        o.userData.explodeVec = new THREE.Vector3(
          comp.explode[0] + rv[0] * radial,
          comp.explode[1],
          comp.explode[2] + rv[1] * radial
        );
        meshes.push(o);
        this.pickMeshes.push(o);
      }
    });

    const box = new THREE.Box3().setFromObject(g);
    const anchor = box.getCenter(new THREE.Vector3());
    anchor.y = box.max.y + 0.6;

    this.scene.add(g);
    return {
      id: comp.id, name: comp.name, desc: comp.desc,
      layerId: null, group: g, meshes: meshes,
      mats: Object.values(M), visible: true, red: false,
      explode: new THREE.Vector3(comp.explode[0], comp.explode[1], comp.explode[2]),
      anchor: anchor
    };
  },

  /* ---------------- 分层树 UI ---------------- */
  buildLayerTree() {
    const tree = document.getElementById("layer-tree");
    tree.innerHTML = "";
    for (const layer of this.building.layers) {
      const group = document.createElement("div");
      group.className = "layer-group";

      const row = document.createElement("div");
      row.className = "layer-row";
      row.dataset.layer = layer.id;
      row.innerHTML = '<span class="layer-name">' + layer.name + "</span>" +
        '<button class="layer-toggle" type="button">隐藏</button>';
      row.addEventListener("click", (e) => {
        if (e.target.classList.contains("layer-toggle")) return;
        this.selectLayer(layer.id);
      });
      row.querySelector(".layer-toggle").addEventListener("click", () => this.toggleLayer(layer.id));
      group.appendChild(row);

      for (const comp of layer.comps) {
        const c = this.comps.find((x) => x.id === comp.id);
        c.layerId = layer.id;
        const cr = document.createElement("div");
        cr.className = "comp-row";
        cr.dataset.comp = comp.id;
        cr.innerHTML = '<span class="comp-id">' + comp.id + "</span>" +
          '<span class="comp-name">' + comp.name + "</span>" +
          '<button class="comp-eye" type="button">隐</button>';
        cr.addEventListener("click", (e) => {
          if (e.target.classList.contains("comp-eye")) return;
          this.selectComp(comp.id);
        });
        cr.querySelector(".comp-eye").addEventListener("click", () => this.toggleComp(comp.id));
        group.appendChild(cr);
      }
      tree.appendChild(group);
    }
  },

  /* ---------------- 选择与高亮 ---------------- */
  setEmissive(comp, hex, intensity) {
    for (const m of comp.mats) {
      m.emissive = new THREE.Color(hex);
      m.emissiveIntensity = intensity;
    }
  },

  refreshHighlights() {
    for (const c of this.comps) {
      if (c.red) this.setEmissive(c, 0xff2418, 0.85);
      else if (c.id === this.selected) this.setEmissive(c, 0xc9a06a, 0.55);
      else if (c.id === this.hovered) this.setEmissive(c, 0xc9a06a, 0.3);
      else this.setEmissive(c, 0x000000, 0);
    }
  },

  selectComp(id) {
    this.selected = id;
    const c = this.comps.find((x) => x.id === id);
    const layer = this.building.layers.find((l) => l.id === c.layerId);
    document.getElementById("info-empty").hidden = true;
    document.getElementById("info-body").hidden = false;
    document.getElementById("info-id").textContent = c.id;
    document.getElementById("info-name").textContent = c.name;
    document.getElementById("info-layer").textContent = "所属分层：" + (layer ? layer.name : "--");
    document.getElementById("info-desc").textContent = c.desc;
    this.refreshHighlights();
    this.syncTree();
  },

  selectLayer(layerId) {
    this.selected = null;
    const layer = this.building.layers.find((l) => l.id === layerId);
    document.getElementById("info-empty").hidden = true;
    document.getElementById("info-body").hidden = false;
    document.getElementById("info-id").textContent = layer.name;
    document.getElementById("info-name").textContent = layer.comps.length + " 个构件";
    document.getElementById("info-layer").textContent = "分层总览";
    document.getElementById("info-desc").textContent =
      "该分层包含：" + layer.comps.map((c) => c.id + " " + c.name).join("、") + "。点击模型或列表中的构件可单独查看。";
    this.refreshHighlights();
    this.syncTree();
  },

  clearSelection() {
    this.selected = null;
    document.getElementById("info-empty").hidden = false;
    document.getElementById("info-body").hidden = true;
    this.refreshHighlights();
    this.syncTree();
  },

  syncTree() {
    document.querySelectorAll(".comp-row").forEach((el) => {
      const c = this.comps.find((x) => x.id === el.dataset.comp);
      el.classList.toggle("selected", el.dataset.comp === this.selected);
      el.classList.toggle("hidden-comp", !c.visible);
      el.querySelector(".comp-eye").textContent = c.visible ? "隐" : "显";
    });
    document.querySelectorAll(".layer-row").forEach((el) => {
      const layer = this.building.layers.find((l) => l.id === el.dataset.layer);
      const allOff = layer.comps.every((c) => !this.comps.find((x) => x.id === c.id).visible);
      el.classList.toggle("off", allOff);
      el.querySelector(".layer-toggle").textContent = allOff ? "显示" : "隐藏";
    });
  },

  /* ---------------- 隐藏 / 隔离 / 高亮 ---------------- */
  toggleComp(id) {
    const c = this.comps.find((x) => x.id === id);
    c.visible = !c.visible;
    c.group.visible = c.visible;
    this.syncTree();
    this.refreshLabels();
  },

  toggleLayer(layerId) {
    const layer = this.building.layers.find((l) => l.id === layerId);
    const allOff = layer.comps.every((c) => !this.comps.find((x) => x.id === c.id).visible);
    for (const c of layer.comps) {
      const comp = this.comps.find((x) => x.id === c.id);
      comp.visible = allOff;
      comp.group.visible = allOff;
    }
    this.syncTree();
    this.refreshLabels();
  },

  isolateSelected() {
    if (!this.selected) { this.toast("请先选中一个构件"); return; }
    this.savedVisible = this.comps.map((c) => c.visible);
    this.isolated = true;
    for (const c of this.comps) {
      const keep = c.id === this.selected;
      c.visible = keep;
      c.group.visible = keep;
    }
    document.getElementById("btn-unisolate").hidden = false;
    this.syncTree();
    this.refreshLabels();
    this.toast("已隔离 " + this.selected + " " + this.comps.find((c) => c.id === this.selected).name);
  },

  hideSelected() {
    if (!this.selected) { this.toast("请先选中一个构件"); return; }
    const c = this.comps.find((x) => x.id === this.selected);
    c.visible = false;
    c.group.visible = false;
    this.syncTree();
    this.refreshLabels();
    this.toast("已隐藏 " + c.id + " " + c.name);
  },

  unisolate() {
    if (this.savedVisible) {
      this.comps.forEach((c, i) => {
        c.visible = this.savedVisible[i];
        c.group.visible = c.visible;
      });
    }
    this.isolated = false;
    this.savedVisible = null;
    document.getElementById("btn-unisolate").hidden = true;
    this.syncTree();
    this.refreshLabels();
  },

  toggleRed() {
    if (!this.selected) { this.toast("请先选中一个构件"); return; }
    const c = this.comps.find((x) => x.id === this.selected);
    c.red = !c.red;
    this.refreshHighlights();
    this.toast(c.red ? "已对 " + c.id + " 红色高亮" : "已取消 " + c.id + " 的红色高亮");
  },

  /* ---------------- 标签 ---------------- */
  buildLabels() {
    this.labels.forEach((l) => l.el.remove());
    this.labels = [];
    const show = document.getElementById("chk-labels").checked;
    for (const c of this.comps) {
      const el = document.createElement("div");
      el.className = "label3d";
      el.innerHTML = '<span class="lid">' + c.id + "</span>" + c.name;
      el.style.display = show ? "" : "none";
      this.labelLayer.appendChild(el);
      this.labels.push({ el, comp: c });
    }
  },

  refreshLabels() {
    const show = document.getElementById("chk-labels").checked;
    for (const l of this.labels) {
      l.el.style.display = show && l.comp.visible ? "" : "none";
    }
  },

  updateLabels() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const v = new THREE.Vector3();
    const items = [];
    for (const l of this.labels) {
      if (l.el.style.display === "none") continue;
      v.copy(l.comp.anchor).addScaledVector(l.comp.explode, this.explodeT);
      v.project(this.camera);
      if (v.z > 1) { l.el.style.opacity = "0"; continue; }
      l.el.style.opacity = "";
      items.push({
        el: l.el,
        x: (v.x * 0.5 + 0.5) * w,
        y: (-v.y * 0.5 + 0.5) * h
      });
    }
    // 屏幕空间垂直去重叠：过于接近的标签依次下移
    items.sort((a, b) => a.y - b.y);
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 1; i < items.length; i++) {
        const a = items[i - 1], b = items[i];
        if (Math.abs(a.x - b.x) < 100 && b.y - a.y < 17) {
          b.y = a.y + 17;
        }
      }
    }
    for (const it of items) {
      it.el.style.left = it.x + "px";
      it.el.style.top = it.y + "px";
    }
  },

  /* ---------------- 交互事件 ---------------- */
  bindEvents() {
    const dom = this.renderer.domElement;
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downX = 0, downY = 0;

    const pickComp = (e) => {
      const r = dom.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(mouse, this.camera);
      const hits = ray.intersectObjects(this.pickMeshes, false);
      for (const h of hits) {
        let o = h.object, vis = true;
        while (o) { if (o.visible === false) { vis = false; break; } o = o.parent; }
        if (vis) return h.object.userData.compId;
      }
      return null;
    };

    dom.addEventListener("pointermove", (e) => {
      const id = pickComp(e);
      if (id !== this.hovered) {
        this.hovered = id;
        this.refreshHighlights();
        dom.style.cursor = id ? "pointer" : "";
      }
      if (id) {
        const c = this.comps.find((x) => x.id === id);
        this.tip.innerHTML = '<span class="ht-id">' + c.id + "</span>" + c.name;
        this.tip.hidden = false;
        const r = dom.getBoundingClientRect();
        this.tip.style.left = (e.clientX - r.left) + "px";
        this.tip.style.top = (e.clientY - r.top) + "px";
      } else {
        this.tip.hidden = true;
      }
    });

    dom.addEventListener("pointerdown", (e) => { downX = e.clientX; downY = e.clientY; });
    dom.addEventListener("pointerup", (e) => {
      if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) return;
      const id = pickComp(e);
      if (id) this.selectComp(id);
      else this.clearSelection();
    });

    dom.addEventListener("pointerleave", () => {
      this.hovered = null;
      this.tip.hidden = true;
      this.refreshHighlights();
    });

    document.getElementById("explode-range").addEventListener("input", (e) => {
      this.setExplode(e.target.value / 100);
    });
    document.getElementById("btn-assemble").addEventListener("click", () => this.setExplode(0));
    document.getElementById("btn-explode").addEventListener("click", () => this.setExplode(1));
    document.getElementById("btn-autorotate").addEventListener("click", (e) => {
      this.autoRotate = !this.autoRotate;
      this.controls.autoRotate = this.autoRotate;
      e.target.style.borderColor = this.autoRotate ? "#c9a06a" : "";
      e.target.style.color = this.autoRotate ? "#c9a06a" : "";
    });
    document.getElementById("btn-reset-view").addEventListener("click", () => {
      this.camera.position.copy(this.camHome.pos);
      this.controls.target.copy(this.camHome.tgt);
    });
    document.getElementById("chk-labels").addEventListener("change", () => this.refreshLabels());
    document.getElementById("btn-isolate").addEventListener("click", () => this.isolateSelected());
    document.getElementById("btn-hide").addEventListener("click", () => this.hideSelected());
    document.getElementById("btn-red").addEventListener("click", () => this.toggleRed());
    document.getElementById("btn-unisolate").addEventListener("click", () => this.unisolate());
    document.getElementById("btn-building-info").addEventListener("click", () => this.openModal());
    document.getElementById("btn-modal-close").addEventListener("click", () => this.closeModal());
    document.getElementById("modal-info").addEventListener("click", (e) => {
      if (e.target.id === "modal-info") this.closeModal();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!document.getElementById("modal-info").hidden) this.closeModal();
      else if (this.isolated) this.unisolate();
      else this.clearSelection();
    });
  },

  setExplode(t) {
    const delta = t - this.explodeTarget;
    this.explodeTarget = t;
    // 相机随拆解程度上移/下移，保持拆解后的塔身完整在画面中
    this.controls.target.y += delta * 16;
    this.camera.position.y += delta * 9;
    document.getElementById("explode-range").value = Math.round(t * 100);
    document.getElementById("explode-value").textContent = Math.round(t * 100) + "%";
  },

  /* ---------------- 模态框 ---------------- */
  openModal() {
    const b = this.building;
    document.getElementById("modal-title").textContent = b.fullName + " · 建筑档案";
    let html = "<p>" + b.intro + "</p><h4>档案</h4>";
    for (const [k, v] of b.facts) {
      html += '<div class="kv"><b>' + k + "</b><span>" + v + "</span></div>";
    }
    html += "<h4>分层结构</h4><p>" + b.layers.map((l) => l.name).join(" → ") + "</p>";
    document.getElementById("modal-body").innerHTML = html;
    document.getElementById("modal-info").hidden = false;
  },

  closeModal() {
    document.getElementById("modal-info").hidden = true;
  },

  toast(msg) {
    let el = document.getElementById("bv-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "bv-toast";
      el.style.cssText = "position:absolute;top:70px;left:50%;transform:translateX(-50%);" +
        "background:rgba(18,18,26,.95);border:1px solid #8a6f45;color:#e8c88f;" +
        "padding:8px 20px;font-size:13px;letter-spacing:2px;border-radius:3px;" +
        "z-index:60;transition:opacity .3s;pointer-events:none;";
      document.getElementById("view-building").appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.style.opacity = "0"; }, 1800);
  },

  /* ---------------- 场景构建与切换 ---------------- */
  clearScene() {
    for (const c of this.comps) {
      this.scene.remove(c.group);
      c.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      c.mats.forEach((m) => m.dispose());
    }
    this.comps = [];
    this.pickMeshes = [];
    this.labels.forEach((l) => l.el.remove());
    this.labels = [];
    this.selected = null;
    this.hovered = null;
    this.isolated = false;
    this.savedVisible = null;
    this.explodeT = 0;
    this.explodeTarget = 0;
    document.getElementById("btn-unisolate").hidden = true;
    document.getElementById("explode-range").value = 0;
    document.getElementById("explode-value").textContent = "0%";
  },

  loadBuilding(key) {
    this.clearScene();
    this.building = BUILDINGS[key];

    if (key === "yx") {
      this.camHome = { pos: new THREE.Vector3(56, 30, 78), tgt: new THREE.Vector3(0, 33, 0) };
    } else {
      this.camHome = { pos: new THREE.Vector3(24, 16, 30), tgt: new THREE.Vector3(0, 6, 0) };
    }
    this.camera.position.copy(this.camHome.pos);
    this.controls.target.copy(this.camHome.tgt);

    for (const layer of this.building.layers) {
      for (const comp of layer.comps) {
        this.comps.push(this.buildComponent(comp));
      }
    }

    document.getElementById("building-title").textContent =
      this.building.name + " · " + this.building.dynasty + " · " + this.building.year;
    document.getElementById("btn-switch-building").textContent =
      "切换：" + (key === "yx" ? "南禅寺大殿" : "应县木塔");

    this.buildLayerTree();
    this.buildLabels();
    this.clearSelection();
    this.syncTree();
  },

  enter(key) {
    this.init();
    this.loadBuilding(key);
    this.loop();
  },

  leave() {
    cancelAnimationFrame(this.raf);
  },

  loop() {
    cancelAnimationFrame(this.raf);
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.explodeT += (this.explodeTarget - this.explodeT) * 0.1;
      if (Math.abs(this.explodeTarget - this.explodeT) < 0.001) this.explodeT = this.explodeTarget;
      for (const c of this.comps) {
        for (const m of c.meshes) {
          m.position.copy(m.userData.basePos).addScaledVector(m.userData.explodeVec, this.explodeT);
        }
      }
      this.controls.update();
      this.updateLabels();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  },

  onResize() {
    if (!this.renderer) return;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
};
