/* ========== 视图二：山西三维省域 ========== */

const ProvinceView = {
  scene: null, camera: null, renderer: null, controls: null,
  raf: 0, inited: false, markers: [], geoLabels: [],
  host: null, labelLayer: null,

  /* 山西省中心与比例（1 单位 ≈ 10 公里） */
  CENTER: { lon: 112.4, lat: 37.6 },
  SCALE: 10 / 85, // 经度方向（37°N 处 1° ≈ 85km）
  LAT_SCALE: 10 / 111,

  toWorld(lon, lat) {
    return [(lon - this.CENTER.lon) * 85 * this.SCALE, (lat - this.CENTER.lat) * 111 * this.LAT_SCALE];
  },

  init() {
    if (this.inited) return;
    this.inited = true;
    this.host = document.getElementById("province-canvas");
    this.labelLayer = document.getElementById("province-labels");

    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0b10);
    this.scene.fog = new THREE.Fog(0x0b0b10, 90, 220);

    this.camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 500);
    this.camera.position.set(34, 42, 62);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.host.appendChild(this.renderer.domElement);

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.46;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 160;
    this.controls.target.set(0, 2, 0);

    this.buildLights();
    this.buildTerrain();
    this.buildMarkers();
    this.buildGeoLabels();
    this.bindMarkerEvents();

    window.addEventListener("resize", () => this.onResize());
  },

  bindMarkerEvents() {
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const dom = this.renderer.domElement;
    let downX = 0, downY = 0;
    dom.addEventListener("pointerdown", (e) => { downX = e.clientX; downY = e.clientY; });
    dom.addEventListener("pointerup", (e) => {
      if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) return;
      const r = dom.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(mouse, this.camera);
      const hits = ray.intersectObjects(this.markers.map((m) => m.hit), false);
      if (hits.length) App.enterBuilding(hits[0].object.userData.buildingKey);
    });
    dom.addEventListener("pointermove", (e) => {
      const r = dom.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(mouse, this.camera);
      const hits = ray.intersectObjects(this.markers.map((m) => m.hit), false);
      dom.style.cursor = hits.length ? "pointer" : "";
    });
  },

  buildLights() {
    this.scene.add(new THREE.AmbientLight(0x8a8a9a, 0.55));
    const hemi = new THREE.HemisphereLight(0xcfd4e8, 0x2a2418, 0.5);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe0b0, 1.15);
    sun.position.set(40, 60, 25);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x6a7aff, 0.3);
    rim.position.set(-35, 25, -40);
    this.scene.add(rim);
  },

  /* 确定性 value noise */
  hash(x, z) {
    const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return s - Math.floor(s);
  },
  valueNoise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = this.hash(xi, zi), b = this.hash(xi + 1, zi);
    const c = this.hash(xi, zi + 1), d = this.hash(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  },
  fbm(x, z) {
    return this.valueNoise(x, z) * 0.58 +
           this.valueNoise(x * 2.13, z * 2.13) * 0.29 +
           this.valueNoise(x * 4.31, z * 4.31) * 0.13;
  },
  smoothstep(e0, e1, x) {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  },

  terrainHeight(lon, lat) {
    let h = this.fbm(lon * 0.32, lat * 0.32) * 11.0;
    h += this.smoothstep(112.9, 114.6, lon) * 11.0;  // 太行山脉（东缘）
    h += this.smoothstep(111.7, 110.2, lon) * 9.0;   // 吕梁山脉（西缘）
    h += this.smoothstep(36.8, 40.6, lat) * 3.0;     // 北部偏高
    h -= 3.0;                                        // 中部盆地
    return Math.max(h, 0.3);
  },

  buildTerrain() {
    const ring = GeoUtil.mainPolygon(CHINA_GEO, 140000);
    if (!ring) return;

    /* 世界坐标包围盒 */
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    const pts = [];
    for (const c of ring) {
      const [wx, wz] = this.toWorld(c[0], c[1]);
      pts.push([wx, wz]);
      minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
      minZ = Math.min(minZ, wz); maxZ = Math.max(maxZ, wz);
    }

    /* 网格 + 点在多边形内裁剪 */
    const step = 0.55;
    const cols = Math.ceil((maxX - minX) / step) + 1;
    const rows = Math.ceil((maxZ - minZ) / step) + 1;
    const inside = (x, z) => {
      let hit = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
        if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) hit = !hit;
      }
      return hit;
    };

    const positions = [], colors = [], indices = [];
    const indexMap = new Map();
    const cLow = new THREE.Color(0x27331f), cMid = new THREE.Color(0x4d4a33);
    const cHigh = new THREE.Color(0x6e675a), cTop = new THREE.Color(0x8d867a);
    const tmp = new THREE.Color();

    const vid = (x, z) => {
      const key = x.toFixed(2) + "," + z.toFixed(2);
      if (indexMap.has(key)) return indexMap.get(key);
      const lon = x / (85 * this.SCALE) + this.CENTER.lon;
      const lat = z / (111 * this.LAT_SCALE) + this.CENTER.lat;
      const h = this.terrainHeight(lon, lat);
      const idx = positions.length / 3;
      positions.push(x, h, z);
      const t = Math.min(1, h / 12);
      if (t < 0.4) tmp.lerpColors(cLow, cMid, t / 0.4);
      else if (t < 0.75) tmp.lerpColors(cMid, cHigh, (t - 0.4) / 0.35);
      else tmp.lerpColors(cHigh, cTop, (t - 0.75) / 0.25);
      colors.push(tmp.r, tmp.g, tmp.b);
      indexMap.set(key, idx);
      return idx;
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = minX + c * step, z = minZ + r * step;
        const x1 = x + step, z1 = z + step;
        if (inside(x, z) && inside(x1, z) && inside(x, z1)) {
          indices.push(vid(x, z), vid(x1, z), vid(x1, z1));
          indices.push(vid(x, z), vid(x1, z1), vid(x, z1));
        } else if (inside(x, z) && inside(x1, z1) && inside(x, z1)) {
          indices.push(vid(x, z), vid(x1, z1), vid(x, z1));
        } else if (inside(x, z) && inside(x1, z) && inside(x1, z1)) {
          indices.push(vid(x, z), vid(x1, z), vid(x1, z1));
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    this.scene.add(mesh);

    /* 省界金线 */
    const linePts = [];
    for (const [wx, wz] of pts) {
      const lon = wx / (85 * this.SCALE) + this.CENTER.lon;
      const lat = wz / (111 * this.LAT_SCALE) + this.CENTER.lat;
      linePts.push(new THREE.Vector3(wx, this.terrainHeight(lon, lat) + 0.25, wz));
    }
    linePts.push(linePts[0].clone());
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xc9a06a, transparent: true, opacity: 0.85 }));
    this.scene.add(line);

    /* 底座圆盘 */
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(58, 64),
      new THREE.MeshStandardMaterial({ color: 0x0d0d14, roughness: 1 })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.6;
    this.scene.add(disc);
  },

  buildMarkers() {
    const defs = [
      { key: "yx", name: "应县木塔", sub: "辽 · 1056", lon: 113.18, lat: 39.56 },
      { key: "nc", name: "南禅寺大殿", sub: "唐 · 782", lon: 112.99, lat: 38.68 }
    ];
    for (const d of defs) {
      const [wx, wz] = this.toWorld(d.lon, d.lat);
      const h = this.terrainHeight(d.lon, d.lat);
      const group = new THREE.Group();
      group.position.set(wx, h, wz);

      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.55, 9, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xc9a06a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
      );
      pillar.position.y = 4.5;
      group.add(pillar);

      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.9),
        new THREE.MeshStandardMaterial({ color: 0xe8c88f, emissive: 0x8a6a30, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.6 })
      );
      gem.position.y = 9.6;
      group.add(gem);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.2, 1.7, 32),
        new THREE.MeshBasicMaterial({ color: 0xc9a06a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.15;
      group.add(ring);

      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 11, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 5;
      hit.userData.buildingKey = d.key;
      group.add(hit);

      this.scene.add(group);
      this.markers.push({ group, gem, ring, hit, key: d.key });

      const el = document.createElement("div");
      el.className = "label3d major";
      el.innerHTML = d.name + ' <span style="color:#9a937f">' + d.sub + "</span>";
      this.labelLayer.appendChild(el);
      this.markers[this.markers.length - 1].label = el;
    }
  },

  buildGeoLabels() {
    const defs = [
      { text: "太行山脉", lon: 114.1, lat: 37.2 },
      { text: "吕梁山脉", lon: 110.9, lat: 37.6 },
      { text: "汾河谷地", lon: 111.9, lat: 36.4 },
      { text: "太原盆地", lon: 112.5, lat: 37.8 }
    ];
    for (const d of defs) {
      const [wx, wz] = this.toWorld(d.lon, d.lat);
      const h = this.terrainHeight(d.lon, d.lat);
      const el = document.createElement("div");
      el.className = "label3d";
      el.style.opacity = "0.55";
      el.style.border = "none";
      el.style.background = "transparent";
      el.textContent = d.text;
      this.labelLayer.appendChild(el);
      this.geoLabels.push({ el, pos: new THREE.Vector3(wx, h + 1.2, wz) });
    }
  },

  enter() {
    this.init();
    this.loop();
    const cardYx = document.getElementById("card-yx");
    const cardNc = document.getElementById("card-nc");
    cardYx.onclick = () => App.enterBuilding("yx");
    cardNc.onclick = () => App.enterBuilding("nc");
  },

  leave() {
    cancelAnimationFrame(this.raf);
  },

  loop() {
    cancelAnimationFrame(this.raf);
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      const t = performance.now() * 0.001;
      for (const m of this.markers) {
        m.gem.rotation.y = t * 1.2;
        m.gem.position.y = 9.6 + Math.sin(t * 2) * 0.35;
        const s = 1 + Math.sin(t * 2.4) * 0.12;
        m.ring.scale.set(s, s, 1);
      }
      this.controls.update();
      this.updateLabels();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  },

  updateLabels() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const v = new THREE.Vector3();
    const place = (el, world, yOff) => {
      v.copy(world);
      if (yOff) v.y += yOff;
      v.project(this.camera);
      if (v.z > 1) { el.style.opacity = "0"; return; }
      el.style.opacity = "";
      el.style.left = ((v.x * 0.5 + 0.5) * w) + "px";
      el.style.top = ((-v.y * 0.5 + 0.5) * h) + "px";
    };
    for (const m of this.markers) {
      place(m.label, m.group.position, 11.2);
    }
    for (const g of this.geoLabels) {
      place(g.el, g.pos, 0);
    }
  },

  onResize() {
    if (!this.renderer) return;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
};
