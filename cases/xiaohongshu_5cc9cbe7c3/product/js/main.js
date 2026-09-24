// ============ 主循环：相机 / 章节推进 / 输入 ============

const G = {
  started: false,
  paused: false,
  editorOpen: false,
  diverT: 0,
  diverSpeed: 0.0032,
  nextChapter: 0,
  chapterDone: new Set(),
  lookTargetOverride: new THREE.Vector3(),
  lookOverrideTime: 0,
  freePos: new THREE.Vector3(0, -4, 26),
  freeYaw: 0,
  freePitch: -0.1,
  camYaw: Math.PI,   // 环绕角（初始看向 -Z 前方）
  camPitch: -0.12,
  keys: {},
  dragging: false,
  lookTarget: new THREE.Vector3(0, -10, 0)
};

const D2R = Math.PI / 180;

function nearestPathT(p) {
  let bestT = 0, bestD = 1e9;
  for (let i = 0; i <= 200; i++) {
    const tt = i / 200;
    W.path.getPointAt(tt, _tv1);
    const d = _tv1.distanceTo(p);
    if (d < bestD) { bestD = d; bestT = tt; }
  }
  return bestT;
}

function updateDiver(dt) {
  if (!G.started) return;
  if (!G.paused) G.diverT = Math.min(G.diverT + G.diverSpeed * dt, 1);
  W.path.getPointAt(G.diverT, _tv1);
  A.diver.position.copy(_tv1);
  W.path.getTangentAt(Math.min(G.diverT + 0.005, 1), _tv2);
  _tv1.add(_tv2);
  A.diver.lookAt(_tv1);

  // 章节触发
  if (!G.editorOpen && G.nextChapter < CHAPTERS.length) {
    const ch = CHAPTERS[G.nextChapter];
    if (G.diverT >= ch.t && !G.chapterDone.has(ch)) {
      G.paused = true;
      showBanner(ch);
      if (ch.artifact) showWhisper(ch);
      else {
        showNarrative(ch.narrative);
        setTimeout(() => { if (!G.chapterDone.has(ch)) { hideNarrative(); showEndcard(); } }, 6000);
      }
      G.nextChapter++;
    }
  }
}

function updateCamera(dt) {
  const dp = A.diver.position;

  if (G.editorOpen) {
    if (params.followCam) {
      // 环绕 Alice 的跟随镜头
      const cd = params.followDist;
      const cx = dp.x + Math.sin(G.camYaw) * Math.cos(G.camPitch) * cd;
      const cy = dp.y + Math.sin(-G.camPitch) * cd + 1.2;
      const cz = dp.z + Math.cos(G.camYaw) * Math.cos(G.camPitch) * cd;
      _tv1.set(cx, cy, cz);
      W.camera.position.lerp(_tv1, 1 - Math.pow(0.0001, dt));
      _tv2.copy(dp);
      _tv2.y += 0.8;
      G.lookTarget.lerp(_tv2, 1 - Math.pow(0.0005, dt));
      W.camera.lookAt(G.lookTarget);
      // 跟随角色编辑偏移
      if (params.followEdit) {
        W.camera.position.x += params.camPos[0];
        W.camera.position.y += params.camPos[1];
        W.camera.position.z += params.camPos[2];
        W.camera.rotateX(params.camRot[0] * D2R);
        W.camera.rotateY(params.camRot[1] * D2R);
      }
    } else {
      // 自由飞行镜头
      const sp = 14 * dt;
      const f = _tv1.set(-Math.sin(G.freeYaw) * Math.cos(G.freePitch), Math.sin(G.freePitch), -Math.cos(G.freeYaw) * Math.cos(G.freePitch));
      const r = _tv2.set(-f.z, 0, f.x).normalize();
      if (G.keys['KeyW']) G.freePos.addScaledVector(f, sp);
      if (G.keys['KeyS']) G.freePos.addScaledVector(f, -sp);
      if (G.keys['KeyA']) G.freePos.addScaledVector(r, -sp);
      if (G.keys['KeyD']) G.freePos.addScaledVector(r, sp);
      if (G.keys['KeyQ']) G.freePos.y -= sp;
      if (G.keys['KeyE']) G.freePos.y += sp;
      W.camera.position.copy(G.freePos);
      _tv1.copy(G.freePos).add(f);
      W.camera.lookAt(_tv1);
    }
  } else {
    // 剧情跟随镜头
    W.path.getTangentAt(Math.min(G.diverT + 0.005, 1), _tv1);
    _tv2.copy(dp).addScaledVector(_tv1, -9).add(new THREE.Vector3(0, 2.4, 0));
    W.camera.position.lerp(_tv2, 1 - Math.pow(0.001, dt));
    _tv2.copy(dp).addScaledVector(_tv1, 4);
    G.lookTarget.lerp(_tv2, 1 - Math.pow(0.001, dt));
    W.camera.lookAt(G.lookTarget);
  }

  // 物件注视覆盖
  if (G.lookOverrideTime > 0) {
    G.lookOverrideTime -= dt;
    G.lookTarget.lerp(G.lookTargetOverride, 1 - Math.pow(0.01, dt));
  }
}

// 导演模式下的 Alice 操纵
function updateAliceControl(dt) {
  if (!G.editorOpen || !params.followCam) return;
  const sp = 7 * dt;
  const f = _tv1.set(Math.sin(G.camYaw + Math.PI), 0, Math.cos(G.camYaw + Math.PI));
  const r = _tv2.set(-f.z, 0, f.x).normalize();
  let moved = false;
  if (G.keys['KeyW']) { A.diver.position.addScaledVector(f, sp); moved = true; }
  if (G.keys['KeyS']) { A.diver.position.addScaledVector(f, -sp); moved = true; }
  if (G.keys['KeyA']) { A.diver.position.addScaledVector(r, -sp); moved = true; }
  if (G.keys['KeyD']) { A.diver.position.addScaledVector(r, sp); moved = true; }
  if (G.keys['KeyQ']) { A.diver.position.y -= sp; moved = true; }
  if (G.keys['KeyE']) { A.diver.position.y += sp; moved = true; }
  if (moved) {
    _tv2.copy(A.diver.position).add(f);
    A.diver.lookAt(_tv2);
  }
}

// ---- 参数应用到场景 ----
function applyParams() {
  W.scene.fog.density = 0.016 * params.fogDepth;
  W.waterTex.repeat.set(params.waveSize * 1.4, params.waveSize * 1.4);
  W.waterMat.opacity = 0.22 + params.waveSize * 0.09;
  W.hazeMat.opacity = Math.min(0.85, params.farFog * 26);
  W.causticMat.opacity = 0.12 + params.caustics * 0.3;
  W.sunbirdLight.intensity = 90 + params.caustics * 320;
  const dayFactor = params.dayDepth / 0.0002;
  W.sunSpot.intensity = 900 * dayFactor;
  // 昼深聚焦 Alice
  if (params.focusAlice) W.sunSpot.target.position.copy(A.diver.position);
  else W.sunSpot.target.position.set(0, -30, -60);
  W.sunSpot.target.updateMatrixWorld();
  // 最大雾化虚 → 近处雾片
  A.mistSprites.forEach(s => { s.material.opacity = params.maxFogBlur * 60; });
  // 表面脏灰
  $('grime').style.opacity = params.grime;
}

// 近景雾片（最大雾化虚）
function initMistSprites() {
  A.mistSprites = [];
  const tex = makeGlowTexture();
  for (let i = 0; i < 10; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: 0x2a5a48, transparent: true, opacity: 0.025,
      depthWrite: false
    }));
    sp.scale.set(40 + Math.random() * 50, 25 + Math.random() * 30, 1);
    sp.position.set((Math.random() - 0.5) * 120, -20 + Math.random() * 25, -60 - Math.random() * 120);
    W.scene.add(sp);
    A.mistSprites.push(sp);
  }
}

// ---- 输入 ----
function initInput() {
  addEventListener('keydown', e => {
    if (e.code === 'F2') { e.preventDefault(); toggleEditor(); return; }
    G.keys[e.code] = true;
    if (e.code === 'KeyM') toggleMusic();
    if (e.code === 'Digit1') {
      if (UI.dialog.classList.contains('hidden')) {
        const ch = CHAPTERS[G.nextChapter - 1];
        if (ch && ch.artifact && !G.chapterDone.has(ch) && !UI.whisper.classList.contains('hidden')) openDialog(ch);
      } else {
        nextLine();
      }
    }
    if (e.code === 'Escape' && !UI.dialog.classList.contains('hidden')) closeDialog();
    if (e.code === 'Home' && G.editorOpen) { G.camYaw = Math.PI; G.camPitch = -0.12; }
  });
  addEventListener('keyup', e => { G.keys[e.code] = false; });

  const cv = W.renderer.domElement;
  let px = 0, py = 0;
  cv.addEventListener('pointerdown', e => {
    G.dragging = true;
    px = e.clientX; py = e.clientY;
  });
  addEventListener('pointerup', () => { G.dragging = false; });
  addEventListener('pointermove', e => {
    if (!G.dragging || !G.editorOpen) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    px = e.clientX; py = e.clientY;
    if (params.followCam) {
      G.camYaw -= dx * 0.005;
      G.camPitch = THREE.MathUtils.clamp(G.camPitch - dy * 0.004, -1.2, 1.2);
    } else {
      G.freeYaw -= dx * 0.004;
      G.freePitch = THREE.MathUtils.clamp(G.freePitch - dy * 0.004, -1.4, 1.4);
    }
  });
  cv.addEventListener('wheel', e => {
    if (!G.editorOpen) return;
    e.preventDefault();
    if (params.followCam) {
      params.followDist = THREE.MathUtils.clamp(params.followDist + e.deltaY * 0.02, 3, 30);
      $('sl-dist').value = params.followDist;
      $('sv-dist').textContent = params.followDist.toFixed(1);
    } else {
      const f = _tv1.set(-Math.sin(G.freeYaw) * Math.cos(G.freePitch), Math.sin(G.freePitch), -Math.cos(G.freeYaw) * Math.cos(G.freePitch));
      G.freePos.addScaledVector(f, -e.deltaY * 0.02);
    }
  }, { passive: false });

  addEventListener('resize', () => {
    W.camera.aspect = innerWidth / innerHeight;
    W.camera.updateProjectionMatrix();
    W.renderer.setSize(innerWidth, innerHeight);
  });
}

// ---- 每帧环境动画 ----
function updateEnvironment(dt, t) {
  // 太阳神鸟旋转
  W.sunbird.rotation.y += dt * 0.25;
  W.sunbird.position.y = -20 + Math.sin(t * 0.5) * 0.5;
  // 金屑漂浮
  for (const sh of W.shards) {
    const u = sh.userData;
    u.a += dt * u.s * 0.3;
    sh.position.set(
      W.sunbird.position.x + Math.cos(u.a) * u.r,
      u.y + Math.sin(t * u.s + u.a) * 0.8,
      W.sunbird.position.z + Math.sin(u.a) * u.r
    );
    sh.rotation.x += dt * 0.5;
    sh.rotation.y += dt * 0.3;
  }
  // 纵目面具悬浮
  W.bigMask.position.y = -15 + Math.sin(t * 0.6) * 1.2;
  W.bigMask.rotation.y = -0.5 + Math.sin(t * 0.2) * 0.4;
  // 金杖悬浮
  W.staff.position.y = -22 + Math.sin(t * 0.7) * 0.8;
  W.staff.rotation.y += dt * 0.4;
  // 水面焦散流动
  W.waterTex.offset.x = t * 0.015 * params.waveSize;
  W.waterTex.offset.y = t * 0.011 * params.waveSize;
  W.causticsTex.offset.x = t * 0.03;
  W.causticsTex.offset.y = t * 0.021;
  // 光柱摇摆
  W.godrays.forEach((r, i) => {
    r.rotation.z += Math.sin(t * 0.3 + i) * 0.0004;
    r.material.opacity = 0.05 + Math.sin(t * 0.4 + i * 1.7) * 0.025;
  });
  // 雾片漂移
  if (A.mistSprites) {
    A.mistSprites.forEach((s, i) => {
      s.position.x += Math.sin(t * 0.1 + i) * 0.01;
    });
  }
}

// ---- 主循环 ----
let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = now / 1000;
  if (G.started) {
    updateDiver(dt);
    updateAliceControl(dt);
    updateActors(dt, t);
    updateEnvironment(dt, t);
    applyParams();
  }
  updateCamera(dt);
  UI.depth.textContent = `深度 ${Math.max(0, -A.diver.position.y).toFixed(0)} m`;
  W.renderer.render(W.scene, W.camera);
}

// ---- 启动 ----
initWorld();
initDiver();
initFish();
initParticles();
initMistSprites();
initUI();
initInput();
applyParams();
requestAnimationFrame(animate);
