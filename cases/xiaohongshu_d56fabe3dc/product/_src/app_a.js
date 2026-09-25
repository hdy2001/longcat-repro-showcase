/* ============================================================
   天宫 · Heavenly Palace — procedural cinematic 3D scene
   Part A: boot / renderer / sky / procedural textures
   ============================================================ */

const container = document.getElementById('scene-container');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
} catch(e) {
  document.getElementById('err').style.display = 'flex';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xbccfe2, 0.0021);

const camera = new THREE.PerspectiveCamera(47, window.innerWidth/window.innerHeight, 0.5, 4000);
const CAM_BASE = new THREE.Vector3(3.2, 3.4, 27);
const LOOK_TARGET = new THREE.Vector3(-2, 17, -160);
camera.position.copy(CAM_BASE);
// 调试：?cam=x,y,z&look=x,y,z
{
  const q = new URLSearchParams(location.search);
  if (q.has('cam')){
    const v = q.get('cam').split(',').map(Number);
    if (v.length===3 && v.every(n=>!isNaN(n))) CAM_BASE.set(v[0],v[1],v[2]);
  }
  if (q.has('look')){
    const v = q.get('look').split(',').map(Number);
    if (v.length===3 && v.every(n=>!isNaN(n))) LOOK_TARGET.set(v[0],v[1],v[2]);
  }
}

/* ---------------- sky dome ---------------- */
{
  const skyGeo = new THREE.SphereGeometry(2400, 40, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite:false, fog:false,
    uniforms: {
      sunDir: { value: new THREE.Vector3(0.22, 0.50, -0.84).normalize() },
      zenith: { value: new THREE.Color(0x3d6fa8) },
      mid:    { value: new THREE.Color(0x8fb8dc) },
      horizon:{ value: new THREE.Color(0xe9eef2) },
      warm:   { value: new THREE.Color(0xffe3c0) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 sunDir, zenith, mid, horizon, warm;
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.24, h));
        col = mix(col, zenith, smoothstep(0.2, 0.75, h));
        float s = max(dot(vDir, sunDir), 0.0);
        col += warm * pow(s, 260.0) * 1.6;            // sun disk
        col += warm * pow(s, 18.0) * 0.42;            // corona
        col += vec3(0.75,0.72,0.68) * pow(s, 3.5) * 0.30; // haze band
        // subtle high cirrus bands
        float cir = sin(vDir.x*14.0 + vDir.y*60.0)*sin(vDir.z*11.0 - vDir.y*40.0);
        col += vec3(1.0) * smoothstep(0.75, 1.0, cir) * 0.028 * smoothstep(0.08, 0.45, h);
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'sky';
  scene.add(sky);
}

/* ---------------- lights ---------------- */
const SUN_POS = new THREE.Vector3(330, 750, -1260);   // 晨光：右后上方斜照
const sun = new THREE.DirectionalLight(0xffe9c8, 3.8);
sun.position.copy(SUN_POS);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 100; sun.shadow.camera.far = 3200;
sun.shadow.camera.left = -200; sun.shadow.camera.right = 200;
sun.shadow.camera.top = 200; sun.shadow.camera.bottom = -200;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.5;
scene.add(sun);
scene.add(sun.target);

const hemi = new THREE.HemisphereLight(0xbdd5ee, 0xe2d3b8, 0.52);
scene.add(hemi);
const fill = new THREE.DirectionalLight(0xcfe0f0, 0.3);
// 云海暖色反光（模拟参考图中正面受暖光）
const bounce = new THREE.DirectionalLight(0xffd9b0, 0.55);
bounce.position.set(220, 60, 380);
scene.add(bounce);
scene.add(bounce.target);
fill.position.set(-200, 120, 150);
scene.add(fill);

/* ============================================================
   Canvas texture factory
   ============================================================ */
function makeCanvas(w, h){ const c = document.createElement('canvas'); c.width=w; c.height=h; return [c, c.getContext('2d')]; }
function canvasTex(c, repeat){
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}
let seed = 7;
function rnd(){ seed = (seed*16807) % 2147483647; return (seed-1)/2147483646; }

/* --- white jade marble --- */
function marbleCanvas(size, veinAlpha){
  const [c, g] = makeCanvas(size, size);
  const grad = g.createLinearGradient(0,0,size,size);
  grad.addColorStop(0,'#f7f4ec'); grad.addColorStop(0.5,'#efece2'); grad.addColorStop(1,'#f5f2ea');
  g.fillStyle = grad; g.fillRect(0,0,size,size);
  // soft cloudy blotches
  for (let i=0;i<46;i++){
    const x=rnd()*size, y=rnd()*size, r=size*(0.06+rnd()*0.2);
    const gg = g.createRadialGradient(x,y,0,x,y,r);
    const tone = rnd()>0.5 ? '238,240,244' : '228,226,220';
    gg.addColorStop(0,`rgba(${tone},${0.10+rnd()*0.12})`); gg.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle = gg; g.beginPath(); g.arc(x,y,r,0,7); g.fill();
  }
  // veins — random walkers
  for (let v=0; v<26; v++){
    let x = rnd()*size, y = rnd()*size;
    let ang = rnd()*Math.PI*2;
    const steps = 40 + rnd()*90;
    g.strokeStyle = `rgba(150,158,168,${(0.05+rnd()*veinAlpha).toFixed(3)})`;
    g.lineWidth = 0.6 + rnd()*1.4;
    g.beginPath(); g.moveTo(x,y);
    for (let s=0;s<steps;s++){
      ang += (rnd()-0.5)*0.9;
      x += Math.cos(ang)*4.5; y += Math.sin(ang)*4.5;
      g.lineTo(x,y);
    }
    g.stroke();
  }
  // speckle
  for (let i=0;i<2600;i++){
    g.fillStyle = `rgba(${rnd()>0.5?'255,255,255':'180,182,190'},${(rnd()*0.05).toFixed(3)})`;
    g.fillRect(rnd()*size, rnd()*size, 1.2, 1.2);
  }
  return c;
}
const marbleC = marbleCanvas(1024, 0.16);
const marbleBumpC = marbleCanvas(512, 0.5);

/* --- roof tiles (dark slate-blue imbricated tiles) --- */
function roofCanvas(){
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = '#2e3d4e'; g.fillRect(0,0,512,512);
  const tw = 512/14, th = 512/10;
  for (let row=0; row<10; row++){
    const y0 = row*th;
    for (let i=0;i<14;i++){
      const x0 = i*tw + (row%2 ? tw/2 : 0);
      // half-round tile (筒瓦)
      const lg = g.createLinearGradient(x0,0,x0+tw,0);
      lg.addColorStop(0,'#1d2836'); lg.addColorStop(0.42,'#48607c');
      lg.addColorStop(0.55,'#5a748f'); lg.addColorStop(0.75,'#3c5068'); lg.addColorStop(1,'#1a2430');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(x0+2, y0); g.lineTo(x0+tw-2, y0); g.lineTo(x0+tw-2, y0+th);
      g.quadraticCurveTo(x0+tw/2, y0+th*1.06, x0+2, y0+th);
      g.closePath(); g.fill();
      // tile end (瓦当) at bottom edge of each row band
      g.fillStyle = 'rgba(16,22,30,0.85)';
      g.beginPath(); g.arc(x0+tw/2, y0+th-2, tw*0.30, Math.PI, 0); g.fill();
      g.fillStyle = 'rgba(120,145,170,0.35)';
      g.beginPath(); g.arc(x0+tw/2, y0+th-4, tw*0.16, Math.PI, 0); g.fill();
    }
    // shadow line between rows
    g.fillStyle = 'rgba(8,12,18,0.55)'; g.fillRect(0, y0+th-1.5, 512, 1.5);
  }
  // weathering streaks
  for (let i=0;i<240;i++){
    g.fillStyle = `rgba(${rnd()>0.5?'200,215,230':'10,14,20'},${(rnd()*0.06).toFixed(3)})`;
    g.fillRect(rnd()*512, rnd()*512, 1.5, 4+rnd()*14);
  }
  return c;
}

/* --- dragon scale sheet --- */
function scaleCanvas(){
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = '#efe9dc'; g.fillRect(0,0,512,512);
  const s = 512/16;
  for (let row=0; row<16; row++){
    for (let i=-1;i<17;i++){
      const x = i*s + (row%2 ? s/2 : 0), y = row*s*0.62;
      const rg = g.createRadialGradient(x, y+s*0.1, 1, x, y+s*0.3, s*0.62);
      rg.addColorStop(0,'#fbf7ee'); rg.addColorStop(0.7,'#e6e0d2'); rg.addColorStop(1,'#b9b4a6');
      g.fillStyle = rg;
      g.beginPath(); g.arc(x, y+s*0.3, s*0.52, Math.PI, 0); g.lineTo(x, y+s*0.62); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(120,116,104,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.arc(x, y+s*0.3, s*0.52, Math.PI, 0); g.stroke();
    }
  }
  return c;
}

/* --- lattice window / wall panel --- */
function latticeCanvas(){
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = '#efe9db'; g.fillRect(0,0,512,512);
  const cols = 8, rows = 6, w = 512/cols, h = 512/rows;
  for (let r=0;r<rows;r++) for (let i=0;i<cols;i++){
    const x=i*w, y=r*h;
    g.fillStyle = '#5d4632'; g.fillRect(x,y,w,h);            // wood frame cell
    const grad = g.createLinearGradient(x,y,x,y+h);
    grad.addColorStop(0,'#7a5f45'); grad.addColorStop(1,'#4a3826');
    g.fillStyle = grad; g.fillRect(x+4,y+4,w-8,h-8);
    g.fillStyle = '#ece5d4'; g.fillRect(x+10,y+10,w-20,h-20); // inner panel
    // lattice strips
    g.strokeStyle = 'rgba(74,56,38,0.9)'; g.lineWidth = 2.5;
    for (let k=1;k<4;k++){
      g.beginPath(); g.moveTo(x+10+k*(w-20)/4, y+10); g.lineTo(x+10+k*(w-20)/4, y+h-10); g.stroke();
      g.beginPath(); g.moveTo(x+10, y+10+k*(h-20)/4); g.lineTo(x+w-10, y+10+k*(h-20)/4); g.stroke();
    }
    g.strokeStyle = 'rgba(255,244,220,0.25)'; g.lineWidth = 1;
    g.strokeRect(x+5.5,y+5.5,w-11,h-11);
  }
  return c;
}

/* --- carved relief band (clouds & dragons, for terrace sides) --- */
function reliefCanvas(){
  const [c, g] = makeCanvas(1024, 256);
  g.fillStyle = '#e9e5d9'; g.fillRect(0,0,1024,256);
  for (let i=0;i<120;i++){
    g.fillStyle = `rgba(255,255,255,${(rnd()*0.14).toFixed(3)})`;
    g.beginPath(); g.ellipse(rnd()*1024, rnd()*256, 14+rnd()*30, 8+rnd()*16, rnd()*3, 0, 7); g.fill();
  }
  // interlocking spiral clouds
  for (let i=0;i<26;i++){
    const x = 30+i*38+rnd()*10, y = 70+rnd()*110, r = 20+rnd()*12;
    g.strokeStyle = 'rgba(122,118,106,0.55)'; g.lineWidth = 4.5;
    g.beginPath();
    for (let a=0;a<Math.PI*4.4;a+=0.16){
      const rr = r*(1-a/(Math.PI*4.8));
      const px = x+Math.cos(a)*rr, py = y+Math.sin(a)*rr*0.62;
      a===0 ? g.moveTo(px,py) : g.lineTo(px,py);
    }
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.6;
    g.stroke();
  }
  // top & bottom trim
  g.fillStyle = 'rgba(110,106,96,0.5)'; g.fillRect(0,0,1024,7); g.fillRect(0,249,1024,7);
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(0,8,1024,2); g.fillRect(0,247,1024,2);
  return c;
}

/* --- rock (island underside) --- */
function rockCanvas(){
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = '#8b8f96'; g.fillRect(0,0,512,512);
  for (let i=0;i<260;i++){
    const x=rnd()*512, y=rnd()*512, r=6+rnd()*42;
    const gg = g.createRadialGradient(x,y,0,x,y,r);
    const dark = rnd()>0.45;
    gg.addColorStop(0, dark?'rgba(60,64,72,0.35)':'rgba(200,205,214,0.30)');
    gg.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle = gg; g.beginPath(); g.arc(x,y,r,0,7); g.fill();
  }
  // strata cracks
  for (let i=0;i<70;i++){
    let x=rnd()*512, y=rnd()*512, a=rnd()*7;
    g.strokeStyle = `rgba(40,44,52,${(0.12+rnd()*0.22).toFixed(3)})`;
    g.lineWidth = 0.8+rnd()*1.6;
    g.beginPath(); g.moveTo(x,y);
    for (let s=0;s<26;s++){ a+=(rnd()-0.5)*1.1; x+=Math.cos(a)*5; y+=Math.sin(a)*5; g.lineTo(x,y); }
    g.stroke();
  }
  return c;
}

/* --- cloud puff sprite --- */
function cloudCanvas(seedi, tone){
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  let s = seedi*7919+13;
  const rr = ()=>{ s=(s*16807)%2147483647; return (s-1)/2147483646; };
  const blobs = 26;
  for (let i=0;i<blobs;i++){
    const a = rr()*Math.PI*2, d = rr()*S*0.26;
    const x = S/2+Math.cos(a)*d, y = S/2+Math.sin(a)*d*0.62;
    const r = S*(0.10+rr()*0.20);
    const gg = g.createRadialGradient(x,y,0,x,y,r);
    gg.addColorStop(0,`rgba(${tone},${0.16+rr()*0.16})`);
    gg.addColorStop(0.65,`rgba(${tone},${0.10+rr()*0.10})`);
    gg.addColorStop(1,`rgba(${tone},0)`);
    g.fillStyle = gg; g.beginPath(); g.arc(x,y,r,0,7); g.fill();
  }
  return c;
}

/* --- waterfall sheet --- */
function waterCanvas(){
  const [c, g] = makeCanvas(256, 512);
  g.clearRect(0,0,256,512);
  for (let i=0;i<170;i++){
    const x = rnd()*256;
    const wdt = 1+rnd()*5, hh = 60+rnd()*260, y = rnd()*512;
    const lg = g.createLinearGradient(0,y,0,y+hh);
    lg.addColorStop(0,'rgba(235,246,252,0)');
    lg.addColorStop(0.35,`rgba(230,243,252,${0.25+rnd()*0.4})`);
    lg.addColorStop(1,'rgba(245,251,255,0.05)');
    g.fillStyle = lg; g.fillRect(x, y, wdt, hh);
  }
  // bright aerated core streaks
  for (let i=0;i<60;i++){
    const x = rnd()*256;
    g.fillStyle = `rgba(255,255,255,${0.10+rnd()*0.22})`;
    g.fillRect(x, rnd()*512, 1+rnd()*2.5, 40+rnd()*160);
  }
  return c;
}

/* --- eave underside: rafters & boards --- */
function rafterCanvas(){
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = '#6b543a'; g.fillRect(0,0,512,512);
  // 望板横纹
  for (let i=0;i<40;i++){
    g.fillStyle = `rgba(${52+rnd()*46|0},${38+rnd()*30|0},${22+rnd()*20|0},0.25)`;
    g.fillRect(0, i*13+rnd()*4, 512, 3);
  }
  // 放射椽子（沿U向条纹）
  for (let i=0;i<26;i++){
    const x0 = i*(512/26);
    const lg = g.createLinearGradient(x0,0,x0+512/26,0);
    lg.addColorStop(0,'#4a3826'); lg.addColorStop(0.5,'#7d6547'); lg.addColorStop(1,'#423222');
    g.fillStyle = lg; g.fillRect(x0, 0, 512/26, 512);
    g.fillStyle = 'rgba(20,14,8,0.6)'; g.fillRect(x0, 0, 1.5, 512);
  }
  return c;
}

/* --- soft round sprite (glow / dust / mist) --- */
function glowCanvas(){
  const S=128; const [c,g]=makeCanvas(S,S);
  const gg = g.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
  gg.addColorStop(0,'rgba(255,255,255,1)');
  gg.addColorStop(0.35,'rgba(255,255,255,0.55)');
  gg.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gg; g.fillRect(0,0,S,S);
  return c;
}

/* --- crane feather texture (white body / black wingtip) --- */
function craneCanvas(){
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = '#f6f4ee'; g.fillRect(0,0,128,128);
  // faint feather striping
  for (let i=0;i<22;i++){
    g.strokeStyle = `rgba(190,196,206,${0.10+rnd()*0.12})`;
    g.lineWidth = 1+rnd()*2;
    const y = rnd()*128;
    g.beginPath(); g.moveTo(0,y); g.bezierCurveTo(40,y-8,90,y+8,128,y-4); g.stroke();
  }
  return c;
}

/* --- robe fabric texture --- */
function robeCanvas(base, shade){
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = base; g.fillRect(0,0,256,256);
  for (let i=0;i<160;i++){
    const x=rnd()*256, y=rnd()*256, len=8+rnd()*40, a=(rnd()-0.5)*0.6 + (rnd()>0.5?0:Math.PI/2);
    g.strokeStyle = `rgba(${shade},${0.05+rnd()*0.10})`;
    g.lineWidth = 1+rnd()*2.2;
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*len, y+Math.sin(a)*len); g.stroke();
  }
  // soft sheen patches
  for (let i=0;i<14;i++){
    const x=rnd()*256,y=rnd()*256,r=20+rnd()*46;
    const gg=g.createRadialGradient(x,y,0,x,y,r);
    gg.addColorStop(0,'rgba(255,255,255,0.10)'); gg.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gg; g.beginPath(); g.arc(x,y,r,0,7); g.fill();
  }
  return c;
}

/* --- build shared textures & materials --- */
const TEX = {
  marble:   canvasTex(marbleC),
  marbleBump: canvasTex(marbleBumpC),
  roof:     canvasTex(roofCanvas()),
  scale:    canvasTex(scaleCanvas()),
  lattice:  canvasTex(latticeCanvas()),
  relief:   canvasTex(reliefCanvas()),
  rock:     canvasTex(rockCanvas()),
  water:    canvasTex(waterCanvas()),
  rafter:   canvasTex(rafterCanvas()),
  glow:     canvasTex(glowCanvas()),
  crane:    canvasTex(craneCanvas()),
  robeRed:  canvasTex(robeCanvas('#9c1f1f','60,10,10')),
  robeWhite:canvasTex(robeCanvas('#f1ece0','150,140,120')),
};
TEX.roof.repeat.set(1,1);
TEX.lattice.repeat.set(3,1.4);
TEX.relief.repeat.set(6,1);
TEX.rock.repeat.set(4,2);
TEX.marble.repeat.set(2,2);

const MAT = {
  jade: new THREE.MeshStandardMaterial({ map:TEX.marble, bumpMap:TEX.marbleBump, bumpScale:0.6, roughness:0.5, metalness:0.04 }),
  jadePlain: new THREE.MeshStandardMaterial({ map:TEX.marble, roughness:0.56, metalness:0.03 }),
  roofTile: new THREE.MeshStandardMaterial({ map:TEX.roof, roughness:0.55, metalness:0.12 }),
  roofUnder: new THREE.MeshStandardMaterial({ map:TEX.rafter, roughness:0.85, color:0xd8c6a8, emissive:0x2e2418 }),
  ridge: new THREE.MeshStandardMaterial({ color:0x2c3a4a, roughness:0.5, metalness:0.15 }),
  gold: new THREE.MeshStandardMaterial({ color:0xc9a45c, roughness:0.32, metalness:0.85 }),
  dragonJade: new THREE.MeshStandardMaterial({ map:TEX.scale, color:0xf3ecdc, roughness:0.34, metalness:0.10, bumpMap:TEX.scale, bumpScale:0.8 }),
  dragonWhite: new THREE.MeshStandardMaterial({ map:TEX.scale, color:0xf6f1e4, roughness:0.38, metalness:0.08 }),
  wall: new THREE.MeshStandardMaterial({ map:TEX.lattice, roughness:0.7 }),
  wallPlain: new THREE.MeshStandardMaterial({ color:0xe8e2d2, roughness:0.75 }),
  relief: new THREE.MeshStandardMaterial({ map:TEX.relief, roughness:0.6 }),
  rock: new THREE.MeshStandardMaterial({ map:TEX.rock, roughness:0.95 }),
  craneBody: new THREE.MeshStandardMaterial({ map:TEX.crane, roughness:0.7 }),
  craneBlack: new THREE.MeshStandardMaterial({ color:0x1c1e24, roughness:0.6 }),
  craneRed: new THREE.MeshStandardMaterial({ color:0xc23a2e, roughness:0.5 }),
  robeRed: new THREE.MeshStandardMaterial({ map:TEX.robeRed, roughness:0.82 }),
  robeWhite: new THREE.MeshStandardMaterial({ map:TEX.robeWhite, roughness:0.82 }),
  hair: new THREE.MeshStandardMaterial({ color:0x17130f, roughness:0.6 }),
};
