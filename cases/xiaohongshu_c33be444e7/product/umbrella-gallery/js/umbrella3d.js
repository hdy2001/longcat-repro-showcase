/* ============================================================
 * 参数化 3D 伞模型（Three.js）
 * 伞面 / 伞骨 / 伞柄 / 伞顶 程序化建模，支持撑开-收拢动画
 * 动画原理：伞骨长度 L 固定，通过伞骨与竖直轴夹角 θ 插值，
 * 伞面边缘轨迹满足 R=L·sinθ、H=L·cosθ。
 * ============================================================ */

const Umbrella3D = (() => {

  /* ---------- 形状参数 ---------- */
  const SHAPES = {
    // 锥形（油布伞）：伞骨与竖直轴夹角大，伞面高
    conical: { thetaOpen: THREE.MathUtils.degToRad(74), thetaClosed: THREE.MathUtils.degToRad(14), dome: 0 },
    // 穹顶形（油纸伞）：弧度饱满
    dome:    { thetaOpen: THREE.MathUtils.degToRad(62), thetaClosed: THREE.MathUtils.degToRad(12), dome: 1 },
    // 平展形（华盖/阳伞）：大而平
    flat:    { thetaOpen: THREE.MathUtils.degToRad(80), thetaClosed: THREE.MathUtils.degToRad(18), dome: 0 }
  };

  const RIB_LEN = 1.5;      // 伞骨长度（世界单位）
  const SEGMENTS = 72;      // 伞面周向分段

  /* ---------- 伞面轮廓（单位：半径1，高1，沿伞骨母线） ---------- */
  function canopyGeometry(shape) {
    const shapeDef = SHAPES[shape] || SHAPES.dome;
    const pts = [];
    const N = 20;
    const domeH = shapeDef.dome * 0.22; // 穹顶外凸量
    for (let i = 0; i <= N; i++) {
      const t = i / N;                    // 0=伞顶 1=伞缘
      const r = t;
      // 穹顶：中部外凸的弧线；锥形/平展：直线
      const y = -(t * (1 - domeH)) - Math.sin(t * Math.PI) * domeH * 0.5;
      pts.push(new THREE.Vector2(Math.max(r, 0.001), y));
    }
    const geo = new THREE.LatheGeometry(pts, SEGMENTS);
    geo.computeVertexNormals();
    return geo;
  }

  /* ---------- 伞顶饰 ---------- */
  function createFinial(kind, accentColor) {
    const g = new THREE.Group();
    let mat;
    switch (kind) {
      case "gold":
        mat = new THREE.MeshStandardMaterial({ color: 0xd9b45a, metalness: 0.85, roughness: 0.25 });
        break;
      case "bronze":
        mat = new THREE.MeshStandardMaterial({ color: 0x6a7a5a, metalness: 0.7, roughness: 0.4 });
        break;
      default: // wood
        mat = new THREE.MeshStandardMaterial({ color: 0x8a6b42, metalness: 0.05, roughness: 0.6 });
    }
    // 宝珠
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), mat);
    bead.position.y = 0.045;
    g.add(bead);
    // 刹顶小锥
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.09, 16), mat);
    tip.position.y = 0.12;
    g.add(tip);
    return g;
  }

  /**
   * 创建一把伞
   * @param {Object} model data.js 中的 model 配置
   * @returns {Object} { group, setOpenness, isOpen, toggleOpen, update, dispose }
   */
  function createUmbrella(model) {
    const shapeDef = SHAPES[model.shape] || SHAPES.dome;
    const group = new THREE.Group();

    /* ----- 材质 ----- */
    const canopyTex = new THREE.CanvasTexture(UmbrellaTextures.generate(model));
    canopyTex.anisotropy = 4;
    canopyTex.encoding = THREE.sRGBEncoding;
    canopyTex.flipY = false; // LatheGeometry: v=0 在伞顶，对应 canvas 顶部
    const canopyMat = new THREE.MeshStandardMaterial({
      map: canopyTex,
      side: THREE.DoubleSide,
      roughness: 0.82,
      metalness: 0.02
    });
    const ribMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(model.handleColor).multiplyScalar(0.85),
      roughness: 0.55,
      metalness: 0.05
    });
    const shaftMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(model.handleColor),
      roughness: 0.45,
      metalness: 0.08
    });

    /* ----- 伞面 ----- */
    const canopyGeo = canopyGeometry(model.shape);
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    group.add(canopy);

    /* ----- 伞骨（放射状 pivot 结构，便于动画） ----- */
    const ribs = [];
    const ribGeo = new THREE.CylinderGeometry(0.011, 0.014, RIB_LEN, 6);
    ribGeo.translate(0, RIB_LEN / 2, 0); // 原点移到伞骨根部（hub端）
    for (let i = 0; i < model.ribCount; i++) {
      const pivot = new THREE.Group();
      const rib = new THREE.Mesh(ribGeo, ribMat);
      pivot.add(rib);
      pivot.rotation.y = (i / model.ribCount) * Math.PI * 2;
      group.add(pivot);
      ribs.push({ pivot, rib });
    }

    /* ----- 伞柄 ----- */
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.026, model.shaftLength, 10),
      shaftMat
    );
    shaft.position.y = -model.shaftLength / 2 + 0.02;
    group.add(shaft);
    // 柄尾包头
    const buttCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.03, 0.06, 10),
      shaftMat
    );
    buttCap.position.y = -model.shaftLength + 0.02;
    group.add(buttCap);

    /* ----- 伞顶 hub ----- */
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.065, 0.09, 12),
      shaftMat
    );
    hub.position.y = 0.045;
    group.add(hub);
    const finial = createFinial(model.finial);
    finial.position.y = 0.09;
    group.add(finial);

    /* ----- 撑开/收拢状态控制 ----- */
    const state = { openness: 0, target: 0, animating: false, theta: 0 };

    function applyOpenness(t) {
      state.theta = THREE.MathUtils.lerp(shapeDef.thetaClosed, shapeDef.thetaOpen, t);
      const R = RIB_LEN * Math.sin(state.theta);
      const H = RIB_LEN * Math.cos(state.theta);
      // 伞面缩放（单位几何 半径1 高1）
      canopy.scale.set(R, H, R);
      canopy.position.y = -H / 2;
      // 伞骨姿态：方向 (sinθ, -cosθ, 0)
      const dir = new THREE.Vector3(Math.sin(state.theta), -Math.cos(state.theta), 0).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
      ribs.forEach(({ rib }) => {
        rib.quaternion.copy(q);
        rib.position.copy(dir).multiplyScalar(0); // 伞骨根部在 hub
      });
      // hub 与 finial 跟随伞顶
      hub.position.y = 0.045;
      finial.position.y = 0.09;
      state.openness = t;
    }

    function update(dt) {
      // 简单补间
      const speed = 2.6;
      const diff = state.target - state.openness;
      if (Math.abs(diff) > 0.001) {
        const step = Math.sign(diff) * Math.min(Math.abs(diff), dt * speed);
        applyOpenness(state.openness + step);
        state.animating = Math.abs(diff) > 0.002;
      } else if (state.animating) {
        state.animating = false;
      }
      return state.animating;
    }

    function toggleOpen() {
      state.target = state.target > 0.5 ? 0 : 1;
    }

    /* 初始收拢 */
    applyOpenness(0);

    return {
      group,
      setOpenness: applyOpenness,
      getOpenness: () => state.openness,
      isOpen: () => state.target > 0.5,
      toggleOpen,
      update,
      theta: () => state.theta
    };
  }

  return { createUmbrella, RIB_LEN, SHAPES };
})();
