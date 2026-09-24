```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>应县木塔 · Three.js 程序化建模</title>
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:#d9d9d7;font-family:monospace}
  #c{display:block;width:100%;height:100%}
  #info{position:fixed;left:10px;top:8px;color:#444;font-size:12px;background:rgba(255,255,255,.6);padding:4px 8px;border-radius:4px}
</style>
</head>
<body>
<div id="info">拖拽旋转 · 滚轮缩放 · 右键平移</div>
<canvas id="c"></canvas>
<script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>
<script>
/* ================= 基础 ================= */
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xd9d9d7);
scene.fog=new THREE.Fog(0xd9d9d7,170,360);

const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,0.5,900);

const hemi=new THREE.HemisphereLight(0xffffff,0x8a8f98,0.9);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff1dd,1.25);
sun.position.set(100,150,80);sun.castShadow=true;
sun.shadow.camera.left=-85;sun.shadow.camera.right=85;
sun.shadow.camera.top=95;sun.shadow.camera.bottom=-20;
sun.shadow.camera.near=30;sun.shadow.camera.far=420;
sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-0.0006;
sun.target.position.set(0,40,0);
scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight(0xbfd0e0,0.35);
fill.position.set(-70,50,-90);scene.add(fill);

/* ================= 材质 ================= */
const matWall    =new THREE.MeshStandardMaterial({color:0x8f4a38,roughness:.85});
const matDoor    =new THREE.MeshStandardMaterial({color:0x5e2a1e,roughness:.8});
const matWood    =new THREE.MeshStandardMaterial({color:0xb28a57,roughness:.75});
const matWoodDark=new THREE.MeshStandardMaterial({color:0x7d5f3c,roughness:.8});
const matRoof    =new THREE.MeshStandardMaterial({color:0x7e8b93,roughness:.9,side:THREE.DoubleSide});
const matRoofDark=new THREE.MeshStandardMaterial({color:0x68767d,roughness:.95});
const matStone   =new THREE.MeshStandardMaterial({color:0xcdc8bc,roughness:.95});
const matGold    =new THREE.MeshStandardMaterial({color:0xcfa14e,roughness:.35,metalness:.55});
const matIron    =new THREE.MeshStandardMaterial({color:0x565b63,roughness:.45,metalness:.6});

/* ================= 合并几何工具 ================= */
const UNIT=new THREE.BoxGeometry(1,1,1).toNonIndexed();
const _v=new THREE.Vector3(),_n=new THREE.Vector3(),_nm=new THREE.Matrix3();
function M(x,y,z,rx,ry,rz,sx,sy,sz){
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0));
  return new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),q,new THREE.Vector3(sx,sy,sz));
}
function buildGeo(items){
  const n=items.length*36;
  const pos=new Float32Array(n*3),nor=new Float32Array(n*3);
  let o=0;
  for(const it of items){
    _nm.getNormalMatrix(it);
    for(let i=0;i<36;i++){
      _v.set(UNIT.attributes.position.getX(i),UNIT.attributes.position.getY(i),UNIT.attributes.position.getZ(i)).applyMatrix4(it);
      _n.set(UNIT.attributes.normal.getX(i),UNIT.attributes.normal.getY(i),UNIT.attributes.normal.getZ(i)).applyMatrix3(_nm).normalize();
      pos[o]=_v.x;pos[o+1]=_v.y;pos[o+2]=_v.z;
      nor[o]=_n.x;nor[o+1]=_n.y;nor[o+2]=_n.z;o+=3;
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  return g;
}
function mesh(geo,mat,parent){
  const m=new THREE.Mesh(geo,mat);
  m.castShadow=true;m.receiveShadow=true;
  (parent||scene).add(m);return m;
}

/* ================= 构件：斗拱（五铺作简化，单攒 items） ================= */
function dougongItems(){
  const it=[];
  it.push(M(0,0.28,0,0,0,0, 0.95,0.55,0.95));   // 坐斗
  it.push(M(0,0.82,0,0,0,0, 0.5,0.45,2.2));    // 华拱一跳(径向出跳)
  it.push(M(0,1.20,0,0,0,0, 2.0,0.4,0.45));    // 横拱
  it.push(M(0,1.55,0,0,0,0, 0.45,0.45,3.0));   // 华拱二跳
  it.push(M(0,1.95,0,0,0,0, 2.5,0.35,0.4));    // 令拱
  it.push(M(0,2.30,0,0,0,0, 2.9,0.3,0.5));     // 替木
  return it;
}
const DG=dougongItems();

/* ================= 构件：八角屋檐（屋面体+瓦垄+椽+翘角） ================= */
function eaveRoof(rBot,rTop,h,yBot,parent){
  const body=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBot,h,8,1,true),matRoof);
  body.position.y=yBot+h/2;body.castShadow=true;body.receiveShadow=true;(parent||scene).add(body);
  const cap=new THREE.Mesh(new THREE.CircleGeometry(rTop,8),matRoof);
  cap.rotation.x=-Math.PI/2;cap.position.y=yBot+h;cap.receiveShadow=true;(parent||scene).add(cap);
  // 瓦垄 + 檐椽 + 翘角
  const it=[];
  const dr=rBot-rTop,L=Math.sqrt(dr*dr+h*h),rMid=(rTop+rBot)/2,yMid=yBot+h/2;
  const a=Math.atan2(h,dr);
  const N=8,per=8;
  for(let s=0;s<N;s++){
    const th=s*Math.PI/4+Math.PI/8; // 边内方位
    for(let k=1;k<=per;k++){
      const tt=th+(k/per-0.5)*(Math.PI/4);
      const m=M(0,0,0,0,tt,0,1,1,1);
      const m2=M(rMid,yMid,0,0,0,-a, 0.34,L,0.12);
      m.multiply(m2);
      it.push(m);
    }
  }
  // 檐椽（放射）
  for(let s=0;s<N;s++)for(let k=0;k<7;k++){
    const tt=s*Math.PI/4+(k/6)*(Math.PI/4);
    const r=rBot+0.4;
    it.push(M(r*Math.sin(tt),yBot-0.3,r*Math.cos(tt),0,tt,0, 0.1,0.1,3.6));
  }
  // 8角起翘
  for(let s=0;s<8;s++){
    const b=s*Math.PI/4;
    it.push(M(rBot*Math.sin(b),yBot+0.15,rBot*Math.cos(b),0,b,-0.42, 1.0,0.45,2.4));
  }
  mesh(buildGeo(it),matRoofDark,parent);
  return yBot+h;
}

/* ================= 构件：平坐（挑台+栏杆） ================= */
function balcony(R,yBase,parent){
  const deck=new THREE.Mesh(new THREE.CylinderGeometry(R+1.7,R+1.7,0.6,8),matWoodDark);
  deck.position.y=yBase+0.3;deck.castShadow=true;deck.receiveShadow=true;(parent||scene).add(deck);
  const it=[];const Rb=R+1.5;const s=2*Rb*Math.sin(Math.PI/8);
  const y0=yBase+0.6;
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    it.push(M(Rb*Math.sin(a),y0+0.15,Rb*Math.cos(a),0,a,0, s*0.96,0.1,0.1));  // 地栿
    it.push(M(Rb*Math.sin(a),y0+0.62,Rb*Math.cos(a),0,a,0, s*0.96,0.09,0.09)); // 盆唇
    it.push(M(Rb*Math.sin(a),y0+1.05,Rb*Math.cos(a),0,a,0, s*0.96,0.1,0.1));  // 寻杖
    it.push(M(Rb*Math.sin(a),y0+0.55,Rb*Math.cos(a),0,a,0, 0.2,1.1,0.2));    // 望柱
  }
  mesh(buildGeo(it),matWood,parent);
}

/* ================= 构件：暗层（X斜撑体系） ================= */
function darkLayer(R,y0,h,parent){
  const it=[];const s=2*R*Math.sin(Math.PI/8);
  const phi=Math.atan2(h,s),L=Math.sqrt(s*s+h*h);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,x=R*Math.sin(a),z=R*Math.cos(a);
    it.push(M(x,y0+h/2,z,0,a,0, 0.3,h,0.3));                       // 外槽柱
    it.push(M(x,y0+0.28,z,0,a,0, s*0.95,0.45,0.45));              // 下枋
    it.push(M(x,y0+h-0.28,z,0,a,0, s*0.95,0.45,0.45));            // 上枋
    it.push(M(x,y0+h/2,z,0,a, phi, 0.3,L,0.3));                   // X斜撑1
    it.push(M(x,y0+h/2,z,0,a,-phi, 0.3,L,0.3));                   // X斜撑2
    it.push(M(x,y0+h*0.62,z,0,a,0, 0.4,h*0.4,0.4));               // 短柱
  }
  mesh(buildGeo(it),matWoodDark,parent);
}

/* ================= 建筑参数 ================= */
const colR =[17,15.5,14,12.5,11];            // 明1..明5 外槽柱半径
const colH =[15,8.5,8,7.5,7];               // 明层层高
const eaveR=[20.5,19,17.5,16,14.5];         // 明层檐口半径
const rTop =[17,15.5,14,12.5,11];           // 屋面顶圆半径
const darkR=[15.5,14,12.5,11];              // 暗层半径
const DG=2.45;                              // 斗拱带高
const RH=3;                                 // 屋面坡高

/* ================= 台基 ================= */
(function(){
  const g1=new THREE.Mesh(new THREE.CylinderGeometry(30,31.5,2,8),matStone);g1.position.y=-3;
  const g2=new THREE.Mesh(new THREE.CylinderGeometry(26,27.5,2,8),matStone);g2.position.y=-1;
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(27.5,27.5,0.5,8),matStone);cap.position.y=0.15;
  [g1,g2,cap].forEach(m=>{m.castShadow=true;m.receiveShadow=true;scene.add(m);});
  // 踏道（+Z）
  const it=[];
  for(let i=0;i<6;i++) it.push(M(0,-4+0.33+i*0.66,28.5+i*0.85,0,0,0, 5,0.33,0.9));
  mesh(buildGeo(it),matStone);
})();
const ground=new THREE.Mesh(new THREE.CircleGeometry(160,48),new THREE.MeshStandardMaterial({color:0xc9c6bf,roughness:1}));
ground.rotation.x=-Math.PI/2;ground.position.y=-4.05;ground.receiveShadow=true;scene.add(ground);

/* ================= 副阶（首层重檐） ================= */
(function(){
  const R=17.5,it=[];
  for(let i=0;i<8;i++){const a=i*Math.PI/4;
    it.push(M(R*Math.sin(a),2,R*Math.cos(a),0,a,0, 0.42,4,0.42));       // 副阶柱
    it.push(M(R*Math.sin(a),4.25,R*Math.cos(a),0,a,0, 2*R*Math.sin(Math.PI/8)*0.95,0.5,0.4)); // 阑额
  }
  mesh(buildGeo(it),matWall);
  // 副阶斗拱带
  const dg=[];const yTop=4,Rc=17.5,s=2*Rc*Math.sin(Math.PI/8);
  for(let i=0;i<8;i++){const a=i*Math.PI/4,px=Rc*Math.sin(a),pz=Rc*Math.cos(a);
    for(const t of [-s/6,0,s/6]){
      const ox=px+Math.cos(a)*t,oz=pz-Math.sin(a)*t;
      DG.forEach(d=>{const m=d.clone();m.multiply(M(ox,yTop,oz,0,a,0,1,1,1));dg.push(m);});
    }
  }
  mesh(buildGeo(dg),matWood);
  eaveRoof(21,17,RH,4+DG); // 副阶屋檐 檐口 y=6.45
})();

/* ================= 明层 + 暗层 逐层 ================= */
let y=0;
for(let i=0;i<5;i++){
  const R=colR[i],H=colH[i],s=2*R*Math.sin(Math.PI/8),yB=y,yT=y+H;
  /* --- 墙体+外槽柱 --- */
  const it=[];
  for(let k=0;k<8;k++){const a=k*Math.PI/4;
    it.push(M(R*Math.sin(a),yB+H/2,R*Math.cos(a),0,a,0, s,H,0.35));       // 墙
    it.push(M(R*Math.sin(a),yB+H/2,R*Math.cos(a),0,a,0, 0.34,H,0.34));     // 外槽柱
  }
  mesh(buildGeo(it),matWall);
  /* --- 阑额+普拍枋+斗拱带 --- */
  const itw=[];
  for(let k=0;k<8;k++){const a=k*Math.PI/4,x=R*Math.sin(a),z=R*Math.cos(a);
    itw.push(M(x,yT+0.25,z,0,a,0, s*0.95,0.45,0.4));   // 普拍枋
    itw.push(M(x,yT+0.75,z,0,a,0, s*0.9,0.55,0.45));  // 阑额
  }
  for(let k=0;k<8;k++){const a=k*Math.PI/4,x=R*Math.sin(a),z=R*Math.cos(a);
    for(const t of [-s/3,0,s/3]){
      const ox=x+Math.cos(a)*t,oz=z-Math.sin(a)*t;
      DG.forEach(d=>{const m=d.clone();m.multiply(M(ox,yT+DG/2,oz,0,a,0,1,1,1));itw.push(m);});
    }
  }
  mesh(buildGeo(itw),matWood);
  /* --- 门窗（board） --- */
  const itd=[];
  const dw=s*0.42,dh=3.6;
  // 正面门（a=0 面，朝+Z）
  itd.push(M(0,yB+0.6+dh/2,R,0,0,0, dw+0.5,dh+0.4,0.55));
  itd.push(M(-dw/4-0.06,yB+0.6+dh/2,R+0.08,0,0,0, dw/2-0.12,dh-0.2,0.16));
  itd.push(M( dw/4+0.06,yB+0.6+dh/2,R+0.08,0,0,0, dw/2-0.12,dh-0.2,0.16));
  // 两侧窗（a=1,a=7）
  for(const a of [Math.PI/4,-Math.PI/4]){
    const ww=s*0.5,wh=H*0.42;
    itd.push(M(R*Math.sin(a),yB+H*0.22+wh/2,R*Math.cos(a),0,a,0, ww+0.3,wh+0.35,0.4));
  }
  mesh(buildGeo(itd),matDoor);
  /* --- 棂条 --- */
  const itl=[];
  for(const a of [0,Math.PI/4,-Math.PI/4]){
    const isDoor=(a===0);
    const n=isDoor?3:6, ww=(isDoor?dw:s*0.5), wh=(isDoor?dh:H*0.42);
    const yc=yB+(isDoor?0.6+dh/2:H*0.22+wh/2),zc=isDoor?R+0.24:R+0.16;
    for(let k=0;k<n;k++){
      const off=(k/(n-1)-0.5)*ww*0.8;
      const ox=R*Math.sin(a)+Math.cos(a)*off, oz=R*Math.cos(a)-Math.sin(a)*off+(isDoor?0.14:0.12);
      itl.push(M(ox,yc,oz,0,a,0, 0.07,wh-0.5,0.08));
    }
    if(isDoor) for(const fx of [-dw/4-0.06,dw/4+0.06])
      itl.push(M(fx,yc,R+0.24,0,0,0, 0.07,0.07,dh-0.5));
  }
  mesh(buildGeo(itl),matWood);
  /* --- 平坐（明2..明5） --- */
  if(i>=1) balcony(R,yB);
  /* --- 屋檐 --- */
  const yE=yT+DG;
  eaveRoof(eaveR[i],rTop[i],RH,yE);
  /* --- 暗层（X斜撑） --- */
  if(i<4) darkLayer(darkR[i],yE+RH,3.5);
  y=yE+RH+(i<4?3.5:0);
}

/* ================= 首层内槽：柱+梁架+平闇+佛像 ================= */
(function(){
  const Rin=8.5;
  const it=[]; // 内槽柱+阑额
  for(let i=0;i<8;i++){const a=i*Math.PI/4;
    it.push(M(Rin*Math.sin(a),7.5,Rin*Math.cos(a),0,a,0, 0.4,15,0.4));
    it.push(M(Rin*Math.sin(a),15.25,Rin*Math.cos(a),0,a,0, 2*Rin*Math.sin(Math.PI/8)*0.9,0.5,0.4));
  }
  mesh(buildGeo(it),matWall);
  const itw=[]; // 乳栿（四向大梁）+ 内槽柱头铺作
  for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    itw.push(M(12.75*Math.sin(a),15.6,12.75*Math.cos(a),0,a,0, 0.7,8.6,0.55));
    DG.forEach(d=>{const m=d.clone();m.multiply(M(Rin*Math.sin(a),15.5,Rin*Math.cos(a),0,a,0,1,1,1));itw.push(m);});
  }
  mesh(buildGeo(itw),matWood);
  // 平闇（天花板）
  const pingan=new THREE.Mesh(new THREE.CylinderGeometry(17,17,0.4,8),matWoodDark);
  pingan.position.y=16.9;pingan.castShadow=true;pingan.receiveShadow=true;scene.add(pingan);
  // 佛像（简化：须弥座+身+头+背光）
  const itg=[];
  itg.push(M(0,0.8,0,0,0,0, 6,1.6,6));
  itg.push(M(0,2.0,0,0,0,0, 5,1.0,5));
  itg.push(M(0,2.9,0,0,0,0, 4,0.8,4));
  itg.push(M(0,6.0,0,0,0,0, 1.8,4.2,1.8));
  itg.push(M(0,8.6,0,0,0,0, 2.2,0.5,2.2));
  mesh(buildGeo(itg),matGold);
  const head=new THREE.Mesh(new THREE.SphereGeometry(1.0,16,12),matGold);
  head.position.y=9.3;head.castShadow=true;scene.add(head);
  const halo=new THREE.Mesh(new THREE.CircleGeometry(2.3,20),matGold);
  halo.position.set(0,7.2,-2.1);halo.castShadow=true;scene.add(halo);
})();

/* ================= 攒尖顶 + 塔刹 ================= */
const yTop5=y+colH[4]+DG; // 明5檐口
eaveRoof(eaveR[4],rTop[4],RH,yTop5); // 已含在循环内（i=4），此处为攒尖
const spireBase=yTop5+RH;
(function(){
  // 攒尖锥体
  const cone=new THREE.Mesh(new THREE.CylinderGeometry(0.9,eaveR[4],5,8),matRoof);
  cone.position.y=spireBase+2.5;cone.castShadow=true;cone.receiveShadow=true;scene.add(cone);
  const it=[];const dr=eaveR[4]-0.9,h=5,rMid=(eaveR[4]+0.9)/2,yMid=spireBase+2.5;
  const a=Math.atan2(h,dr),N=8,per=8;
  for(let s=0;s<N;s++)for(let k=1;k<=per;k++){
    const tt=s*Math.PI/4+(k/per-0.5)*(Math.PI/4);
    const m=M(rMid,yMid,0,0,0,-a, 0.5,Math.sqrt(dr*dr+h*h),0.14);
    m.multiply(M(0,0,0,0,tt,0,1,1,1));it.push(m);
  }
  mesh(buildGeo(it),matRoofDark);
  // 塔刹
  const itS=[];
  itS.push(M(0,spireBase+0.7,0,0,0,0, 3.0,1.4,3.0));            // 覆钵
  itS.push(M(0,spireBase+1.6,0,0,0,0, 3.6,0.35,3.6));           // 宝盖
  itS.push(M(0,spireBase+6.0,0,0,0,0, 0.22,8.6,0.22));          // 刹杆
  [3.4,4.5,5.6,6.7].forEach(dy=>itS.push(M(0,spireBase+dy,0,0,0,0, 1.6,0.22,1.6))); // 相轮
  itS.push(M(0,spireBase+7.9,0,0,0,0, 1.5,0.5,1.5));            // 宝珠座
  itS.push(M(0,spireBase+9.6,0,0,0,0, 0.06,1.3,0.06));          // 刹针
  mesh(buildGeo(itS),matIron);
  const baozhu=new THREE.Mesh(new THREE.SphereGeometry(0.85,16,12),matIron);
  baozhu.position.y=spireBase+8.3;baozhu.castShadow=true;scene.add(baozhu);
})();

/* ================= 手写轨道控制器（阻尼惯性） ================= */
const ctrl={theta:.7,phi:1.2,r:190,tTheta:.7,tPhi:1.2,tR:190,
  target:new THREE.Vector3(0,40,0),tTarget:new THREE.Vector3(0,40,0)};
let drag=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,btn:e.button};});
canvas.addEventListener('pointermove',e=>{
  if(!drag)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
  if(drag.btn===2){
    const k=ctrl.tR*0.0011;
    const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0);
    const up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);
    ctrl.tTarget.addScaledVector(right,-dx*k).addScaledVector(up,dy*k);
    ctrl.tTarget.x=clamp(ctrl.tTarget.x,-45,45);
    ctrl.tTarget.y=clamp(ctrl.tTarget.y,0,70);
    ctrl.tTarget.z=clamp(ctrl.tTarget.z,-45,45);
  }else{
    ctrl.tTheta-=dx*0.0052;
    ctrl.tPhi=clamp(ctrl.tPhi-dy*0.0052,0.12,1.52);
  }
});
canvas.addEventListener('wheel',e=>{e.preventDefault();ctrl.tR=clamp(ctrl.tR*(1+e.deltaY*0.0011),80,360);},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerup',()=>drag=null);
function updateCtrl(){
  ctrl.theta+=(ctrl.tTheta-ctrl.theta)*.09;
  ctrl.phi  +=(ctrl.tPhi  -ctrl.phi  )*.09;
  ctrl.r    +=(ctrl.tR    -ctrl.r    )*.09;
  ctrl.target.lerp(ctrl.tTarget,.09);
  const sp=Math.sin(ctrl.phi);
  camera.position.set(
    ctrl.target.x+ctrl.r*sp*Math.sin(ctrl.theta),
    ctrl.target.y+ctrl.r*Math.cos(ctrl.phi),
    ctrl.target.z+ctrl.r*sp*Math.cos(ctrl.theta));
  camera.lookAt(ctrl.target);
}

/* ================= 主循环 ================= */
function animate(){
  requestAnimationFrame(animate);
  updateCtrl();
  renderer.render(scene,camera);
}
animate();
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
</script>
</body>
</html>
```