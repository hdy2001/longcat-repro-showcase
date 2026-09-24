/* ============================================================
   Part C: scene assembly / planar mirror / parallax / animate
   ============================================================ */

/* ---------- parallax layer rig ---------- */
const mouse = { x:0, y:0, tx:0, ty:0 };
window.addEventListener('pointermove', e=>{
  mouse.tx = (e.clientX/window.innerWidth)*2-1;
  mouse.ty = (e.clientY/window.innerHeight)*2-1;
}, { passive:true });
{ // 调试：?px=&py= 固定视差
  const q = new URLSearchParams(location.search);
  if (q.has('px')) mouse.tx = parseFloat(q.get('px')) || 0;
  if (q.has('py')) mouse.ty = parseFloat(q.get('py')) || 0;
}

const FG = new THREE.Group();      // 前景：龙柱平台
const MID = new THREE.Group();     // 中景：主宫殿
const FAR = new THREE.Group();     // 背景：云海+远景宫殿
const CRANE_LAYER = new THREE.Group();
const layers = [
  { g: FG,          fx: 2.6, fy: 1.0 },
  { g: MID,         fx: 1.05, fy: 0.42 },
  { g: FAR,         fx: 0.42, fy: 0.17 },
  { g: CRANE_LAYER, fx: 0.6, fy: 0.24 },
];
const SKY = new THREE.Group();
scene.add(SKY, FG, MID, FAR, CRANE_LAYER);

let lookTargetCur = LOOK_TARGET.clone();
function applyParallax(){
  for (const L of layers){
    L.g.position.x = -mouse.x * L.fx;
    L.g.position.y = -mouse.y * L.fy * 0.55;
  }
  SKY.position.x = -mouse.x * 0.1;
  camera.position.set(
    CAM_BASE.x + mouse.x*1.6,
    CAM_BASE.y - mouse.y*0.75,
    CAM_BASE.z
  );
  lookTargetCur.set(
    LOOK_TARGET.x + mouse.x*4.2,
    LOOK_TARGET.y - mouse.y*1.6,
    LOOK_TARGET.z
  );
  camera.lookAt(lookTargetCur);
}

/* ============================================================
   Mirror floor — planar reflection (custom Reflector)
   ============================================================ */
let mirrorRT = new THREE.WebGLRenderTarget(1024, 1024, { type: THREE.HalfFloatType });
const vCam = new THREE.PerspectiveCamera();
const reflMatrix = new THREE.Matrix4();
const floorUniforms = {
  tReflect: { value: mirrorRT.texture },
  reflMatrix: { value: reflMatrix },
  sunDir: { value: SUN_POS.clone().normalize() },
};
const floorMat = new THREE.ShaderMaterial({
  uniforms: floorUniforms,
  vertexShader: `
    varying vec4 vRefl;
    varying vec3 vWorld;
    uniform mat4 reflMatrix;
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      vRefl = reflMatrix * wp;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: `
    uniform sampler2D tReflect;
    uniform vec3 sunDir;
    varying vec4 vRefl;
    varying vec3 vWorld;
    void main(){
      vec3 refl = texture2DProj(tReflect, vRefl).rgb;
      // polished marble with tile seams
      vec2 gp = vWorld.xz / 4.4;
      vec2 gf = abs(fract(gp) - 0.5);
      float seam = smoothstep(0.452, 0.5, max(gf.x, gf.y));
      float vein = sin(vWorld.x*0.7 + sin(vWorld.z*1.35)*1.4) * sin(vWorld.z*0.85 + vWorld.x*0.3);
      vec3 marble = vec3(0.905, 0.885, 0.845) + vein*0.022;
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = pow(1.0 - max(V.y, 0.0), 2.4);
      float amt = clamp(0.52 + fres*0.42, 0.0, 0.97);
      vec3 col = mix(marble, refl, amt);
      // sun glitter on polish
      vec3 R = reflect(-V, vec3(0.0,1.0,0.0));
      float spec = pow(max(dot(R, sunDir), 0.0), 80.0);
      col += vec3(1.0, 0.94, 0.82) * spec * 1.1;
      col *= 1.0 - seam*0.30;
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(70, 56), floorMat);
floorMesh.rotation.x = -Math.PI/2;
floorMesh.position.set(0, 0, 2);
FG.add(floorMesh);
// 平台侧壁（浮雕）与底部岩体
{
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(70, 5, 56), MAT.relief);
  skirt.position.set(0, -2.5, 2);
  FG.add(skirt);
  const rockGeo = new THREE.CylinderGeometry(33, 7, 14, 14, 3);
  const p = rockGeo.attributes.position;
  for (let i=0;i<p.count;i++){
    const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    const a = Math.atan2(z,x);
    const n = Math.sin(a*3.3+y*0.4)*0.13 + Math.sin(a*8.1-y*0.25)*0.06;
    const rr = Math.hypot(x,z);
    if (rr>0.01){ p.setX(i, x*(1+n)); p.setZ(i, z*(1+n)); }
  }
  rockGeo.computeVertexNormals();
  const under = new THREE.Mesh(rockGeo, MAT.rock);
  under.position.set(0, -11, 2);
  FG.add(under);
}

function oblique(proj, plane, bias){
  const q = new THREE.Vector4(
    (Math.sign(plane.normal.x) + proj.elements[8]) / proj.elements[0],
    (Math.sign(plane.normal.y) + proj.elements[9]) / proj.elements[5],
    -1.0,
    (1.0 + proj.elements[10]) / proj.elements[14]
  );
  const c = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
  c.multiplyScalar(2.0 / c.dot(q));
  proj.elements[2] = c.x;
  proj.elements[6] = c.y;
  proj.elements[10] = c.z + 1.0 - bias;
  proj.elements[14] = c.w;
}
const _reflPlane = new THREE.Plane();
function updateMirror(){
  floorMesh.visible = false;
  const p = camera.position;
  vCam.position.set(p.x, -p.y, p.z);
  vCam.up.set(0, -1, 0);
  vCam.lookAt(lookTargetCur.x, -lookTargetCur.y, lookTargetCur.z);
  vCam.fov = camera.fov; vCam.aspect = camera.aspect;
  vCam.near = camera.near; vCam.far = camera.far;
  vCam.updateProjectionMatrix();
  vCam.updateMatrixWorld();
  reflMatrix.set(
    0.5,0,0,0.5,
    0,0.5,0,0.5,
    0,0,0.5,0.5,
    0,0,0,1
  );
  reflMatrix.multiply(vCam.projectionMatrix);
  reflMatrix.multiply(vCam.matrixWorldInverse);
  // oblique near-plane clip at y=0
  _reflPlane.set(V3(0,1,0), 0);
  _reflPlane.applyMatrix4(vCam.matrixWorldInverse);
  oblique(vCam.projectionMatrix, _reflPlane, 0.004);
  renderer.setRenderTarget(mirrorRT);
  renderer.render(scene, vCam);
  renderer.setRenderTarget(null);
  vCam.updateProjectionMatrix();
  floorMesh.visible = true;
}

/* ============================================================
   Sun glow & sky group
   ============================================================ */
{
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TEX.glow, color: 0xfff3dc, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  glow.position.copy(SUN_POS).multiplyScalar(4.2);
  glow.scale.setScalar(900);
  SKY.add(glow);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TEX.glow, color: 0xffe9c8, transparent: true, opacity: 0.28,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  halo.position.copy(SUN_POS).multiplyScalar(4.2);
  halo.scale.setScalar(2200);
  SKY.add(halo);
  const skyMesh = scene.getObjectByName('sky');
  SKY.add(skyMesh);
}

/* ============================================================
   FOREGROUND — platform, dragon pillars, gate eave, figures
   ============================================================ */
{
  // 栏杆（左/右/后三边）
  const balL = makeBalustrade(56, 56, 1.5); balL.rotation.y = Math.PI/2; balL.position.set(-35, 0, 2); FG.add(balL);
  const balR = makeBalustrade(56, 56, 1.5); balR.rotation.y = Math.PI/2; balR.position.set(35, 0, 2); FG.add(balR);
  const balB = makeBalustrade(70, 70, 1.5); balB.position.set(0, 0, -26); FG.add(balB);

  // 右前盘龙巨柱（近、巨大）
  const pillarR = makeDragonColumn(2.3, 44, { dragonMat: MAT.dragonJade });
  pillarR.position.set(15, 0, 2);
  FG.add(pillarR);
  // 左盘龙柱（稍远）
  const pillarL = makeDragonColumn(2.1, 40, { dragonMat: MAT.dragonWhite });
  pillarL.position.set(-17, 0, -2);
  FG.add(pillarL);

  // 门檐（右侧上方，与龙柱相接）
  const gate = new THREE.Group();
  const gateRoof = makeRoof(26, 19, 4.4, { curl: 1.7 });
  gateRoof.position.set(23, 12, -5);
  gate.add(gateRoof);
  const dg = makeDougongBand(24, 17, 11.2, 40);
  dg.position.set(23, 0, -5);
  gate.add(dg);
  // 檐柱（白玉）
  const gateColGeo = new THREE.CylinderGeometry(1.45, 1.6, 12, 12);
  [[35,4],[35,-14],[11,-14]].forEach(([x,z])=>{
    const c = new THREE.Mesh(gateColGeo, MAT.jade);
    c.position.set(x, 5.5, z);
    c.castShadow = true;
    gate.add(c);
  });
  // 额枋
  const beam = new THREE.Mesh(new THREE.BoxGeometry(26, 1.0, 1.2), MAT.jade);
  beam.position.set(25, 11.2, 4); gate.add(beam);
  const beam2 = beam.clone(); beam2.position.set(25, 11.2, -14); gate.add(beam2);
  FG.add(gate);

  // 红白长袍人物（极小，约 1:50 于主殿）
  const figRed = makeFigure(true);
  figRed.scale.setScalar(0.72);
  figRed.position.set(2.6, 0, -8);
  figRed.rotation.y = Math.PI + 0.15;
  FG.add(figRed);
  const figWhite = makeFigure(false);
  figWhite.scale.setScalar(0.70);
  figWhite.position.set(5.1, 0, -5.6);
  figWhite.rotation.y = Math.PI - 0.3;
  FG.add(figWhite);
  FG.userData.figures = [figRed, figWhite];
}

/* ============================================================
   MID — 主宫殿 + 浮空云岛 + 瀑布
   ============================================================ */
{
  const island = makeIsland(38, 42);
  island.position.set(-8, 8, -140);
  MID.add(island);
  const hall = makeMainHall();
  hall.position.set(-8, 8.6, -140);
  MID.add(hall);
  makeWaterfall(-46, -154, 13, 5, -52, MID);
  makeWaterfall(28, -160, 10, 5, -52, MID);
}

/* ============================================================
   FAR — 云海 + 远景宫殿群
   ============================================================ */
const cloudTexs = [
  canvasTex(cloudCanvas(1, '255,255,255')),
  canvasTex(cloudCanvas(2, '233,241,249')),
  canvasTex(cloudCanvas(3, '206,223,239')),
];
const clouds = [];
function addClouds(count, o){
  for (let i=0;i<count;i++){
    const m = new THREE.SpriteMaterial({
      map: cloudTexs[i%cloudTexs.length],
      transparent: true, depthWrite: false,
      opacity: o.opMin + Math.random()*(o.opMax-o.opMin),
      color: new THREE.Color().setHSL(0.58, 0.10+Math.random()*0.14, 0.82+Math.random()*0.14),
    });
    const s = o.sMin + Math.random()*(o.sMax-o.sMin);
    const sp = new THREE.Sprite(m);
    sp.scale.set(s, s*(0.40+Math.random()*0.22), 1);
    const bx = o.xMin+Math.random()*(o.xMax-o.xMin);
    const by = o.yMin+Math.random()*(o.yMax-o.yMin);
    const bz = o.zMin+Math.random()*(o.zMax-o.zMin);
    sp.position.set(bx,by,bz);
    (o.group||FAR).add(sp);
    clouds.push({ sp, bx,by,bz, phase:Math.random()*10, amp:1.5+Math.random()*5, speed:0.015+Math.random()*0.04, op:m.opacity });
  }
}
// 云海主层
addClouds(190, { yMin:-26, yMax:-7, sMin:34, sMax:80, xMin:-320, xMax:320, zMin:-300, zMax:36, opMin:0.6, opMax:0.95 });
// 中景流云（宫前）
addClouds(60, { yMin:-6, yMax:3, sMin:18, sMax:42, xMin:-150, xMax:150, zMin:-150, zMax:-24, opMin:0.42, opMax:0.75 });
// 前景与中景之间厚云带
addClouds(42, { yMin:-16, yMax:-5, sMin:25, sMax:52, xMin:-180, xMax:180, zMin:-70, zMax:-18, opMin:0.5, opMax:0.8 });
// 主岛基座云（宫殿浮现于云海）
addClouds(22, { yMin:-4, yMax:5, sMin:18, sMax:30, xMin:-52, xMax:36, zMin:-180, zMax:-105, opMin:0.45, opMax:0.7 });
// 地平线云堤
addClouds(44, { yMin:-12, yMax:8, sMin:55, sMax:130, xMin:-700, xMax:700, zMin:-560, zMax:-340, opMin:0.45, opMax:0.75 });
// 平台基脚云雾
addClouds(18, { yMin:-8, yMax:-2, sMin:18, sMax:34, xMin:-48, xMax:48, zMin:-34, zMax:40, opMin:0.35, opMax:0.6 });

/* ---------- 远景宫殿群 ---------- */
{
  // 左后大殿
  let isl = makeIsland(30, 34); isl.position.set(-120, 10, -250); FAR.add(isl);
  let p = makeDistantPalace(60, 38, 3); p.position.set(-120, 10.6, -250); FAR.add(p);
  makeWaterfall(-150, -268, 8, 8, -55, FAR);
  // 右后殿
  isl = makeIsland(26, 30); isl.position.set(95, 6, -290); FAR.add(isl);
  p = makeDistantPalace(48, 30, 3); p.position.set(95, 6.6, -290); FAR.add(p);
  makeWaterfall(78, -306, 7, 4, -55, FAR);
  // 中央远景主殿群
  isl = makeIsland(36, 40); isl.position.set(-20, 14, -380); FAR.add(isl);
  p = makeDistantPalace(68, 44, 3); p.position.set(-20, 14.6, -380); FAR.add(p);
  makeWaterfall(-58, -404, 9, 12, -58, FAR);
  // 前层两配殿
  isl = makeIsland(20, 24); isl.position.set(-85, 4, -215); FAR.add(isl);
  p = makeDistantPalace(34, 22, 2); p.position.set(-85, 4.6, -215); FAR.add(p);
  isl = makeIsland(18, 22); isl.position.set(55, 2, -225); FAR.add(isl);
  p = makeDistantPalace(30, 20, 2); p.position.set(55, 2.6, -225); FAR.add(p);
  // 双塔
  isl = makeIsland(20, 26); isl.position.set(-215, 8, -330); FAR.add(isl);
  p = makePagoda(11, 5); p.position.set(-215, 8.6, -330); FAR.add(p);
  isl = makeIsland(18, 24); isl.position.set(195, 12, -275); FAR.add(isl);
  p = makePagoda(9, 6); p.position.set(195, 12.6, -275); FAR.add(p);
}

/* ============================================================
   仙鹤
   ============================================================ */
const cranes = [];
[
  { cx:-12, cy:9,  cz:-26, rx:34, ry:14, speed:0.09, phase:1.2 },
  { cx:-34, cy:14, cz:-52, rx:26, ry:16, speed:0.10, phase:0 },
  { cx:18,  cy:7,  cz:-95, rx:42, ry:26, speed:0.075, phase:2.1 },
  { cx:-55, cy:19, cz:-185, rx:65, ry:45, speed:0.055, phase:4.2 },
].forEach(spec=>{
  const c = makeCrane();
  Object.assign(c, spec);
  c.prev = new THREE.Vector3();
  CRANE_LAYER.add(c.crane);
  cranes.push(c);
});

/* ============================================================
   体积光（晨光光柱）
   ============================================================ */
const beams = [];
{
  const beamGeo = new THREE.CylinderGeometry(6, 9, 150, 20, 1, true);
  const sunDir = SUN_POS.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0,1,0), sunDir.clone().negate());
  [
    { x:6,  y:55, z:-70,  r:1.0,  op:0.20 },
    { x:-55, y:48, z:-130, r:1.3,  op:0.17 },
    { x:60,  y:38, z:-40,  r:0.9,  op:0.15 },
    { x:-15, y:65, z:-210, r:1.5,  op:0.13 },
    { x:24,  y:24, z:-12,  r:0.8,  op:0.12 },
  ].forEach(b=>{
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uOp:{ value:b.op }, uTime:{ value:0 } },
      vertexShader: `
        varying vec3 vN; varying vec3 vW; varying float vY;
        void main(){
          vN = normalize(normalMatrix * normal);
          vec4 wp = modelMatrix * vec4(position,1.0);
          vW = wp.xyz; vY = uv.y;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform float uOp; uniform float uTime;
        varying vec3 vN; varying vec3 vW; varying float vY;
        void main(){
          vec3 V = normalize(cameraPosition - vW);
          float core = pow(abs(dot(normalize(vN), V)), 1.8);
          float vf = smoothstep(0.0, 0.35, vY) * smoothstep(1.0, 0.55, vY);
          float streak = 0.85 + 0.15*sin(vW.x*0.35 + vW.z*0.21 + uTime*0.35);
          gl_FragColor = vec4(vec3(1.0,0.96,0.86) * core * vf * streak * uOp, 1.0);
        }`,
    });
    const m = new THREE.Mesh(beamGeo, mat);
    m.scale.setScalar(b.r);
    m.quaternion.copy(q);
    m.position.set(b.x, b.y, b.z);
    FAR.add(m);
    beams.push(mat);
  });
}

/* ---------- 光尘 ---------- */
let dustGeo, dustBase, dustPhase;
{
  const N = 240;
  const pos = new Float32Array(N*3);
  dustBase = new Float32Array(N*3);
  dustPhase = new Float32Array(N);
  for (let i=0;i<N;i++){
    dustBase[i*3]   = -50 + Math.random()*120;
    dustBase[i*3+1] = 1 + Math.random()*48;
    dustBase[i*3+2] = -150 + Math.random()*170;
    dustPhase[i] = Math.random()*10;
  }
  pos.set(dustBase);
  dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size:0.32, map:TEX.glow, transparent:true, opacity:0.5, color:0xfff2dc,
    depthWrite:false, blending:THREE.AdditiveBlending, sizeAttenuation:true,
  }));
  scene.add(dust);
}

/* ============================================================
   动画主循环
   ============================================================ */
const clock = new THREE.Clock();
let firstFrame = true;
renderer.shadowMap.autoUpdate = false;

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // 视差
  mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt*4.0);
  mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt*4.0);
  applyParallax();

  // 云海漂移
  for (const c of clouds){
    c.sp.position.x = c.bx + Math.sin(t*c.speed + c.phase)*c.amp;
    c.sp.position.z = c.bz + Math.cos(t*c.speed*0.7 + c.phase)*c.amp*0.6;
    c.sp.material.opacity = c.op * (0.9 + 0.1*Math.sin(t*0.5 + c.phase*3));
  }

  // 仙鹤
  for (const c of cranes){
    const a = t*c.speed + c.phase;
    const x = c.cx + Math.cos(a)*c.rx;
    const y = c.cy + Math.sin(a*0.63)*4 + Math.sin(a*1.7)*1.2;
    const z = c.cz + Math.sin(a)*c.ry;
    const dx = x - c.prev.x, dy = y - c.prev.y, dz = z - c.prev.z;
    c.crane.position.set(x, y, z);
    if (dx*dx + dy*dy + dz*dz > 1e-6){
      c.crane.rotation.y = Math.atan2(dx, dz);
    }
    const speedFac = Math.min(1, Math.hypot(dx,dy,dz)*30);
    const glide = Math.sin(t*0.23 + c.phase) > 0.55;
    const flap = glide ? 0.06 : 0.55;
    const f = Math.sin(t*7 + c.phase*3) * flap * speedFac;
    c.wingL.rotation.z =  0.12 + f;
    c.wingR.rotation.z = -0.12 - f;
    c.tipL.rotation.z =  0.12 + f*1.1;
    c.tipR.rotation.z = -0.12 - f*1.1;
    c.crane.rotation.z = Math.sin(a + 0.6)*0.22*speedFac;
    c.prev.set(x,y,z);
  }

  // 瀑布
  for (const wf of waterfalls){
    const pos = wf.pts.geometry.attributes.position;
    for (let i=0;i<pos.count;i++){
      let y = pos.getY(i) - wf.spd[i]*dt;
      if (y < wf.yBottom) y = wf.yTop - Math.random()*2;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    for (const sh of wf.sheets) sh.material.map.offset.y -= dt*0.85;
    if (wf.mist) for (const ms of wf.mist){
      const k = 1 + Math.sin(t*0.9 + ms.phase)*0.12;
      ms.sp.scale.set(ms.s*k, ms.s*0.6*k, 1);
    }
  }

  // 人物微动
  FG.userData.figures.forEach((f,i)=>{
    f.rotation.z = Math.sin(t*0.7 + i*2)*0.012;
  });

  // 光柱呼吸
  for (const b of beams) b.uniforms.uTime.value = t;

  // 光尘
  {
    const pos = dustGeo.attributes.position;
    for (let i=0;i<pos.count;i++){
      let y = pos.getY(i) - dt*(0.35 + (i%5)*0.08);
      if (y < 0.5) y = 48;
      pos.setY(i, y);
      pos.setX(i, dustBase[i*3] + Math.sin(t*0.3 + dustPhase[i])*1.6);
    }
    pos.needsUpdate = true;
  }

  // 镜面反射
  renderer.shadowMap.needsUpdate = true;
  updateMirror();
  renderer.render(scene, camera);

  if (firstFrame){
    firstFrame = false;
    document.getElementById('loader').classList.add('done');
  }
}
animate();

/* ---------- resize ---------- */
window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  const w = Math.min(2048, Math.max(512, Math.floor(window.innerWidth*0.5)));
  const h = Math.min(2048, Math.max(512, Math.floor(window.innerHeight*0.5)));
  mirrorRT.setSize(w, h);
});
{
  const w = Math.min(2048, Math.max(512, Math.floor(window.innerWidth*0.5)));
  const h = Math.min(2048, Math.max(512, Math.floor(window.innerHeight*0.5)));
  mirrorRT.setSize(w, h);
}
