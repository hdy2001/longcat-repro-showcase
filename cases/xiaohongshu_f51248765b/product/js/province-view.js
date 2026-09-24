/* ════════════════════════════════════════════════════════════
   古建数字图谱 · 山西省域三维浏览
   省域地形 + 双塔光柱 + 飞入镜头
   ════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from '../vendor/three/CSS2DRenderer.js';

window.ProvinceView = class {
  constructor(container, canvas, hooks){
    this.container=container; this.canvas=canvas; this.hooks=hooks;
    const w=container.clientWidth||800, h=container.clientHeight||600;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.setSize(w,h,false);
    this.labelRenderer=new CSS2DRenderer();
    this.labelRenderer.setSize(w,h);
    Object.assign(this.labelRenderer.domElement.style,{position:"absolute",top:"0",left:"0",pointerEvents:"none"});
    container.appendChild(this.labelRenderer.domElement);
    this.scene=new THREE.Scene();
    this.scene.fog=new THREE.Fog(0x0b0a08, 55, 150);
    this.camera=new THREE.PerspectiveCamera(50, w/h, .1, 400);
    this.camera.position.set(70, 60, 80);
    this.controls=new OrbitControls(this.camera, canvas);
    this.controls.enableDamping=true; this.controls.dampingFactor=.06;
    this.controls.maxPolarAngle=Math.PI*.49; this.controls.minDistance=12; this.controls.maxDistance=120;
    this.controls.target.set(0,2,0);
    // 灯光
    this.scene.add(new THREE.HemisphereLight(0xf2e2c2, 0x14100a, 1.05));
    const key=new THREE.DirectionalLight(0xffe6b8,1.5); key.position.set(25,40,15); this.scene.add(key);
    const rim=new THREE.DirectionalLight(0x93a7cc,.45); rim.position.set(-25,15,-20); this.scene.add(rim);
    this._buildTerrain();
    this._buildMarkers();
    this._buildAtmosphere();
    // 飞入
    this.flyT=0; this.flyFrom=new THREE.Vector3(70,60,80); this.flyTo=new THREE.Vector3(24,17,30);
    this.controls.enabled=false;
    // 拾取
    this.raycaster=new THREE.Raycaster();
    let downX=0,downY=0;
    canvas.addEventListener("pointerdown",e=>{downX=e.clientX;downY=e.clientY;});
    canvas.addEventListener("pointerup",e=>{
      if(Math.hypot(e.clientX-downX,e.clientY-downY)>6) return;
      this._onPick(e);
    });
    this._onResize=()=>{
      const ww=container.clientWidth, hh=container.clientHeight;
      if(!ww||!hh) return;
      this.camera.aspect=ww/hh; this.camera.updateProjectionMatrix();
      this.renderer.setSize(ww,hh,false); this.labelRenderer.setSize(ww,hh);
    };
    new ResizeObserver(this._onResize).observe(container);
    // 侧栏
    document.getElementById("provDesc").textContent = window.SHANXI_INFO.desc;
    const pb=document.getElementById("provBuildings"); pb.innerHTML="";
    [{id:"yx"},{id:"nc"}].forEach(({id})=>{
      const b=window.DATA.buildings.find(x=>x.id===id);
      const card=document.createElement("div");
      card.className="prov-card";
      card.innerHTML=`<h3>${b.name}</h3><p>${b.yr} · ${b.type}</p><span class="tag">${b.star?"可拆解模型":""}</span><span class="arrow">→</span>`;
      card.addEventListener("click",()=>this.hooks.goBuilding(id));
      pb.appendChild(card);
    });
    this._loop=this._loop.bind(this);
    this.raf=requestAnimationFrame(this._loop);
  },

  _shanxiShape(){
    const p = window.CHINA_GEO.provinces.find(x=>x.name==="山西省");
    if(!p) return null;
    const k=6;
    const lngs=p.polys[0][0].map(r=>r[0]), lats=p.polys[0][0].map(r=>r[1]);
    const clng=(Math.min(...lngs)+Math.max(...lngs))/2, clat=(Math.min(...lats)+Math.max(...lats))/2;
    const toXY=ring=>ring.map(pt=>new THREE.Vector2((pt[0]-clng)*k,(clat-pt[1])*k));
    return { polys:p.polys.map(poly=>poly.map(toXY)), clng, clat, k };
  }

  _buildTerrain(){
    const sh=this._shanxiShape();
    if(!sh) return;
    // 主体挤出
    const shape=new THREE.Shape(sh.polys[0][0]);
    for(let i=1;i<sh.polys[0].length;i++) shape.holes.push(new THREE.Path(sh.polys[0][i]));
    const geo=new THREE.ExtrudeGeometry(shape,{depth:1.6,bevelEnabled:true,bevelThickness:.5,bevelSize:.6,bevelSegments:2,curveSegments:4});
    geo.rotateX(-Math.PI/2);
    // 顶面起伏
    const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i), y=pos.getY(i), z=pos.getZ(i);
      if(y>1.2){
        const n=(Math.sin(x*.55)*Math.cos(z*.5)+Math.sin(x*.23+z*.31)*.7)*.55;
        pos.setY(i, y+n);
      }
    }
    geo.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({color:0x2a2318,roughness:.95,flatShading:true});
    const m=new THREE.Mesh(geo,mat);
    this.scene.add(m);
    // 发光边界
    const edgePts=sh.polys[0][0].map(pt=>new THREE.Vector3(pt.x, 1.9, pt.y));
    edgePts.push(edgePts[0].clone());
    const edge=new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePts),
      new THREE.LineBasicMaterial({color:0xd9a441,transparent:true,opacity:.9}));
    this.scene.add(edge);
    const edge2=new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePts.map(p=>p.clone().multiplyScalar(1.012))),
      new THREE.LineBasicMaterial({color:0xd9a441,transparent:true,opacity:.25}));
    this.scene.add(edge2);
    // 底网格
    const grid=new THREE.GridHelper(120,40,0x2c2519,0x1a1610);
    grid.position.y=-.05; this.scene.add(grid);
    // 河流（汾河）
    const riverPts=[];
    for(let t=0;t<=1;t+=.05){
      const z=-11+t*22;
      riverPts.push(new THREE.Vector3(Math.sin(t*5)*2.2-1.5, 1.05, z));
    }
    const river=new THREE.Line(new THREE.BufferGeometry().setFromPoints(riverPts),
      new THREE.LineBasicMaterial({color:0x5f8f7b,transparent:true,opacity:.55}));
    this.scene.add(river);
  }

  _buildMarkers(){
    const sh=this._shanxiShape();
    this.markers=[];
    const mk=(id,lng,lat)=>{
      const x=(lng-sh.clng)*sh.k, z=(sh.clat-lat)*sh.k;
      const g=new THREE.Group(); g.position.set(x,1.8,z);
      // 光柱
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.55,.85,9,12,1,true),
        new THREE.MeshBasicMaterial({color:0xf0c979,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
      beam.position.y=4.5; g.add(beam);
      const beam2=new THREE.Mesh(new THREE.CylinderGeometry(.2,.35,9,10,1,true),
        new THREE.MeshBasicMaterial({color:0xffe6b8,transparent:true,opacity:.4,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
      beam2.position.y=4.5; g.add(beam2);
      // 基座光环
      const ring=new THREE.Mesh(new THREE.RingGeometry(1.1,1.5,32),
        new THREE.MeshBasicMaterial({color:0xd9a441,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));
      ring.rotation.x=-Math.PI/2; ring.position.y=.06; g.add(ring);
      // 微缩模型
      if(id==="yx"){
        const mini=new THREE.Group();
        const body=new THREE.MeshStandardMaterial({color:0x6e4526,roughness:.85});
        const roofM=new THREE.MeshStandardMaterial({color:0x4b4b55,roughness:.9,side:THREE.DoubleSide});
        mini.add(new THREE.Mesh(new THREE.CylinderGeometry(.8,.95,.3,8),new THREE.MeshStandardMaterial({color:0x7d7a72})));
        mini.children[0].position.y=.15;
        let yy=.3;
        for(let i=0;i<5;i++){
          const r=1.05-i*.16;
          const eave=new THREE.Mesh(new THREE.CylinderGeometry(r*.62,r,*.28,8,1,true),roofM);
          eave.position.y=yy+.55; mini.add(eave);
          const bd=new THREE.Mesh(new THREE.CylinderGeometry(r*.55,r*.6,.5,8),body);
          bd.position.y=yy+.25; mini.add(bd);
          yy+=.72;
        }
        const sp=new THREE.Mesh(new THREE.CylinderGeometry(.03,.05,.7,6),new THREE.MeshStandardMaterial({color:0xd9a441,metalness:.6,roughness:.4}));
        sp.position.y=yy+.35; mini.add(sp);
        mini.position.y=.3; g.add(mini);
      } else {
        const mini=new THREE.Group();
        const wall=new THREE.MeshStandardMaterial({color:0x2e2118,roughness:.9});
        const roofM=new THREE.MeshStandardMaterial({color:0x4b4b55,roughness:.9,side:THREE.DoubleSide});
        const bd=new THREE.Mesh(new THREE.BoxGeometry(1.7,1.0,1.4),wall); bd.position.y=.8; mini.add(bd);
        const base=new THREE.Mesh(new THREE.BoxGeometry(1.9,.3,1.6),new THREE.MeshStandardMaterial({color:0x7d7a72}));
        base.position.y=.15; mini.add(base);
        const roof=new THREE.Mesh(new THREE.CylinderGeometry(.02,1.25,.75,4,1,true),roofM);
        roof.rotation.y=Math.PI/4; roof.scale.set(1.15,1,.95); roof.position.y=1.68; mini.add(roof);
        g.add(mini);
      }
      // 标签
      const b=window.DATA.buildings.find(x=>x.id===id);
      const el=document.createElement("div");
      el.className="mk-label";
      el.innerHTML=`${b.name}<span class="cn">${b.yr}</span>`;
      const lo=new CSS2DObject(el); lo.position.y=10.6; g.add(lo);
      // 点击热区
      const hit=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.7,10,8),
        new THREE.MeshBasicMaterial({visible:false}));
      hit.position.y=5; hit.userData.bid=id; g.add(hit);
      this.scene.add(g);
      this.markers.push({group:g,hit,beam,beam2});
    };
    mk("yx",113.18,39.56);
    mk("nc",113.55,38.73);
    this.pickables=this.markers.map(m=>m.hit);
  }

  _buildAtmosphere(){
    // 漂浮尘埃
    const n=350, pos=new Float32Array(n*3);
    for(let i=0;i<n;i++){
      pos[i*3]=(Math.random()-.5)*70;
      pos[i*3+1]=Math.random()*22+1;
      pos[i*3+2]=(Math.random()-.5)*70;
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.BufferAttribute(pos,3));
    this.dust=new THREE.Points(g,new THREE.PointsMaterial({color:0xd9a441,size:.09,transparent:true,opacity:.5,depthWrite:false}));
    this.scene.add(this.dust);
  }

  _onPick(e){
    const r=this.canvas.getBoundingClientRect();
    const ndc=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
    this.raycaster.setFromCamera(ndc,this.camera);
    const hits=this.raycaster.intersectObjects(this.pickables,false);
    if(hits.length) this.hooks.goBuilding(hits[0].object.userData.bid);
  }

  _loop(){
    this.raf=requestAnimationFrame(this._loop);
    if(this.flyT<1){
      this.flyT=Math.min(1,this.flyT+.012);
      const e=1-Math.pow(1-this.flyT,3);
      this.camera.position.lerpVectors(this.flyFrom,this.flyTo,e);
      this.camera.lookAt(0,2,0);
      if(this.flyT>=1) this.controls.enabled=true;
    }
    this.dust.rotation.y+=.0004;
    const t=performance.now()*.001;
    this.markers.forEach((m,i)=>{
      m.beam.material.opacity=.22+Math.sin(t*2+i*2)*.08;
      m.beam2.material.opacity=.32+Math.sin(t*2.6+i*2)*.12;
    });
    this.controls.update();
    this.renderer.render(this.scene,this.camera);
    this.labelRenderer.render(this.scene,this.camera);
  }

  dispose(){
    cancelAnimationFrame(this.raf);
    this.controls.dispose();
    this.scene.traverse(o=>{ if(o.isMesh||o.isPoints){o.geometry&&o.geometry.dispose(); if(o.material&&o.material.dispose)o.material.dispose();} });
    this.renderer.dispose();
    this.labelRenderer.domElement.remove();
  }
};
