/* ════════════════════════════════════════════════════════════
   古建数字图谱 · 全景 VR
   程序化生成等距柱状投影全景图 + 球内拖拽环视
   ════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

/* ── 应县木塔 · 黄昏塔院全景 ── */
function panoYingxian(){
  const W=2048,H=1024,c=document.createElement("canvas");c.width=W;c.height=H;
  const x=c.getContext("2d");
  // 天空
  const sky=x.createLinearGradient(0,0,0,H*.62);
  sky.addColorStop(0,"#070a18"); sky.addColorStop(.45,"#101a33");
  sky.addColorStop(.78,"#3a2b33"); sky.addColorStop(1,"#8a4f2e");
  x.fillStyle=sky; x.fillRect(0,0,W,H*.62);
  // 星
  for(let i=0;i<420;i++){
    const sx=Math.random()*W, sy=Math.random()*H*.42, r=Math.random()*1.3+.2;
    x.fillStyle=`rgba(255,244,214,${Math.random()*.75+.15})`;
    x.beginPath(); x.arc(sx,sy,r,0,7); x.fill();
  }
  // 月
  const mg=x.createRadialGradient(W*.78,H*.17,8,W*.78,H*.17,90);
  mg.addColorStop(0,"rgba(250,238,200,.95)"); mg.addColorStop(.18,"rgba(250,238,200,.5)"); mg.addColorStop(1,"rgba(250,238,200,0)");
  x.fillStyle=mg; x.beginPath(); x.arc(W*.78,H*.17,90,0,7); x.fill();
  x.fillStyle="#f6ead0"; x.beginPath(); x.arc(W*.78,H*.17,22,0,7); x.fill();
  // 远山三层
  const ridges=[["#141c30",.52],["#101728",.56],["#0b1220",.60]];
  ridges.forEach(([col,base],ri)=>{
    x.fillStyle=col; x.beginPath(); x.moveTo(0,H*base);
    for(let px=0;px<=W;px+=64){
      const py=H*base - Math.abs(Math.sin(px*.004+ri*9))*.09*H - Math.random()*.02*H;
      x.lineTo(px,py);
    }
    x.lineTo(W,H); x.lineTo(0,H); x.closePath(); x.fill();
  });
  // 地面
  const gnd=x.createLinearGradient(0,H*.6,0,H);
  gnd.addColorStop(0,"#241a12"); gnd.addColorStop(.3,"#171008"); gnd.addColorStop(1,"#0a0705");
  x.fillStyle=gnd; x.fillRect(0,H*.6,W,H*.4);
  // 石板缝
  x.strokeStyle="rgba(0,0,0,.35)"; x.lineWidth=2;
  for(let i=0;i<130;i++){
    const py=H*.62+Math.random()*H*.36, pw=Math.random()*160+40;
    const px=Math.random()*W;
    x.beginPath(); x.moveTo(px,py); x.lineTo(px+pw,py); x.stroke();
  }
  // 塔影光晕
  const glow=x.createRadialGradient(W/2,H*.55,20,W/2,H*.55,420);
  glow.addColorStop(0,"rgba(217,164,65,.30)"); glow.addColorStop(1,"rgba(217,164,65,0)");
  x.fillStyle=glow; x.beginPath(); x.arc(W/2,H*.55,420,0,7); x.fill();
  // 木塔剪影（中心）
  drawPagodaSil(x, W/2, H*.78, 1.0);
  // 两侧配殿剪影
  drawHallSil(x, W*.16, H*.80, .55); drawHallSil(x, W*.84, H*.80, .55);
  // 漂浮灯火星
  for(let i=0;i<60;i++){
    const px=Math.random()*W, py=H*.35+Math.random()*H*.5;
    x.fillStyle=`rgba(240,201,121,${Math.random()*.5+.1})`;
    x.beginPath(); x.arc(px,py,Math.random()*2.2+.6,0,7); x.fill();
  }
  // 暗角
  const vg=x.createRadialGradient(W/2,H/2,H*.35,W/2,H/2,H*.85);
  vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(0,0,0,.5)");
  x.fillStyle=vg; x.fillRect(0,0,W,H);
  return c;
}
function drawPagodaSil(x,cx,gy,s){
  x.save(); x.translate(cx,gy); x.scale(s,s);
  x.fillStyle="#171008"; x.strokeStyle="rgba(217,164,65,.85)"; x.lineWidth=2.2;
  x.beginPath(); x.moveTo(-58,0); x.lineTo(58,0); x.lineTo(40,-26); x.lineTo(-40,-26); x.closePath(); x.fill(); x.stroke();
  const ws=[110,98,86,76,66], bs=[58,44,40,36,32], fl=[34,30,27,24,21];
  let y=-26;
  for(let i=0;i<5;i++){
    const w=ws[i],b=bs[i],f=fl[i];
    y-=b;
    x.fillRect(-w/2,y,w,b);
    x.strokeRect(-w/2,y,w,b);
    y-=4;
    x.beginPath();
    x.moveTo(-w/2-f,-4); x.quadraticCurveTo(-w/2-f*.5,2,0,12);
    x.quadraticCurveTo(w/2+f*.5,2,w/2+f,-4);
    x.lineTo(w/2+f*.55,-8); x.quadraticCurveTo(w/2+f*.3,0,0,8);
    x.quadraticCurveTo(-w/2-f*.3,0,-w/2-f*.55,-8);
    x.closePath(); x.fill(); x.stroke();
    y-=12;
  }
  x.strokeStyle="#f0c979"; x.beginPath(); x.moveTo(0,y); x.lineTo(0,-52); x.stroke();
  for(let i=0;i<6;i++) x.fillRect(-16+i*2,-y0(i),32-i*4,3.4);
  function y0(i){return 20+i*7}
  x.fillStyle="#f0c979"; x.beginPath(); x.arc(0,-56,4,0,7); x.fill();
  x.restore();
}
function drawHallSil(x,cx,gy,s){
  x.save(); x.translate(cx,gy); x.scale(s,s);
  x.fillStyle="#171008"; x.strokeStyle="rgba(217,164,65,.7)"; x.lineWidth=2;
  x.fillRect(-46,-10,92,26); x.strokeRect(-46,-10,92,26);
  x.beginPath(); x.moveTo(-58,-10); x.lineTo(0,-44); x.lineTo(58,-10); x.lineTo(44,-2); x.lineTo(0,-30); x.lineTo(-44,-2); x.closePath(); x.fill(); x.stroke();
  x.restore();
}

/* ── 南禅寺 · 山间庭院全景 ── */
function panoNanchan(){
  const W=2048,H=1024,c=document.createElement("canvas");c.width=W;c.height=H;
  const x=c.getContext("2d");
  const sky=x.createLinearGradient(0,0,0,H*.6);
  sky.addColorStop(0,"#0d1526"); sky.addColorStop(.5,"#1b2b45"); sky.addColorStop(.85,"#7a5a3a"); sky.addColorStop(1,"#b3814a");
  x.fillStyle=sky; x.fillRect(0,0,W,H*.6);
  for(let i=0;i<300;i++){
    x.fillStyle=`rgba(255,246,220,${Math.random()*.7+.1})`;
    x.beginPath(); x.arc(Math.random()*W,Math.random()*H*.4,Math.random()*1.2+.2,0,7); x.fill();
  }
  // 山峦（青绿）
  const ridges=[["#1d2f3a",.5],["#16262f",.55],["#101c24",.59]];
  ridges.forEach(([col,base],ri)=>{
    x.fillStyle=col; x.beginPath(); x.moveTo(0,H*base);
    for(let px=0;px<=W;px+=56){
      const py=H*base - Math.abs(Math.sin(px*.003+ri*7))*.12*H - Math.random()*.03*H;
      x.lineTo(px,py);
    }
    x.lineTo(W,H); x.lineTo(0,H); x.closePath(); x.fill();
  });
  // 地面（草石）
  const gnd=x.createLinearGradient(0,H*.58,0,H);
  gnd.addColorStop(0,"#2a2416"); gnd.addColorStop(.4,"#1c170e"); gnd.addColorStop(1,"#0c0906");
  x.fillStyle=gnd; x.fillRect(0,H*.58,W,H*.42);
  x.strokeStyle="rgba(0,0,0,.3)";
  for(let i=0;i<150;i++){
    const py=H*.6+Math.random()*H*.38;
    x.beginPath(); x.moveTo(Math.random()*W,py); x.lineTo(Math.random()*W+Math.random()*120,py); x.stroke();
  }
  // 古松
  drawPine(x,W*.08,H*.62,1.1); drawPine(x,W*.93,H*.62,1.25);
  // 主殿剪影
  drawHallFront(x,W/2,H*.82,1.35);
  // 灯笼光
  for(const lx of [W*.32,W*.68]){
    const lg=x.createRadialGradient(lx,H*.72,6,lx,H*.72,120);
    lg.addColorStop(0,"rgba(240,190,110,.5)"); lg.addColorStop(1,"rgba(240,190,110,0)");
    x.fillStyle=lg; x.beginPath(); x.arc(lx,H*.72,120,0,7); x.fill();
  }
  for(let i=0;i<50;i++){
    x.fillStyle=`rgba(240,210,140,${Math.random()*.4+.08})`;
    x.beginPath(); x.arc(Math.random()*W,H*.4+Math.random()*H*.5,Math.random()*2+.5,0,7); x.fill();
  }
  const vg=x.createRadialGradient(W/2,H/2,H*.35,W/2,H/2,H*.85);
  vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(0,0,0,.45)");
  x.fillStyle=vg; x.fillRect(0,0,W,H);
  return c;
}
function drawPine(x,cx,gy,s){
  x.save(); x.translate(cx,gy); x.scale(s,s);
  x.strokeStyle="#0d0a07"; x.lineWidth=10; x.beginPath(); x.moveTo(0,0); x.quadraticCurveTo(6,-40,0,-80); x.stroke();
  x.fillStyle="#0f150e";
  for(let i=0;i<5;i++){
    const y=-30-i*16, w=44-i*7;
    x.beginPath(); x.ellipse(0,y,w,10,0,Math.PI,0); x.fill();
  }
  x.restore();
}
function drawHallFront(x,cx,gy,s){
  x.save(); x.translate(cx,gy); x.scale(s,s);
  x.fillStyle="#150f09"; x.strokeStyle="rgba(217,164,65,.9)"; x.lineWidth=3;
  x.fillRect(-96,-14,192,34); x.strokeRect(-96,-14,192,34);
  x.beginPath(); x.moveTo(-118,-14); x.lineTo(0,-84); x.lineTo(118,-14); x.lineTo(88,2); x.lineTo(0,-52); x.lineTo(-88,2); x.closePath(); x.fill(); x.stroke();
  x.strokeStyle="rgba(240,201,121,.8)"; x.lineWidth=2;
  x.beginPath(); x.moveTo(-88,2); x.lineTo(0,-52); x.lineTo(88,2); x.stroke();
  x.fillStyle="rgba(240,201,121,.25)"; x.fillRect(-20,-14,40,34);
  x.restore();
}

/* ── 全景查看器 ── */
window.PanoView = class {
  constructor(container, canvas, buildingId){
    this.container=container; this.canvas=canvas; this.buildingId=buildingId;
    const w=container.clientWidth||800, h=container.clientHeight||600;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.setSize(w,h,false);
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(72,w/h,.1,200);
    const texSrc = buildingId==="yx" ? panoYingxian() : panoNanchan();
    const tex=new THREE.CanvasTexture(texSrc);
    tex.colorSpace=THREE.SRGBColorSpace;
    const sphere=new THREE.Mesh(
      new THREE.SphereGeometry(60,48,24),
      new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide})
    );
    this.scene.add(sphere);
    // 交互
    this.yaw=0; this.pitch=0; this.tYaw=0; this.tPitch=0;
    let drag=false, lx=0, ly=0;
    canvas.addEventListener("pointerdown",e=>{drag=true;lx=e.clientX;ly=e.clientY;canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener("pointermove",e=>{
      if(!drag) return;
      this.tYaw -= (e.clientX-lx)*.0022;
      this.tPitch -= (e.clientY-ly)*.0022;
      this.tPitch = Math.max(-1.2, Math.min(1.2, this.tPitch));
      lx=e.clientX; ly=e.clientY;
    });
    canvas.addEventListener("pointerup",()=>drag=false);
    canvas.addEventListener("pointercancel",()=>drag=false);
    new ResizeObserver(()=>{
      const ww=container.clientWidth, hh=container.clientHeight;
      if(!ww||!hh) return;
      this.camera.aspect=ww/hh; this.camera.updateProjectionMatrix();
      this.renderer.setSize(ww,hh,false);
    }).observe(container);
    this._loop=this._loop.bind(this);
    this.raf=requestAnimationFrame(this._loop);
  }
  _loop(){
    this.raf=requestAnimationFrame(this._loop);
    this.yaw += (this.tYaw-this.yaw)*.08;
    this.pitch += (this.tPitch-this.pitch)*.08;
    const r=30;
    this.camera.position.set(
      r*Math.sin(this.yaw)*Math.cos(this.pitch),
      r*Math.sin(this.pitch),
      r*Math.cos(this.yaw)*Math.cos(this.pitch)
    );
    this.camera.lookAt(0,0,0);
    this.renderer.render(this.scene,this.camera);
  }
  dispose(){
    cancelAnimationFrame(this.raf);
    this.scene.traverse(o=>{ if(o.isMesh){o.geometry.dispose();o.material.map&&o.material.map.dispose();o.material.dispose();} });
    this.renderer.dispose();
  }
};
