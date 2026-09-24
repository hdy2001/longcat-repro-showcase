/* ============================================================
   Part B: geometry builders — dragon columns, roofs, halls
   ============================================================ */
const V3 = (x,y,z)=>new THREE.Vector3(x,y,z);

/* 歇山顶（hip-gable）曲面屋顶：起翘飞檐 + 正脊 + 戗脊 + 脊兽 */
function makeRoof(w, d, h, opts={}){
  const { overhang=0.3, curl=1.0, gable=true } = opts;
  const uvScale = 0.13; // 瓦垄密度
  const group = new THREE.Group();
  const hw = w/2*(1+overhang), hd = d/2*(1+overhang);
  const ridgeHalf = Math.max(w*0.28, w/2 - d*0.72);
  const segU = 22, segV = 14;

  const heightAt = (x, y)=>{
    const tY = Math.min(Math.abs(y)/hd, 1);
    const tX = Math.min(Math.max(0, (Math.abs(x)-ridgeHalf)/(hw-ridgeHalf)), 1);
    let z = h * (1 - Math.max(tY, tX*0.92));
    if (z <= 0.001) return 0.001;
    // 起翘：檐口与转角抬升
    const corner = Math.pow(Math.abs(x)/hw, 3) * Math.pow(Math.abs(y)/hd, 3);
    const edge  = Math.pow(Math.abs(y)/hd, 2) * (1-Math.pow(Math.abs(x)/hw,2));
    z += curl * (corner*3.4 + edge*0.28);
    return z;
  };

  // --- 瓦面（顶面） ---
  const pos=[], uv=[], idx=[];
  for (let j=0;j<=segV;j++){
    for (let i=0;i<=segU;i++){
      const x = -hw + (i/segU)*2*hw;
      const y = -hd + (j/segV)*2*hd;
      pos.push(x, heightAt(x,y), y);
      uv.push(x*uvScale+10, y*uvScale+10);
    }
  }
  for (let j=0;j<segV;j++) for (let i=0;i<segU;i++){
    const a=j*(segU+1)+i, b=a+1, c=a+segU+1, e=c+1;
    idx.push(a,c,b, b,c,e);
  }
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  roofGeo.setIndex(idx);
  roofGeo.computeVertexNormals();
  const roofMesh = new THREE.Mesh(roofGeo, MAT.roofTile);
  roofMesh.castShadow = true; roofMesh.receiveShadow = true;
  group.add(roofMesh);

  // --- 檐底（椽子与望板） ---
  const pos2=[], uv2=[], idx2=[];
  const thick = 0.32;
  for (let j=0;j<=segV;j++){
    for (let i=0;i<=segU;i++){
      const x = -hw + (i/segU)*2*hw;
      const y = -hd + (j/segV)*2*hd;
      pos2.push(x, heightAt(x,y)-thick, y);
      uv2.push(x*uvScale+10, y*uvScale+10);
    }
  }
  for (let j=0;j<segV;j++) for (let i=0;i<segU;i++){
    const a=j*(segU+1)+i, b=a+1, c=a+segU+1, e=c+1;
    idx2.push(a,b,c, b,e,c);
  }
  const underGeo = new THREE.BufferGeometry();
  underGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos2,3));
  underGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv2,2));
  underGeo.setIndex(idx2);
  underGeo.computeVertexNormals();
  const under = new THREE.Mesh(underGeo, MAT.roofUnder);
  group.add(under);

  // --- 檐口包边（bright eave edge） ---
  const edgePts = [];
  const eSeg = 40;
  for (let i=0;i<=eSeg;i++){ const x=-hw+(i/eSeg)*2*hw; edgePts.push(V3(x, heightAt(x,-hd), -hd)); }
  for (let i=1;i<=eSeg;i++){ const y=-hd+(i/eSeg)*2*hd; edgePts.push(V3(hw, heightAt(hw,y), y)); }
  for (let i=1;i<=eSeg;i++){ const x=hw-(i/eSeg)*2*hw; edgePts.push(V3(x, heightAt(x,hd), hd)); }
  for (let i=1;i<eSeg;i++){ const y=hd-(i/eSeg)*2*hd; edgePts.push(V3(-hw, heightAt(-hw,y), y)); }
  const edgeCurve = new THREE.CatmullRomCurve3(edgePts, true);
  const edgeMesh = new THREE.Mesh(new THREE.TubeGeometry(edgeCurve, 180, 0.14, 6, true), MAT.ridge);
  edgeMesh.castShadow = true;
  group.add(edgeMesh);

  // --- 正脊 + 鸱吻 ---
  const ridgeY = h*0.92 + curl*0.1;
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.36, ridgeHalf*2, 8), MAT.ridge);
  ridge.rotation.z = Math.PI/2;
  ridge.position.y = ridgeY;
  ridge.castShadow = true;
  group.add(ridge);
  [-1,1].forEach(s=>{
    const chi = new THREE.Group();
    const horn = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.16, 6, 10, Math.PI*1.15), MAT.ridge);
    horn.rotation.set(0, Math.PI/2, s>0 ? -0.5 : Math.PI+0.5);
    horn.position.set(s*(ridgeHalf+0.35), ridgeY+0.28, 0);
    chi.add(horn);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 6), MAT.ridge);
    tail.position.set(s*(ridgeHalf+0.5), ridgeY+0.85, 0);
    tail.rotation.z = s*0.5;
    chi.add(tail);
    chi.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
    group.add(chi);
  });

  // --- 四条戗脊（垂脊曲线） ---
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sy])=>{
    const pts = [];
    for (let t=0;t<=1.001;t+=0.08){
      const x = sx * (ridgeHalf + t*(hw-ridgeHalf));
      const y = sy * hd * t;
      const z = heightAt(x,y) + 0.12;
      pts.push(V3(x,z,y));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const qj = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.15, 5), MAT.ridge);
    qj.castShadow = true;
    group.add(qj);
    // 檐角套兽
    const tip = pts[pts.length-1];
    const beast = new THREE.Mesh(new THREE.SphereGeometry(0.30, 8, 6), MAT.gold);
    beast.position.copy(tip).add(V3(0,0.28,0));
    beast.scale.set(1,1.25,1);
    group.add(beast);
  });

  // --- 歇山山花（gable ends） ---
  if (gable){
    [-1,1].forEach(s=>{
      const gw = Math.max(0.6, w*0.085), gh = h*0.42;
      const zR = h*0.80;
      const shape = new THREE.Shape();
      shape.moveTo(s*(ridgeHalf-0.1), zR);
      shape.lineTo(s*(ridgeHalf-0.1), zR-gh);
      shape.quadraticCurveTo(s*(ridgeHalf-0.1-gw*0.5), zR-gh*0.72, s*(ridgeHalf-0.1-gw), zR-gh*0.25);
      shape.lineTo(s*(ridgeHalf-0.1-gw), zR-gh*0.1);
      shape.lineTo(s*(ridgeHalf-0.1), zR-0.1);
      const geo = new THREE.ExtrudeGeometry(shape, { depth:0.22, bevelEnabled:false });
      const m = new THREE.Mesh(geo, MAT.wallPlain);
      m.castShadow = true;
      group.add(m);
      // 博风板 bargeboard
      const bb = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        V3(s*(ridgeHalf-0.05), zR-0.05, 0.14),
        V3(s*(ridgeHalf-gw*0.45), zR-gh*0.55, 0.14),
        V3(s*(ridgeHalf-gw), zR-gh*0.22, 0.14),
      ]), 10, 0.09, 5), MAT.ridge);
      group.add(bb);
    });
  }
  return group;
}

/* 斗拱带（檐下） */
function makeDougongBand(w, d, y, count){
  const geoms = [];
  const box = new THREE.BoxGeometry(0.5, 0.34, 0.42);
  const mat4 = new THREE.Matrix4();
  const per = Math.max(6, Math.floor(count));
  const place = (x, z, rot)=>{
    mat4.makeRotationY(rot);
    mat4.setPosition(x, y, z);
    const g = box.clone().applyMatrix4(mat4);
    geoms.push(g);
  };
  const nx = Math.floor(w/1.6), nz = Math.floor(d/1.6);
  for (let i=0;i<=nx;i++){
    const x = -w/2 + (i/nx)*w;
    place(x, -d/2, 0); place(x, d/2, 0);
  }
  for (let i=1;i<nz;i++){
    const z = -d/2 + (i/nz)*d;
    place(-w/2, z, Math.PI/2); place(w/2, z, Math.PI/2);
  }
  const merged = mergeGeoms(geoms);
  const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color:0x8a7358, roughness:0.8 }));
  mesh.castShadow = true;
  return mesh;
}

/* merge simple BufferGeoms (positions/normals/uv, non-indexed conversion) */
function mergeGeoms(geoms){
  let total = 0;
  const nonIndexed = geoms.map(g=>g.toNonIndexed ? g.toNonIndexed() : g);
  nonIndexed.forEach(g=>{ total += g.attributes.position.count; });
  const pos = new Float32Array(total*3), nor = new Float32Array(total*3), uv = new Float32Array(total*2);
  let o3=0, o2=0;
  nonIndexed.forEach(g=>{
    pos.set(g.attributes.position.array, o3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o2);
    o3 += g.attributes.position.array.length;
    o2 += g.attributes.uv ? g.attributes.uv.array.length : 0;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos,3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor,3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv,2));
  return out;
}

/* ---------------- 盘龙柱 ---------------- */
function makeDragonColumn(R, H, opts={}){
  const { dragonMat=MAT.dragonJade, detail=true, goldAccents=true } = opts;
  const group = new THREE.Group();

  // 柱身（微收分）
  const colPts = [];
  colPts.push(new THREE.Vector2(R*0.82, 0));
  colPts.push(new THREE.Vector2(R*0.92, H*0.03));
  colPts.push(new THREE.Vector2(R, H*0.12));
  colPts.push(new THREE.Vector2(R, H*0.88));
  colPts.push(new THREE.Vector2(R*1.04, H*0.97));
  colPts.push(new THREE.Vector2(R*1.12, H));
  const col = new THREE.Mesh(new THREE.LatheGeometry(colPts, 20), MAT.jade);
  col.castShadow = true; col.receiveShadow = true;
  group.add(col);

  // 柱础（覆莲基座）
  const basePts = [
    new THREE.Vector2(R*1.55, 0), new THREE.Vector2(R*1.55, H*0.015),
    new THREE.Vector2(R*1.25, H*0.03), new THREE.Vector2(R*1.45, H*0.055),
    new THREE.Vector2(R*1.15, H*0.075), new THREE.Vector2(R*0.9, H*0.09),
  ];
  const base = new THREE.Mesh(new THREE.LatheGeometry(basePts, 18), MAT.jadePlain);
  base.castShadow = true; base.receiveShadow = true;
  group.add(base);

  /* --- 盘龙（盘绕柱身下段，昂首可见） --- */
  const dragon = new THREE.Group();
  const coils = detail ? 2.6 : 1.8;
  const turn = coils * Math.PI*2;
  const y0 = H*0.04, y1 = H*0.27;

  // 螺旋身径曲线（含粗细变化）
  const helixPts = [];
  const segs = detail ? 240 : 120;
  for (let i=0;i<=segs;i++){
    const t = i/segs;
    const a = t*turn;
    const y = y0 + (y1-y0)*t;
    // 龙身半径：头粗尾细
    const bodyR = R*(1.02 + 0.30*Math.sin(Math.min(t*3.2,Math.PI)));
    helixPts.push(V3(Math.cos(a)*bodyR, y, Math.sin(a)*bodyR));
  }
  const bodyCurve = new THREE.CatmullRomCurve3(helixPts);
  const bodyRadii = [];
  for (let i=0;i<=segs;i++){
    const t=i/segs;
    bodyRadii.push(0.62*(1-t*0.42)+0.10);
  }
  const frames = bodyCurve.computeFrenetFrames(segs, false);
  const posA = [], normA = [], uvA = [], idxA = [];
  const radial = 8;
  for (let i=0;i<=segs;i++){
    const t=i/segs;
    const P = bodyCurve.getPointAt(t);
    const N = frames.normals[i], B = frames.binormals[i];
    const rr = bodyRadii[i];
    for (let j=0;j<=radial;j++){
      const v = j/radial*Math.PI*2;
      const sin=Math.sin(v), cos=-Math.cos(v);
      const nx = cos*N.x + sin*B.x, ny = cos*N.y + sin*B.y, nz = cos*N.z + sin*B.z;
      posA.push(P.x+rr*nx, P.y+rr*ny, P.z+rr*nz);
      normA.push(nx,ny,nz);
      uvA.push(t*6, j/radial);
    }
  }
  for (let i=0;i<segs;i++) for (let j=0;j<radial;j++){
    const a=i*(radial+1)+j, b=a+radial+1;
    idxA.push(a,b,a+1, b,b+1,a+1);
  }
  const varGeo = new THREE.BufferGeometry();
  varGeo.setAttribute('position', new THREE.Float32BufferAttribute(posA,3));
  varGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normA,3));
  varGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvA,2));
  varGeo.setIndex(idxA);
  const body = new THREE.Mesh(varGeo, dragonMat);
  body.castShadow = true;
  dragon.add(body);

  // 背鳍棘刺
  if (detail){
    const spikeGeoms = [];
    for (let i=0;i<segs;i+=6){
      const t=i/segs;
      if (t<0.06||t>0.94) continue;
      const P = bodyCurve.getPointAt(t);
      const out = V3(P.x,0,P.z).normalize();
      const s = 0.52*(1-t*0.5);
      const spike = new THREE.ConeGeometry(s*0.32, s, 5);
      spike.translate(0, s*0.5, 0);
      const m = new THREE.Matrix4().lookAt(V3(0,0,0), out, V3(0,1,0));
      const m2 = new THREE.Matrix4().makeRotationY(Math.random()*0.6);
      spike.applyMatrix4(m2);
      const m3 = new THREE.Matrix4().makeTranslation(P.x+out.x*0.2, P.y+0.1, P.z+out.z*0.2);
      spike.applyMatrix4(m3);
      spikeGeoms.push(spike);
    }
    if (spikeGeoms.length){
      const sp = new THREE.Mesh(mergeGeoms(spikeGeoms), dragonMat);
      sp.castShadow = true;
      dragon.add(sp);
    }
  }

  // 龙头（ coil 顶端，昂首探出）
  const headT = 0.995;
  const headPos = bodyCurve.getPointAt(headT);
  const headTan = bodyCurve.getTangentAt(headT);
  const head = new THREE.Group();
  const headMat = dragonMat;
  // 颅
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), headMat);
  skull.scale.set(1.15, 0.9, 1.3);
  head.add(skull);
  // 吻部（前突）
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.44, 1.1, 8), headMat);
  snout.rotation.x = Math.PI/2 - 0.28;
  snout.position.set(0, -0.16, 0.94);
  head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.31, 8, 8), headMat);
  nose.position.set(0, -0.03, 1.42);
  head.add(nose);
  // 金睛
  [-1,1].forEach(s=>{
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), goldAccents?MAT.gold:MAT.dragonBlack);
    eye.position.set(s*0.39, 0.21, 1.02);
    head.add(eye);
  });
  // 鹿角（分叉）
  [-1,1].forEach(s=>{
    const hornMat = goldAccents?MAT.gold:headMat;
    const main = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.095, 1.5, 6), hornMat);
    main.position.set(s*0.39, 0.94, -0.32);
    main.rotation.set(-0.5, 0, s*0.55);
    head.add(main);
    const br1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.72, 5), hornMat);
    br1.position.set(s*0.67, 1.22, -0.55);
    br1.rotation.set(-0.7, 0, s*1.05);
    head.add(br1);
    // 耳
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.55, 5), headMat);
    ear.position.set(s*0.71, 0.46, -0.06);
    ear.rotation.set(0.3, 0, s*1.25);
    head.add(ear);
  });
  // 龙须（长卷）
  [-1,1].forEach(s=>{
    const pts = [];
    for (let i=0;i<=20;i++){
      const t=i/20;
      pts.push(V3(s*(0.2+1.1*t), -0.4 - Math.sin(t*2.6)*0.62 + t*0.3, 1.35 - t*1.9));
    }
    const whisk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.05, 5), headMat);
    head.add(whisk);
  });
  // 鬃毛（颈后扇形片）
  for (let i=0;i<5;i++){
    const mane = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.15- i*0.13, 4), headMat);
    mane.position.set(0, 0.72-i*0.36, -0.72-i*0.20);
    mane.rotation.x = -1.1 - i*0.14;
    mane.scale.z = 0.4;
    head.add(mane);
  }
  head.position.copy(headPos);
  head.rotation.y = Math.atan2(headTan.x, headTan.z); // 沿昂首切线方向
  head.rotation.x = -0.28;
  head.traverse(o=>{ if(o.isMesh){ o.castShadow=true; } });
  dragon.add(head);

  // 四爪（抓柱）
  if (detail){
    const clawGeoms = [];
    [0.22, 0.45, 0.68].forEach((tt, li)=>{
      const P = bodyCurve.getPointAt(tt);
      const out = V3(P.x,0,P.z).normalize();
      const arm = new THREE.CylinderGeometry(0.13, 0.18, 1.0, 6);
      arm.translate(0, 0.5, 0);
      const m = new THREE.Matrix4().lookAt(V3(0,0,0), out, V3(0,1,0));
      arm.applyMatrix4(m);
      const m2 = new THREE.Matrix4().makeTranslation(P.x, P.y, P.z);
      arm.applyMatrix4(m2);
      clawGeoms.push(arm);
      // 三趾
      for (let c=0;c<3;c++){
        const toe = new THREE.ConeGeometry(0.07, 0.46, 5);
        toe.translate(0, 0.17, 0);
        const dir = out.clone().multiplyScalar(0.8);
        dir.y = -0.35;
        dir.normalize();
        dir.applyAxisAngle(V3(0,1,0), (c-1)*0.5);
        const mm = new THREE.Matrix4().lookAt(V3(0,0,0), dir, V3(0,1,0));
        toe.applyMatrix4(mm);
        const anchor = P.clone().add(out.clone().multiplyScalar(0.72));
        const m3 = new THREE.Matrix4().makeTranslation(anchor.x, anchor.y+0.05, anchor.z);
        toe.applyMatrix4(m3);
        clawGeoms.push(toe);
      }
    });
    const claws = new THREE.Mesh(mergeGeoms(clawGeoms), dragonMat);
    claws.castShadow = true;
    dragon.add(claws);
  }

  // 祥云伴绕（浅浮雕云带）
  const cloudMat = MAT.jadePlain;
  const nCloud = detail?5:2;
  for (let i=0;i<nCloud;i++){
    const t = 0.15 + (i/nCloud)*0.7 + 0.05;
    const a = t*turn + 1.1;
    const y = y0 + (y1-y0)*t;
    const R2 = R*(1.35+0.12*Math.sin(i*2.4));
    const pts = [];
    for (let k=0;k<=16;k++){
      const tt=k/16;
      const aa = a + tt*1.9;
      const rr = R2*(1-0.25*tt);
      pts.push(V3(Math.cos(aa)*rr, y+Math.sin(tt*Math.PI*2)*0.22, Math.sin(aa)*rr));
    }
    const ribbon = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.16, 6), cloudMat);
    ribbon.castShadow = true;
    dragon.add(ribbon);
  }

  group.add(dragon);
  group.userData.dragon = dragon;
  return group;
}

/* ---------------- 栏杆 ---------------- */
function makeBalustrade(w, d, h, step=1.6){
  const group = new THREE.Group();
  const post = new THREE.BoxGeometry(0.22, h, 0.22);
  const cap = new THREE.SphereGeometry(0.16, 8, 6);
  const railT = new THREE.BoxGeometry(1, 0.12, 0.14);
  const geoms = [];
  const m4 = new THREE.Matrix4();
  const push = (g,x,y,z)=>{ m4.makeTranslation(x,y,z); const c=g.clone(); c.applyMatrix4(m4); geoms.push(c); };
  const nx = Math.max(2, Math.round(w/step)), nz = Math.max(2, Math.round(d/step));
  for (let i=0;i<=nx;i++){
    const x=-w/2+(i/nx)*w;
    push(post, x, h/2, -d/2); push(cap, x, h+0.12, -d/2);
    push(post, x, h/2, d/2);  push(cap, x, h+0.12, d/2);
  }
  for (let i=1;i<nz;i++){
    const z=-d/2+(i/nz)*d;
    push(post, -w/2, h/2, z); push(cap, -w/2, h+0.12, z);
    push(post, w/2, h/2, z);  push(cap, w/2, h+0.12, z);
  }
  // rails
  const railLen = w;
  for (const zz of [-d/2, d/2]){
    const g = new THREE.BoxGeometry(railLen, 0.10, 0.12);
    g.translate(0, h*0.62, zz); geoms.push(g);
    const g2 = new THREE.BoxGeometry(railLen, 0.10, 0.12);
    g2.translate(0, h*0.92, zz); geoms.push(g2);
  }
  for (const xx of [-w/2, w/2]){
    const g = new THREE.BoxGeometry(0.12, 0.10, d);
    g.translate(xx, h*0.62, 0); geoms.push(g);
    const g2 = new THREE.BoxGeometry(0.12, 0.10, d);
    g2.translate(xx, h*0.92, 0); geoms.push(g2);
  }
  const merged = mergeGeoms(geoms);
  const mesh = new THREE.Mesh(merged, MAT.jadePlain);
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

/* ---------------- 宫殿主殿（三重檐） ---------------- */
function makeMainHall(){
  const hall = new THREE.Group();
  const W = 46, D = 30;

  // 双层须弥座台基
  const tier1 = new THREE.Mesh(new THREE.BoxGeometry(W+16, 4, D+12), MAT.jade);
  tier1.position.y = 2; hall.add(tier1);
  const band1 = new THREE.Mesh(new THREE.BoxGeometry(W+16.4, 1.6, D+12.4), MAT.relief);
  band1.position.y = 2.2; hall.add(band1);
  const tier2 = new THREE.Mesh(new THREE.BoxGeometry(W+9, 4, D+6), MAT.jade);
  tier2.position.y = 6; hall.add(tier2);
  const band2 = new THREE.Mesh(new THREE.BoxGeometry(W+9.4, 1.4, D+6.4), MAT.relief);
  band2.position.y = 6.2; hall.add(band2);
  [tier1, tier2].forEach(m=>{ m.castShadow=true; m.receiveShadow=true; });

  // 台基栏杆（四面留前阶缺口）
  const bal = makeBalustrade(W+9, D+6, 1.5);
  bal.position.y = 8; hall.add(bal);

  // 正面台阶 + 御路
  const stair = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 8), MAT.jadePlain);
  stair.position.set(0, 4, D/2+6+3.2);
  stair.castShadow = true; stair.receiveShadow = true;
  hall.add(stair);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 8.6), MAT.relief);
  ramp.position.set(0, 8.2, D/2+6+3.2);
  hall.add(ramp);

  // 柱网
  const colH = 13;
  const colR = 0.85;
  const colY = 8;
  const nx = 9, nz = 5;
  const colPos = [];
  for (let i=0;i<nx;i++){
    const x = -W/2 + (i/(nx-1))*W;
    colPos.push([x, -D/2], [x, D/2]);
  }
  for (let i=1;i<nz-1;i++){
    const z = -D/2 + (i/(nz-1))*D;
    colPos.push([-W/2, z], [W/2, z]);
  }
  const colGeo = new THREE.CylinderGeometry(colR*0.88, colR, colH, 12);
  const cols = new THREE.InstancedMesh(colGeo, MAT.jade, colPos.length);
  const m4 = new THREE.Matrix4();
  colPos.forEach(([x,z],i)=>{
    m4.makeTranslation(x, colY+colH/2, z);
    cols.setMatrixAt(i, m4);
  });
  cols.castShadow = true; cols.receiveShadow = true;
  hall.add(cols);

  // 墙体（后+两侧，前檐开敞装隔扇门）
  const wallH = colH-1.2;
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(W-4, wallH, 0.5), MAT.wall);
  backWall.position.set(0, colY+wallH/2, -D/2+0.6);
  hall.add(backWall);
  [-1,1].forEach(s=>{
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.5, wallH, D-6), MAT.wall);
    side.position.set(s*(W/2-0.6), colY+wallH/2, 0);
    hall.add(side);
  });
  // 正面隔扇
  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(W-6, wallH, 0.4), MAT.wall);
  frontWall.position.set(0, colY+wallH/2, D/2-1.2);
  hall.add(frontWall);
  [backWall, frontWall].forEach(m=>{ m.castShadow=true; m.receiveShadow=true; });

  // 额枋（柱顶环梁）
  const architrave = new THREE.Mesh(new THREE.BoxGeometry(W+1.6, 1.1, D+1.6), MAT.jade);
  architrave.position.y = colY+colH+0.55;
  architrave.castShadow = true;
  hall.add(architrave);

  // 三重檐
  const roof1 = makeRoof(W+7, D+5, 6.5, {curl:1.6});
  roof1.position.y = colY+colH+1.1;
  hall.add(roof1);

  // 二层（暗层+围廊）
  const lvl2 = new THREE.Group();
  const wall2 = new THREE.Mesh(new THREE.BoxGeometry(W*0.62, 7, D*0.62), MAT.wall);
  wall2.position.y = 3.5; lvl2.add(wall2);
  const bal2 = makeBalustrade(W*0.62+2, D*0.62+2, 1.2);
  bal2.position.y = 7; lvl2.add(bal2);
  lvl2.position.y = colY+colH+7.6;
  hall.add(lvl2);

  const roof2 = makeRoof(W*0.78, D*0.72, 7.5, {curl:1.8});
  roof2.position.y = colY+colH+14.6;
  hall.add(roof2);

  // 顶层攒尖
  const roof3 = makeRoof(W*0.42, D*0.44, 9, {curl:2.0, gable:false});
  roof3.position.y = colY+colH+21.5;
  hall.add(roof3);
  // 塔刹
  const spire = new THREE.Group();
  for (let i=0;i<5;i++){
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1-i*0.18, 0.09, 6, 14), MAT.gold);
    ring.rotation.x = Math.PI/2;
    ring.position.y = i*0.85;
    spire.add(ring);
  }
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), MAT.gold);
  finial.position.y = 4.6; spire.add(finial);
  const spireRod = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 7, 6), MAT.gold);
  spireRod.position.y = 2; spire.add(spireRod);
  spire.position.y = colY+colH+29.5;
  hall.add(spire);

  hall.traverse(o=>{ if(o.isMesh){ o.castShadow = o.castShadow ?? true; }});
  return hall;
}

/* ---------------- 远景宫殿（简化） ---------------- */
function makeDistantPalace(W, D, tiers){
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(W+8, 3, D+6), MAT.jadePlain);
  base.position.y = 1.5; g.add(base);
  const wallH = 6.5;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(W, wallH, D), MAT.wall);
  wall.position.y = 3+wallH/2; g.add(wall);
  const colRow = new THREE.Mesh(new THREE.BoxGeometry(W+1, 0.8, D+1), MAT.jadePlain);
  colRow.position.y = 3+wallH+0.4; g.add(colRow);
  let y = 3+wallH+0.8;
  for (let t=0; t<tiers; t++){
    const s = 1 - t*0.26;
    const roof = makeRoof(W*s+3, D*s+3, 3.6, {curl:1.1, gable:t===0, uvScale:0.4});
    roof.position.y = y;
    g.add(roof);
    y += 3.6*0.62 + (t<tiers-1 ? 3.2 : 0);
    if (t < tiers-1){
      const w2 = new THREE.Mesh(new THREE.BoxGeometry(W*(1-(t+1)*0.26), 3, D*(1-(t+1)*0.26)), MAT.wallPlain);
      w2.position.y = y-1.6; g.add(w2);
    }
  }
  return g;
}

/* ---------------- 宝塔 ---------------- */
function makePagoda(size, tiers){
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(size*1.6, 2.5, size*1.6), MAT.jadePlain);
  base.position.y = 1.25; g.add(base);
  let y = 2.5;
  for (let t=0;t<tiers;t++){
    const s = size*(1-t*0.13);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(s, 3.2, s), MAT.wallPlain);
    wall.position.y = y+1.6; g.add(wall);
    const roof = makeRoof(s+2.4, s+2.4, 2.0, {curl:0.9, gable:false, uvScale:0.35});
    roof.position.y = y+3.2; g.add(roof);
    y += 4.6;
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 5, 6), MAT.gold);
  rod.position.y = y+2.2; g.add(rod);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), MAT.gold);
  orb.position.y = y+4.6; g.add(orb);
  return g;
}

/* ---------------- 浮空云岛 ---------------- */
function makeIsland(r, h){
  const g = new THREE.Group();
  // 倒锥形岩体
  const rockGeo = new THREE.CylinderGeometry(r, r*0.16, h, 12, 4);
  // 顶点扰动 → 嶙峋
  const p = rockGeo.attributes.position;
  for (let i=0;i<p.count;i++){
    const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    const a = Math.atan2(z,x);
    const n = Math.sin(a*3.1+y*0.35)*0.14 + Math.sin(a*7.7-y*0.22)*0.07;
    const rr = Math.sqrt(x*x+z*z);
    if (rr>0.01){
      p.setX(i, x*(1+n)); p.setZ(i, z*(1+n));
    }
  }
  rockGeo.computeVertexNormals();
  const rock = new THREE.Mesh(rockGeo, MAT.rock);
  rock.position.y = -h/2;
  rock.castShadow = true;
  g.add(rock);
  // 顶部覆土平台
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r*0.96, 1.6, 14), MAT.jadePlain);
  top.position.y = 0.4;
  top.receiveShadow = true;
  g.add(top);
  return g;
}

/* ---------------- 瀑布 ---------------- */
const waterfalls = [];
function makeWaterfall(x, z, width, yTop, yBottom, group){
  const g = new THREE.Group();
  const H = yTop - yBottom;
  // 双层水幕
  const mkSheet = (op, off)=>{
    const geo = new THREE.PlaneGeometry(width, H, 8, 12);
    const p = geo.attributes.position;
    for (let i=0;i<p.count;i++){
      const t = p.getY(i)/H + 0.5;
      p.setZ(i, Math.sin(t*9 + x)*0.35 + Math.sin(t*23)*0.12);
      p.setX(i, p.getX(i) * (0.82 + t*0.30)); // 下散
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.water.clone(), transparent:true, opacity:op,
      depthWrite:false, side:THREE.DoubleSide,
      roughness:0.25, metalness:0.05, color:0xdceef8,
    });
    mat.map.repeat.set(1.5, 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -0.06;
    mesh.position.set(x, (yTop+yBottom)/2, z+off);
    return mesh;
  };
  const sheet1 = mkSheet(0.55, 0.3);
  const sheet2 = mkSheet(0.75, -0.2);
  g.add(sheet1, sheet2);
  // 落水粒子
  const N = 170;
  const pos = new Float32Array(N*3);
  const spd = new Float32Array(N);
  for (let i=0;i<N;i++){
    pos[i*3]   = x + (Math.random()-0.5)*width*0.9;
    pos[i*3+1] = yTop - Math.random()*H;
    pos[i*3+2] = z + (Math.random()-0.5)*0.8;
    spd[i] = 16 + Math.random()*10;
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const pmat = new THREE.PointsMaterial({
    size:1.2, map:TEX.glow, transparent:true, opacity:0.75,
    depthWrite:false, blending:THREE.AdditiveBlending, color:0xeaf6ff, sizeAttenuation:true,
  });
  const pts = new THREE.Points(pgeo, pmat);
  g.add(pts);
  // 底部水雾
  const mist = [];
  for (let i=0;i<7;i++){
    const sm = new THREE.SpriteMaterial({
      map: TEX.glow, transparent:true, depthWrite:false, opacity:0.20+Math.random()*0.14,
      color:0xf2f8ff,
    });
    const sp = new THREE.Sprite(sm);
    const s = 7+Math.random()*8;
    sp.position.set(x+(Math.random()-0.5)*width*1.1, yBottom+2.5+Math.random()*3, z+(Math.random()-0.5)*2.5);
    sp.scale.set(s, s*0.5, 1);
    g.add(sp);
    mist.push({ sp, s, phase:Math.random()*10 });
  }
  waterfalls.push({ pts, spd, yTop, yBottom, width, x, z, sheets:[sheet1, sheet2], mist });
  group.add(g);
  return g;
}

/* ---------------- 仙鹤 ---------------- */
function makeCrane(){
  const crane = new THREE.Group();
  // 身
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), MAT.craneBody);
  body.scale.set(0.75, 0.7, 1.55);
  crane.add(body);
  // 颈（S 形）
  const neckPts = [V3(0,0.15,0.62), V3(0,0.5,1.0), V3(0,0.95,1.18), V3(0,1.25,1.02)];
  const neck = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(neckPts), 12, 0.11, 6), MAT.craneBody);
  crane.add(neck);
  // 头 + 丹顶 + 喙
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), MAT.craneBody);
  head.position.set(0, 1.3, 1.0);
  crane.add(head);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), MAT.craneRed);
  crown.position.set(0, 1.42, 0.98);
  crown.scale.set(1, 0.6, 1);
  crane.add(crown);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 6), MAT.craneBlack);
  beak.rotation.x = Math.PI/2;
  beak.position.set(0, 1.28, 1.42);
  crane.add(beak);
  // 尾羽
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 6), MAT.craneBlack);
  tail.rotation.x = -Math.PI/2 - 0.25;
  tail.position.set(0, 0.05, -0.95);
  crane.add(tail);
  // 双腿后伸
  [-1,1].forEach(s=>{
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 5), MAT.craneBlack);
    leg.rotation.x = Math.PI/2 + 0.12;
    leg.position.set(s*0.08, -0.12, -0.8);
    crane.add(leg);
  });
  // 翼（可扇动，轴心在肩部）
  const wingGeo = new THREE.PlaneGeometry(2.6, 1.05, 6, 1);
  wingGeo.translate(-1.3, 0, 0);
  {
    const p = wingGeo.attributes.position;
    for (let i=0;i<p.count;i++){
      const x = p.getX(i);
      p.setY(i, p.getY(i) * (1 - Math.abs(x)/1.55));
    }
    wingGeo.computeVertexNormals();
  }
  const wingMat = new THREE.MeshStandardMaterial({ map:TEX.crane, side:THREE.DoubleSide, roughness:0.75 });
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.position.set(-0.32, 0.35, 0);
  wingL.rotation.z = 0.12;
  const wingR = new THREE.Mesh(wingGeo, wingMat);
  wingR.position.set(0.32, 0.35, 0);
  wingR.rotation.z = -0.12;
  wingR.scale.x = -1;
  // 翼尖黑羽
  const tipGeo = new THREE.PlaneGeometry(0.85, 0.5, 3, 1);
  tipGeo.translate(-0.425, 0, 0);
  const tipMat = new THREE.MeshStandardMaterial({ color:0x14161c, side:THREE.DoubleSide, roughness:0.7 });
  const tipL = new THREE.Mesh(tipGeo, tipMat);
  tipL.position.set(-2.55, 0.42, 0.02); tipL.rotation.z = 0.12;
  const tipR = new THREE.Mesh(tipGeo, tipMat);
  tipR.position.set(2.55, 0.42, 0.02); tipR.rotation.z = -0.12; tipR.scale.x = -1;
  crane.add(wingL, wingR, tipL, tipR);
  crane.scale.setScalar(1.0);
  return { crane, wingL, wingR, tipL, tipR, phase: Math.random()*10, cx:0, cy:0, cz:0, rx:30, ry:40, speed:0.14 };
}

/* ---------------- 红/白长袍人物 ---------------- */
function makeFigure(isRed){
  const g = new THREE.Group();
  const robeMat = isRed ? MAT.robeRed : MAT.robeWhite;
  // 长袍（下摆曳地后拖）
  const pts = [
    new THREE.Vector2(0.02, 1.42),
    new THREE.Vector2(0.13, 1.38),
    new THREE.Vector2(0.17, 1.15),
    new THREE.Vector2(0.20, 0.85),
    new THREE.Vector2(0.24, 0.5),
    new THREE.Vector2(0.30, 0.22),
    new THREE.Vector2(0.38, 0.06),
    new THREE.Vector2(0.55, 0.015),
    new THREE.Vector2(0.78, 0.0),
  ];
  const robe = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), robeMat);
  robe.scale.z = 0.82; // 略扁
  g.add(robe);
  // 广袖
  [-1,1].forEach(s=>{
    const sleeve = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.72, 8), robeMat);
    sleeve.position.set(s*0.30, 1.06, 0.05);
    sleeve.rotation.z = s*1.25;
    sleeve.rotation.x = 0.15;
    g.add(sleeve);
  });
  // 头
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), new THREE.MeshStandardMaterial({ color:0xe8c9a8, roughness:0.6 }));
  head.position.y = 1.52;
  g.add(head);
  // 发髻
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 8), MAT.hair);
  hair.position.y = 1.545;
  hair.scale.set(1, 0.85, 1);
  g.add(hair);
  const bun = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.16, 8), MAT.hair);
  bun.position.y = 1.66;
  g.add(bun);
  // 飘带（红袍配白/白袍配青）
  const sash = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.9, 1, 6),
    new THREE.MeshStandardMaterial({ color: isRed?0xe8ddc8:0x9db8c8, side:THREE.DoubleSide, roughness:0.85 }));
  sash.position.set(0, 0.75, 0.30);
  sash.rotation.x = 0.5;
  g.add(sash);
  g.traverse(o=>{ if(o.isMesh){ o.castShadow = true; } });
  return g;
}
