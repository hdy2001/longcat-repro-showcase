/* ============================================================
 * 伞文化交互应用 · 主逻辑
 * 视图：首页时间轴 / 详情页(3D) / 世界伞文化
 * ============================================================ */

(() => {
  "use strict";

  /* ---------------- 全局状态 ---------------- */
  const state = {
    view: "home",          // home | detail | world
    index: 0,              // 当前伞序号
    umbrella: null,        // 当前3D伞实例
    autoRotate: true,
    idleTimer: null
  };

  const app = document.getElementById("app");
  const headerTitle = document.getElementById("header-title");
  const backBtn = document.getElementById("btn-back");

  /* ============================================================
   * 闭合伞线稿 SVG（首页卡片 / 时间轴用）
   * ============================================================ */
  function sketchSVG(model, color) {
    const dark = shadeHex(color, -30);
    return `
    <svg viewBox="0 0 200 268" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- 伞面（收拢态） -->
      <path d="M100 34 C 86 88 83 132 87 168 L 113 168 C 117 132 114 88 100 34 Z"
            fill="${color}" opacity="0.92"/>
      <path d="M100 34 C 94 88 92 132 94 168 L 100 168 L 100 34 Z"
            fill="${dark}" opacity="0.35"/>
      <!-- 伞骨细线 -->
      <g stroke="${dark}" stroke-width="1" opacity="0.55">
        <line x1="100" y1="36" x2="88" y2="166"/>
        <line x1="100" y1="36" x2="94" y2="168"/>
        <line x1="100" y1="36" x2="100" y2="168"/>
        <line x1="100" y1="36" x2="106" y2="168"/>
        <line x1="100" y1="36" x2="112" y2="166"/>
      </g>
      <!-- 伞箍 -->
      <ellipse cx="100" cy="168" rx="14" ry="4.5" fill="${dark}"/>
      <!-- 伞柄 -->
      <line x1="100" y1="172" x2="100" y2="244" stroke="#6b4a2f" stroke-width="4.5" stroke-linecap="round"/>
      <!-- 柄尾 -->
      <circle cx="100" cy="248" r="4" fill="#6b4a2f"/>
      <!-- 伞顶宝珠 -->
      <circle cx="100" cy="30" r="5.5" fill="#c9a15a"/>
      <line x1="100" y1="24" x2="100" y2="14" stroke="#c9a15a" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`;
  }

  function shadeHex(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }

  /* ============================================================
   * 视图一：首页 · 时间轴
   * ============================================================ */
  function renderHome() {
    state.view = "home";
    headerTitle.textContent = "伞文化交互馆";
    backBtn.classList.add("hidden");

    const cards = CHINESE_UMBRELLAS.map((u, i) => `
      <button class="tl-card" data-index="${i}" aria-label="查看${u.dynasty}${u.name}">
        <span class="tl-dynasty">${u.dynasty}</span>
        <span class="tl-year">${u.period}</span>
        <span class="tl-sketch">${sketchSVG(u.model, u.model.canopyColor)}</span>
        <span class="tl-name">${u.name}</span>
        <span class="tl-name-en">${u.nameEn}</span>
        <span class="tl-tags">${u.tags.map(t => `<i>${t}</i>`).join("")}</span>
      </button>`).join("");

    app.innerHTML = `
      <section class="home-hero">
        <h1 class="hero-title">3D 古伞展览馆</h1>
        <p class="hero-sub">一柄伞的千年 · 中国历代代表性伞具 3D 交互陈列</p>
        <p class="hero-tip">点击伞面，看它撑开</p>
      </section>
      <section class="timeline">
        <div class="timeline-track">${cards}</div>
      </section>
      <section class="home-world-entry">
        <button id="btn-world">
          <span class="world-entry-title">世界伞文化</span>
          <span class="world-entry-sub">和伞 · 长柄伞 · 阳伞 · 纸伞 · 王伞</span>
          <span class="world-entry-arrow">→</span>
        </button>
      </section>`;

    app.querySelectorAll(".tl-card").forEach(btn => {
      btn.addEventListener("click", () => openDetail(parseInt(btn.dataset.index, 10)));
    });
    document.getElementById("btn-world").addEventListener("click", renderWorld);
  }

  /* ============================================================
   * 视图二：详情页 · 3D
   * ============================================================ */

  /* ----- Three.js 场景 ----- */
  let renderer, scene, camera, glCanvas;

  function initGL() {
    if (renderer) return;
    glCanvas = document.getElementById("gl");
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0.62, 3.6);
    camera.lookAt(0, -0.32, 0);

    // 灯光
    scene.add(new THREE.HemisphereLight(0xfff8ec, 0x9a8a6a, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(2.4, 3.2, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffe6c4, 0.4);
    fill.position.set(-3, 1.2, -2.5);
    scene.add(fill);
    const under = new THREE.PointLight(0xfff0dd, 0.5, 8);
    under.position.set(0, -2.2, 0.6);
    scene.add(under);

    resizeGL();
    window.addEventListener("resize", resizeGL);
    bindGLInteraction();
    requestAnimationFrame(renderLoop);
  }

  function resizeGL() {
    if (!renderer) return;
    const stage = document.getElementById("gl-stage");
    if (!stage) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ----- 触摸交互：拖动旋转 / 点击开合 / 横滑切换 ----- */
  function bindGLInteraction() {
    let dragging = false, moved = 0;
    let lastX = 0, lastY = 0, startX = 0, startY = 0, downTime = 0;

    glCanvas.addEventListener("pointerdown", e => {
      dragging = true; moved = 0;
      lastX = startX = e.clientX; lastY = startY = e.clientY;
      downTime = Date.now();
      glCanvas.setPointerCapture(e.pointerId);
      wakeAutoRotate();
    });
    glCanvas.addEventListener("pointermove", e => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 8 && state.umbrella) {
        state.umbrella.group.rotation.y += dx * 0.0085;
        state.umbrella.group.rotation.x = THREE.MathUtils.clamp(
          state.umbrella.group.rotation.x + dy * 0.004, -0.45, 0.55);
        state.autoRotate = false;
        clearTimeout(state.idleTimer);
        state.idleTimer = setTimeout(() => { state.autoRotate = true; }, 3200);
      }
    });
    glCanvas.addEventListener("pointerup", e => {
      if (!dragging) return;
      dragging = false;
      const totalX = e.clientX - startX, totalY = e.clientY - startY;
      const quick = Date.now() - downTime < 450;
      if (moved < 10 && quick) {
        // 点击：切换开合
        if (state.umbrella) {
          state.umbrella.toggleOpen();
          state.autoRotate = false;
          clearTimeout(state.idleTimer);
          state.idleTimer = setTimeout(() => { state.autoRotate = true; }, 3200);
        }
      } else if (Math.abs(totalX) > 64 && Math.abs(totalX) > Math.abs(totalY) * 1.6) {
        // 横滑：切换伞
        const dir = totalX < 0 ? 1 : -1;
        openDetail((state.index + dir + CHINESE_UMBRELLAS.length) % CHINESE_UMBRELLAS.length);
      }
    });
    glCanvas.addEventListener("pointercancel", () => { dragging = false; });
  }

  function wakeAutoRotate() {
    state.autoRotate = false;
    clearTimeout(state.idleTimer);
    state.idleTimer = setTimeout(() => { state.autoRotate = true; }, 3200);
  }

  /* ----- 渲染循环 ----- */
  function renderLoop() {
    requestAnimationFrame(renderLoop);
    if (state.view !== "detail" || !renderer) return;
    if (state.umbrella) {
      state.umbrella.update(1 / 60);
      if (state.autoRotate) {
        state.umbrella.group.rotation.y += 0.0035;
      }
    }
    renderer.render(scene, camera);
  }

  /* ----- 详情页渲染 ----- */
  function openDetail(index) {
    state.view = "detail";
    state.index = ((index % CHINESE_UMBRELLAS.length) + CHINESE_UMBRELLAS.length) % CHINESE_UMBRELLAS.length;
    const u = CHINESE_UMBRELLAS[state.index];

    headerTitle.textContent = `${u.dynasty} · ${u.name}`;
    backBtn.classList.remove("hidden");

    app.innerHTML = `
      <section class="detail" id="detail">
        <div class="gl-stage" id="gl-stage">
          <canvas id="gl"></canvas>
          <p class="gl-hint">拖动旋转 · 点击伞面开合 · 左右滑动换伞</p>
        </div>
        <div class="detail-info trigger" id="detail-info">
          <div class="info-head">
            <span class="dynasty-badge">${u.dynasty}</span>
            <div class="info-title-wrap">
              <h2 class="info-name">${u.name}</h2>
              <p class="info-name-en">${u.nameEn}</p>
            </div>
          </div>
          <div class="info-meta">
            <span class="period">${u.period}</span>
            <span class="tags">${u.tags.map(t => `<i>${t}</i>`).join("")}</span>
          </div>
          <div class="info-tabs" role="tablist">
            <button class="tab active" data-tab="intro" role="tab">概述</button>
            <button class="tab" data-tab="craft" role="tab">工艺</button>
            <button class="tab" data-tab="culture" role="tab">文化</button>
          </div>
          <div class="info-body" id="info-body">${u.intro}</div>
          <details class="info-prototype">
            <summary>原型参考</summary>
            <p>${u.prototype}</p>
          </details>
          <details class="info-sources">
            <summary>史料与出处</summary>
            <ul>${u.sources.map(s => `<li>${s}</li>`).join("")}</ul>
          </details>
          <p class="info-caveat">${u.caveat}</p>
        </div>
        <div class="detail-nav">
          <button class="nav-btn" id="btn-prev" aria-label="上一把">‹</button>
          <button class="nav-btn nav-toggle" id="btn-toggle" aria-label="撑开/收拢伞面">
            <span class="toggle-label">点击伞面<br>开合</span>
          </button>
          <button class="nav-btn" id="btn-next" aria-label="下一把">›</button>
        </div>
      </section>`;

    initGL();
    resizeGL();
    mountUmbrella(u);

    // 详情页顶部配色跟随伞色
    const stage = document.getElementById("gl-stage");
    stage.style.setProperty("--canopy", u.model.canopyColor + "5c");

    /* tab 切换 */
    app.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        app.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const key = tab.dataset.tab;
        document.getElementById("info-body").textContent = u[key];
        // 重新触发文字掉落动画
        const body = document.getElementById("info-body");
        body.classList.remove("text-drop");
        void body.offsetWidth;
        body.classList.add("text-drop");
      });
    });

    document.getElementById("btn-prev").addEventListener("click",
      () => openDetail(state.index - 1));
    document.getElementById("btn-next").addEventListener("click",
      () => openDetail(state.index + 1));
    document.getElementById("btn-toggle").addEventListener("click", () => {
      if (state.umbrella) state.umbrella.toggleOpen();
    });
  }

  /* ----- 挂载/切换 3D 伞 ----- */
  function mountUmbrella(u) {
    if (state.umbrella) {
      scene.remove(state.umbrella.group);
      disposeGroup(state.umbrella.group);
    }
    state.umbrella = Umbrella3D.createUmbrella(u.model);
    state.umbrella.group.rotation.y = -0.5;
    scene.add(state.umbrella.group);
    // 自动撑开
    state.umbrella.setOpenness(0);
    state.umbrella.toggleOpen();
  }

  function disposeGroup(group) {
    group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
  }

  /* ============================================================
   * 视图三：世界伞文化
   * ============================================================ */
  function renderWorld() {
    state.view = "world";
    headerTitle.textContent = "世界伞文化";
    backBtn.classList.remove("hidden");

    const cards = WORLD_UMBRELLAS.map(w => `
      <article class="world-card">
        <div class="world-art">${WorldArt.get(w.id)}</div>
        <div class="world-info">
          <div class="world-head">
            <span class="world-country">${w.country}</span>
            <span class="world-period">${w.period}</span>
          </div>
          <h3 class="world-name">${w.name}</h3>
          <p class="world-name-en">${w.nameEn}</p>
          <p class="world-desc">${w.desc}</p>
          <p class="world-origin"><b>起源</b>${w.origin}</p>
        </div>
      </article>`).join("");

    app.innerHTML = `
      <section class="world">
        <h1 class="world-title">伞行世界</h1>
        <p class="world-sub">不同文明，各有一柄遮风挡雨的伞</p>
        <div class="world-grid">${cards}</div>
      </section>`;
  }

  /* ---------------- 导航 ---------------- */
  backBtn.addEventListener("click", () => {
    if (state.view === "detail" || state.view === "world") renderHome();
  });

  /* ---------------- 启动 ---------------- */
  renderHome();
})();
