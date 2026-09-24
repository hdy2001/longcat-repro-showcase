(function(){
'use strict';

/* ================= i18n ================= */
const I18N={
zh:{
brand:'木构图志',loading:'正在营造…',
infoKicker:'TIMBER ATLAS · 佛光寺东大殿',infoH1:'佛光寺东大殿',infoEn:'EAST HALL · FOGUANG TEMPLE',
infoSub:'唐 · 大中十一年（857）· 山西五台山',
fBuiltK:'建造',fBuiltV:'唐大中十一年 · 857 年',fFormK:'形制',fFormV:'单檐庑殿顶 · 面阔七间',
fBrK:'斗拱',fBrV:'双杪双下昂 · 七铺作',fRedisK:'发现',fRedisV:'梁思成 · 林徽因 · 1937',
tagline:'拆开，看懂中国古建',focusBtn:'聚焦斗拱 →',
modePano:'全景建筑',modeDougong:'斗拱拆解',
layersLabel:'构造层次',viewsLabel:'视角',
layerRoof:'屋顶',layerWalls:'墙身',layerFrame:'梁架',layerBrackets:'斗拱',
viewFront:'正视',viewSide:'侧视',viewIso:'轴测',
matLabel:'材质',
tabExplode:'拆解探索',tabAssemble:'引导拼装',
explodeAll:'全部拆出',assembleAll:'全部装回',explodeTip:'拖动滑杆 · 悬停查看构件',
install:'安装构件',undo:'上一步',assembleHint:'点击悬浮构件亦可安装',
exitDougong:'← 返回全景',
partListTitle:'铺作 · 安装顺序',
hintPano:'拖拽旋转 · 滚轮缩放 · 点击斗拱聚焦',hintDougong:'拖拽旋转 · 滚轮缩放',
bracketTip:'斗拱铺作 · 点击聚焦',
complete:'七铺作 · 拼装完成',completeSub:'出檐深远，举重若轻',
viewExplode:'查看拆解',backPano:'返回全景',
archiveBtn:'档案',archiveTitle:'参考档案',drawerClose:'关闭',
ar1T:'封面 · 木构图志',ar1D:'斗拱构件拆解意象 · TIMBER ATLAS / 01',
ar2T:'东大殿 · 现状外观',ar2D:'单檐庑殿顶 · 灰瓦朱柱土墙 · 857 年遗构',
ar3T:'外檐柱头铺作 · 实测详图',ar3D:'张荣、刘畅、臧春雨《佛光寺东大殿实测数据解读》· 2007',
ar4T:'鸱尾 · 正脊两端',ar4D:'绿釉鱼龙 · 实物与三维模型对照',
p1:'栌斗',p1e:'Ludou · Base Block',d1:'全朵铺作之基座，上承万钧，下接柱头。',
p2:'华拱 · 第一跳',p2e:'Huagong · First Projection',d2:'首跳出跳，横挑屋檐，与栌斗十字相交。',
p3:'下昂 · 一跳',p3e:'Lower Ang · First Lever',d3:'斜置如杠杆，昂尾压于梁下，昂嘴挑出檐外。',
p4:'瓜子拱',p4e:'Guazigong',d4:'横拱与华拱垂直相交，端部卷杀如叶。',
p5:'下昂 · 二跳',p5e:'Lower Ang · Second Lever',d5:'第二跳下昂，加长杠杆，再挑深远一程。',
p6:'慢拱',p6e:'Mangong',d6:'长横拱压于上跳，逐层抬升铺作。',
p7:'令拱 · 替木',p7e:'Linggong & Timu',d7:'最外一跳，上承替木，直抵檐下。',
p8:'撩檐枋',p8e:'Eave Purlin',d8:'圆形枋木，承托椽望，界定出檐之远。',
p9:'柱头枋 · 三层',p9e:'Architrave Stack ×3',d9:'层层叠枋，联络各朵铺作，联成整体。'
},
en:{
brand:'TIMBER ATLAS',loading:'Raising the hall…',
infoKicker:'TIMBER ATLAS · FOGUANG TEMPLE',infoH1:'East Hall of Foguang Temple',infoEn:'TANG DYNASTY · 857 · MT. WUTAI',
infoSub:'Tang Dynasty · 857 CE · Mt. Wutai, Shanxi',
fBuiltK:'Built',fBuiltV:'857 CE, Tang Dynasty',fFormK:'Form',fFormV:'Single-eaved hip roof · 7 bays',
fBrK:'Brackets',fBrV:'Double hua & ang · 7 puzuo',fRedisK:'Rediscovered',fRedisV:'Liang Sicheng & Lin Huiyin · 1937',
tagline:'Take it apart — understand Chinese timber architecture',focusBtn:'Focus the brackets →',
modePano:'Panorama',modeDougong:'Dougong',
layersLabel:'LAYERS',viewsLabel:'VIEWS',
layerRoof:'Roof',layerWalls:'Walls',layerFrame:'Frame',layerBrackets:'Brackets',
viewFront:'Front',viewSide:'Side',viewIso:'Axon',
matLabel:'Material',
tabExplode:'Explode',tabAssemble:'Assemble',
explodeAll:'Release all',assembleAll:'Reset all',explodeTip:'Drag the slider · hover to identify',
install:'Install',undo:'Back',assembleHint:'Click the floating part to install',
exitDougong:'← Panorama',
partListTitle:'BRACKET SET · ASSEMBLY ORDER',
hintPano:'Drag to orbit · Scroll to zoom · Click a bracket set',hintDougong:'Drag to orbit · Scroll to zoom',
bracketTip:'Bracket set — click to focus',
complete:'7-puzuo set complete',completeSub:'A deep eave, carried with ease',
viewExplode:'View Explorer',backPano:'Back to Panorama',
archiveBtn:'Archive',archiveTitle:'Reference Archive',drawerClose:'Close',
ar1T:'Cover · Timber Atlas',ar1D:'An exploded vision of the bracket set · TIMBER ATLAS / 01',
ar2T:'The East Hall today',ar2D:'Single-eaved hip roof, dark tiles and ochre walls — built 857',
ar3T:'Column-top bracket set, measured',ar3D:'after Zhang Rong, Liu Chang & Zang Chunyu · 2007',
ar4T:'Chiwen at the ridge ends',ar4D:'Glazed-green dragon-fish — artifact beside its 3D model',
p1:'Ludou',p1e:'栌斗 · Base Block',d1:'The base block of the set — it bears the whole load above the column.',
p2:'Huagong I',p2e:'华拱 · First Projection',d2:'The first projecting arm, crossing the ludou to carry the eave.',
p3:'Lower Ang I',p3e:'下昂 · First Lever',d3:'A sloped lever: its tail pressed beneath the beam, its tip reaching out.',
p4:'Guazigong',p4e:'瓜子拱',d4:'A cross arm locked at right angles to the huagong, ends cut like leaves.',
p5:'Lower Ang II',p5e:'下昂 · Second Lever',d5:'The second ang — a longer lever projecting one step further.',
p6:'Mangong',p6e:'慢拱',d6:'The long cross arm resting on the upper tier, lifting the set layer by layer.',
p7:'Linggong & Timu',p7e:'令拱 · 替木',d7:'The outermost arm, carrying the timu batten toward the eave edge.',
p8:'Eave Purlin',p8e:'撩檐枋',d8:'A round purlin supporting every rafter — the measure of the overhang.',
p9:'Architrave Stack',p9e:'柱头枋 · 三层',d9:'Stacked beams tying every bracket set into one continuous layer.'
}};
let lang='zh';
const t=k=>(I18N[lang][k]!==undefined?I18N[lang][k]:k);

/* ================= renderer / scene ================= */
const canvas=document.getElementById('scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xf4f1ea);
scene.fog=new THREE.Fog(0xf4f1ea,100,240);

const camera=new THREE.PerspectiveCamera(38,window.innerWidth/window.innerHeight,0.1,600);
camera.position.set(26,17,31);

const hemi=new THREE.HemisphereLight(0xfff8ec,0xd8d2c4,0.85); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff2e0,1.15);
sun.position.set(30,44,22); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-32; sun.shadow.camera.right=32;
sun.shadow.camera.top=32; sun.shadow.camera.bottom=-32;
sun.shadow.camera.near=5; sun.shadow.camera.far=130;
sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.02;
scene.add(sun);
const fill=new THREE.DirectionalLight(0xe8ecf2,0.3); fill.position.set(-24,12,-20); scene.add(fill);

/* ================= helpers ================= */
function box(w,h,d,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.castShadow=true;m.receiveShadow=true;return m;}
function cyl(rt,rb,h,mat,seg){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg||16),mat);m.castShadow=true;m.receiveShadow=true;return m;}
function sph(r,mat){const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),mat);m.castShadow=true;return m;}
function extrude(pts,depth,mat){
  const s=new THREE.Shape(); s.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++) s.lineTo(pts[i][0],pts[i][1]);
  s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:depth,bevelEnabled:false,curveSegments:6});
  g.translate(0,0,-depth/2);
  const m=new THREE.Mesh(g,mat); m.castShadow=true; m.receiveShadow=true; return m;
}
function mergeGeos(list){
  const pos=[],norm=[],uv=[];
  const v=new THREE.Vector3();
  list.forEach(it=>{
    const g=it.geo.index?it.geo.toNonIndexed():it.geo;
    const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;
    const nm=new THREE.Matrix3().getNormalMatrix(it.matrix);
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(it.matrix); pos.push(v.x,v.y,v.z);
      v.fromBufferAttribute(n,i).applyMatrix3(nm).normalize(); norm.push(v.x,v.y,v.z);
      if(u) uv.push(u.getX(i),u.getY(i));
    }
  });
  const out=new THREE.BufferGeometry();
  out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  out.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));
  if(uv.length) out.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  return out;
}
function collectPartGeo(g){
  g.updateMatrixWorld(true);
  const items=[];
  g.traverse(o=>{ if(o.isMesh) items.push({geo:o.geometry,matrix:o.matrixWorld.clone()}); });
  return mergeGeos(items);
}
const sstep=x=>x*x*(3-2*x);
const clamp=THREE.MathUtils.clamp;
const lerp=THREE.MathUtils.lerp;

/* ================= palettes & materials ================= */
const PALETTES={
current:{column:'#7c2a1c',wall:'#d3ba8e',plinth:'#b3aea1',beam:'#6e3a24',ludou:'#5e2c1e',huagong:'#7c3f28',ang:'#7c3f28',cross:'#7c3f28',small:'#4e2418',roof:'#33373b',ridge:'#2b2e31',chiwen:'#3f7a63',door:'#4e2b20',lattice:'#6b4a33',gable:'#5d3a2a',ground:'#e8e4d9'},
painted:{column:'#a8372a',wall:'#e6dcc4',plinth:'#b3aea1',beam:'#476f5f',ludou:'#2f6e5a',huagong:'#35705d',ang:'#b8433a',cross:'#35705d',small:'#cfc7b4',roof:'#3a3e42',ridge:'#2e3235',chiwen:'#3f7a63',door:'#6e2a20',lattice:'#8a5a40',gable:'#3a5a4e',ground:'#e8e4d9'},
wood:{column:'#c9a172',wall:'#eae3d2',plinth:'#b3aea1',beam:'#b78f5f',ludou:'#a8875a',huagong:'#c9a172',ang:'#bd9468',cross:'#c9a172',small:'#96784e',roof:'#5c5f63',ridge:'#4a4d50',chiwen:'#5f8a74',door:'#a8875a',lattice:'#b08d5e',gable:'#a8875a',ground:'#e8e4d9'}
};
const M={};
function std(key,rough){const m=new THREE.MeshStandardMaterial({color:PALETTES.current[key],roughness:(rough||0.85),metalness:0});m.userData.key=key;M[key]=m;return m;}
['column','wall','plinth','beam','ludou','huagong','ang','cross','small','roof','ridge','chiwen','door','lattice','gable','ground'].forEach(k=>std(k));
M.chiwen.roughness=0.32; M.chiwen.metalness=0.08;
M.roof.roughness=0.92;

/* ================= groups ================= */
const world=new THREE.Group(); scene.add(world);
const gPlinth=new THREE.Group(),gFrame=new THREE.Group(),gWalls=new THREE.Group(),
      gRoof=new THREE.Group(),gBrackets=new THREE.Group();
world.add(gPlinth,gFrame,gWalls,gRoof,gBrackets);

/* ================= dimensions ================= */
const PLINTH_TOP=0.75, COL_H=4.2, COL_TOP=PLINTH_TOP+COL_H, BRACKET_Y=COL_TOP+0.65;
const EAVE_Y=9.5, EAVE_Z=12.6, MID_Z=5.6, MID_Y=11.4, RIDGE_Y=13.55,
      RIDGE_HALF=10.6, EAVE_HALF=20.6;

/* ================= ground & platform ================= */
const ground=new THREE.Mesh(new THREE.CircleGeometry(150,48),M.ground);
ground.rotation.x=-Math.PI/2; ground.position.y=-1.21; ground.receiveShadow=true; scene.add(ground);

(function(){
  const lo=box(46,1.2,28,M.plinth); lo.position.y=-0.6; gPlinth.add(lo);
  const up=box(43,0.75,26,M.plinth); up.position.y=0.375; gPlinth.add(up);
  for(let i=0;i<3;i++){const st=box(5,0.25*(3-i),1.2,M.plinth);st.position.set(0,0.125+i*0.25,13.6+i*0.6);gPlinth.add(st);}
})();

/* ================= columns ================= */
(function(){
  const colXs=[]; for(let i=0;i<8;i++) colXs.push(-17+i*34/7);
  const put=(x,z,h,rt,rb)=>{
    const c=cyl(rt,rb,h,M.column,14); c.position.set(x,PLINTH_TOP+h/2,z); gFrame.add(c);
    const base=cyl(rt+0.18,rt+0.24,0.28,M.plinth,12); base.position.set(x,PLINTH_TOP+0.14,z); gFrame.add(base);
  };
  colXs.forEach(x=>{put(x,8.8,COL_H,0.30,0.35); put(x,-8.8,COL_H,0.30,0.35);});
  [-4.4,0,4.4].forEach(z=>{put(17,z,COL_H,0.30,0.35); put(-17,z,COL_H,0.30,0.35);});
  [-10.4,-6.24,-2.08,2.08,6.24,10.4].forEach(x=>{put(x,4.4,8.9,0.36,0.42); put(x,-4.4,8.9,0.36,0.42);});
  // architrave 阑额
  const af=box(34.6,0.65,0.35,M.beam); af.position.set(0,COL_TOP+0.325,8.8); gFrame.add(af);
  const ab=af.clone(); ab.position.z=-8.8; gFrame.add(ab);
  const ar=box(0.35,0.65,17.6,M.beam); ar.position.set(17,COL_TOP+0.325,0); gFrame.add(ar);
  const al=ar.clone(); al.position.x=-17; gFrame.add(al);
})();

/* ================= walls / doors / lattice ================= */
(function(){
  const colXs=[]; for(let i=0;i<8;i++) colXs.push(-17+i*34/7);
  // back solid panels
  colXs.forEach(x=>{const p=box(4.157,4.2,0.28,M.wall);p.position.set(x,PLINTH_TOP+2.1,-8.8);gWalls.add(p);});
  // side solid panels
  [-6.6,-2.2,2.2,6.6].forEach(z=>{
    const p1=box(0.28,4.2,3.7,M.wall);p1.position.set(17,PLINTH_TOP+2.1,z);gWalls.add(p1);
    const p2=p1.clone();p2.position.x=-17;gWalls.add(p2);
  });
  // front lower band + top rail
  const fb=box(34,2.2,0.28,M.wall); fb.position.set(0,1.85,8.8); gWalls.add(fb);
  const fr=box(34,0.6,0.25,M.wall); fr.position.set(0,4.65,8.8); gWalls.add(fr);
  const br=box(34,0.6,0.25,M.wall); br.position.set(0,4.65,-8.8); gWalls.add(br);
  const sr1=box(0.25,0.6,17.6,M.wall); sr1.position.set(17,4.65,0); gWalls.add(sr1);
  const sr2=sr1.clone(); sr2.position.x=-17; gWalls.add(sr2);
  // doors (center 3 bays)
  [-4.857,0,4.857].forEach(bx=>{
    [-0.975,0.975].forEach(dx=>{
      const d=box(1.9,2.3,0.12,M.door); d.position.set(bx+dx,1.9,8.98); gWalls.add(d);
    });
  });
  // lattice slats (instanced)
  const slatGeo=new THREE.BoxGeometry(0.09,1.35,0.1);
  const mats=[];
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),s=new THREE.Vector3(1,1,1),p=new THREE.Vector3();
  const addSlat=(x,y,z,ry)=>{e.set(0,ry,0);q.setFromEuler(e);p.set(x,y,z);m4.compose(p,q,s);mats.push(m4.clone());};
  const baySlats=(bx,z,ry)=>{for(let i=0;i<12;i++) addSlat(bx-1.84+i*0.32,3.62,z,ry);};
  [-14.571,-9.714,-4.857,0,4.857,9.714,14.571].forEach(bx=>{
    if(Math.abs(bx)<4.9) baySlats(bx,8.8,0);        // door bays: transom
    else baySlats(bx,8.8,0);                        // outer bays: upper lattice
  });
  for(let i=0;i<102;i++) addSlat(-16.5+i*0.32,3.62,-8.8,0);   // back band
  for(let i=0;i<50;i++){addSlat(17,3.62,-8+i*0.32,Math.PI/2);addSlat(-17,3.62,-8+i*0.32,Math.PI/2);} // sides
  const slats=new THREE.InstancedMesh(slatGeo,M.lattice,mats.length);
  mats.forEach((m,i)=>slats.setMatrixAt(i,m));
  slats.instanceMatrix.needsUpdate=true; slats.castShadow=true; slats.frustumCulled=false;
  gWalls.add(slats);
  // interior floor
  const fl=box(33.5,0.12,17.2,new THREE.MeshStandardMaterial({color:'#57503f',roughness:0.95}));
  fl.position.y=0.81; fl.receiveShadow=true; gFrame.add(fl);
})();

/* ================= frame (beams / purlins / rafters) ================= */
(function(){
  const beam=box(0.7,0.9,9.4,M.beam); beam.position.set(0,10.1,0); gFrame.add(beam);       // 大梁
  const post=box(0.4,1.0,0.4,M.beam); post.position.set(0,11.05,0); gFrame.add(post);        // 蜀柱
  const pl=box(0.55,0.7,6.4,M.beam); pl.position.set(0,11.9,0); gFrame.add(pl);              // 平梁
  [1,-1].forEach(s=>{                                                                        // 叉手
    const c=box(0.32,0.32,2.82,M.beam);
    c.position.set(s*1.3,12.75,0); c.rotation.z=-s*0.4; gFrame.add(c);
    const tj=box(0.3,0.3,1.56,M.beam);                                                       // 托脚
    tj.position.set(0,10.9,s*5.0); tj.rotation.x=-s*0.69; gFrame.add(tj);
  });
  const juan=cyl(0.32,0.32,23,M.beam,14); juan.rotation.z=Math.PI/2; juan.position.set(0,RIDGE_Y,0); gFrame.add(juan);   // 脊槫
  [1,-1].forEach(s=>{const p=cyl(0.28,0.28,33,M.beam,14);p.rotation.z=Math.PI/2;p.position.set(0,MID_Y,s*MID_Z);gFrame.add(p);}); // 平槫
  // rafters
  const rafGeo=new THREE.BoxGeometry(0.24,0.3,1);
  const mats=[];
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),sc=new THREE.Vector3(1,1,1),p=new THREE.Vector3();
  for(const sign of [1,-1]) for(let i=0;i<47;i++){
    const x=-19.95+i*0.85;
    const dy=3.95,dz=-12.1*sign,len=Math.hypot(dy,dz);
    e.set(Math.atan2(-dy,dz),0,0); q.setFromEuler(e);
    p.set(x,11.475,6.35*sign); sc.set(1,1,len);
    m4.compose(p,q,sc); mats.push(m4.clone());
  }
  const rafters=new THREE.InstancedMesh(rafGeo,M.beam,mats.length);
  mats.forEach((m,i)=>rafters.setMatrixAt(i,m));
  rafters.instanceMatrix.needsUpdate=true; rafters.castShadow=true; rafters.frustumCulled=false;
  gFrame.add(rafters);
})();

/* ================= roof ================= */
function buildShell(sign){
  const NX=22,NT=12,pos=[],uv=[],idx=[];
  for(let i=0;i<=NX;i++){
    const s=i/NX, xHalf=lerp(EAVE_HALF,RIDGE_HALF,s), x=-xHalf+2*xHalf*s;
    for(let j=0;j<=NT;j++){
      const tt=j/NT; let z,y;
      if(tt<0.655){const u=tt/0.655; z=lerp(EAVE_Z,MID_Z,u); y=lerp(EAVE_Y,MID_Y,u);}
      else{const u=(tt-0.655)/0.345; z=lerp(MID_Z,0,u); y=lerp(MID_Y,RIDGE_Y,u);}
      pos.push(x,y,z*sign); uv.push(s*10,tt*3);
    }
  }
  for(let i=0;i<NX;i++)for(let j=0;j<NT;j++){
    const a=i*(NT+1)+j,b=a+NT+1;
    if(sign>0) idx.push(a,b,a+1,b,b+1,a+1); else idx.push(a,a+1,b,b,a+1,b+1);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function buildGable(sign){
  const R=new THREE.Vector3(sign*RIDGE_HALF,RIDGE_Y,0);
  const C1=new THREE.Vector3(sign*EAVE_HALF,EAVE_Y,EAVE_Z);
  const C2=new THREE.Vector3(sign*EAVE_HALF,EAVE_Y,-EAVE_Z);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([...R.toArray(),...C1.toArray(),...C2.toArray()],3));
  g.setIndex(sign>0?[0,1,2]:[0,2,1]); g.computeVertexNormals();
  return g;
}
(function(){
  const roofMat=M.roof;
  const sf=new THREE.Mesh(buildShell(1),roofMat); sf.castShadow=true; sf.receiveShadow=true; gRoof.add(sf);
  const sb=new THREE.Mesh(buildShell(-1),roofMat); sb.castShadow=true; sb.receiveShadow=true; gRoof.add(sb);
  const g1=new THREE.Mesh(buildGable(1),M.gable); g1.castShadow=true; g1.receiveShadow=true; gRoof.add(g1);
  const g2=new THREE.Mesh(buildGable(-1),M.gable); g2.castShadow=true; g2.receiveShadow=true; gRoof.add(g2);
  // main ridge 正脊
  const r1=box(21.9,0.6,0.85,M.ridge); r1.position.set(0,14.17,0); gRoof.add(r1);
  const r2=box(21.9,0.24,0.45,M.ridge); r2.position.set(0,14.59,0); gRoof.add(r2);
  // hip ridges 戗脊 + bargeboards 搏风板 + corner beams 角梁
  const up=new THREE.Vector3(0,1,0),fwd=new THREE.Vector3();
  for(const sx of [1,-1]) for(const sz of [1,-1]){
    const R=new THREE.Vector3(sx*RIDGE_HALF,13.87,0), C=new THREE.Vector3(sx*EAVE_HALF,EAVE_Y,sz*EAVE_Z);
    const dir=C.clone().sub(R), len=dir.length(); dir.normalize();
    const q=new THREE.Quaternion().setFromUnitVectors(up,dir);
    const hip=cyl(0.24,0.24,len,roofMat,10); hip.quaternion.copy(q);
    hip.position.copy(R).add(C).multiplyScalar(0.5); gRoof.add(hip);
    const bb=box(0.18,0.5,len,M.beam); bb.quaternion.copy(q);
    bb.position.copy(R).add(C).multiplyScalar(0.5); bb.position.y+=0.12; gRoof.add(bb);
    const cb=box(0.35,0.45,6.29,M.beam);
    fwd.set(sx*3.6,3.5,sz*3.8).normalize();
    cb.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),fwd);
    cb.position.set(sx*18.8,7.75,sz*10.7); gRoof.add(cb);
  }
  // hanging fish 悬鱼 + 惹草
  for(const sx of [1,-1]){
    const n=new THREE.Vector3(sx*0.4,0.917,0).normalize();
    const base=new THREE.Vector3(sx*16.1,11.37,0).addScaledVector(n,0.08);
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),n);
    const leaf=extrude([[0,0],[0.3,0.38],[0.14,0.72],[0,0.98],[-0.14,0.72],[-0.3,0.38]],0.09,M.door);
    leaf.quaternion.copy(q); leaf.position.copy(base); gRoof.add(leaf);
    [1,-1].forEach(s2=>{
      const g3=extrude([[0,0],[0.3,0.38],[0.14,0.72],[0,0.98],[-0.14,0.72],[-0.3,0.38]],0.09,M.door);
      g3.scale.setScalar(0.55); g3.quaternion.copy(q); g3.rotateZ(s2*0.55);
      g3.position.copy(base).add(new THREE.Vector3(s2*0.3,-0.15,0)); gRoof.add(g3);
    });
  }
  // eave boards 连檐 + tile-end discs 瓦当
  const ef=box(41.6,0.2,0.35,M.ridge); ef.position.set(0,9.62,12.6); gRoof.add(ef);
  const eb=ef.clone(); eb.position.z=-12.6; gRoof.add(eb);
  const es1=box(0.35,0.2,25.2,M.ridge); es1.position.set(20.6,9.62,0); gRoof.add(es1);
  const es2=es1.clone(); es2.position.x=-20.6; gRoof.add(es2);
  const wdGeo=new THREE.CylinderGeometry(0.17,0.17,0.09,12);
  const wdMats=[]; const m4=new THREE.Matrix4(),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0)),sc=new THREE.Vector3(1,1,1),p=new THREE.Vector3();
  for(const sign of [1,-1]) for(let i=0;i<47;i++){
    p.set(-19.95+i*0.85,9.55,12.62*sign); m4.compose(p,q,sc); wdMats.push(m4.clone());
  }
  const wd=new THREE.InstancedMesh(wdGeo,M.ridge,wdMats.length);
  wdMats.forEach((m,i)=>wd.setMatrixAt(i,m));
  wd.instanceMatrix.needsUpdate=true; wd.castShadow=true; wd.frustumCulled=false; gRoof.add(wd);
  // tile ridges 瓦垄
  const trGeo=new THREE.BoxGeometry(0.16,0.09,1);
  const trMats=[];
  for(const sign of [1,-1]) for(let i=0;i<47;i++){
    const x=-19.95+i*0.85;
    const seg=(y0,z0,y1,z1)=>{
      const dy=y1-y0,dz=(z1-z0)*sign,len=Math.hypot(dy,dz);
      const qq=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.atan2(-dy,dz),0,0));
      m4.compose(new THREE.Vector3(x,(y0+y1)/2,(z0+z1)/2*sign),qq,new THREE.Vector3(1,1,len));
      trMats.push(m4.clone());
    };
    seg(EAVE_Y+0.06,EAVE_Z,MID_Y+0.06,MID_Z);
    seg(MID_Y+0.06,MID_Z,RIDGE_Y+0.06,0);
  }
  const tr=new THREE.InstancedMesh(trGeo,M.ridge,trMats.length);
  trMats.forEach((m,i)=>tr.setMatrixAt(i,m));
  tr.instanceMatrix.needsUpdate=true; tr.castShadow=true; tr.frustumCulled=false; gRoof.add(tr);
})();

/* ================= chiwen 鸱尾 ================= */
(function(){
  function makeChiwen(){
    const g=new THREE.Group();
    const base=box(1.05,0.42,1.35,M.chiwen); base.position.y=0.21; g.add(base);
    const body=extrude([[0,0.3],[0.85,0.42],[1.02,1.05],[0.82,1.85],[0.45,2.5],[0.08,2.78],[-0.08,2.4],[0.06,1.75],[0.3,1.0],[0.02,0.5]],0.55,M.chiwen);
    body.position.z=-0.275; g.add(body);
    const head=box(0.85,0.5,0.9,M.chiwen); head.position.set(0.5,0.42,0); g.add(head);
    const jawU=box(0.8,0.16,0.78,M.chiwen); jawU.position.set(0.48,0.72,0); g.add(jawU);
    const jawL=box(0.75,0.15,0.78,M.chiwen); jawL.position.set(0.45,0.16,0); g.add(jawL);
    const e1=sph(0.1,M.chiwen); e1.position.set(0.62,0.55,0.34); g.add(e1);
    const e2=sph(0.1,M.chiwen); e2.position.set(0.62,0.55,-0.34); g.add(e2);
    const horn=new THREE.Mesh(new THREE.ConeGeometry(0.13,0.55,8),M.chiwen);
    horn.position.set(0.1,0.95,0); horn.rotation.z=-0.3; horn.castShadow=true; g.add(horn);
    return g;
  }
  const c1=makeChiwen(); c1.position.set(10.35,14.47,0); c1.scale.setScalar(1.15); gRoof.add(c1);
  const c2=makeChiwen(); c2.position.set(-10.35,14.47,0); c2.rotation.y=Math.PI; c2.scale.setScalar(1.15); gRoof.add(c2);
})();

/* ================= dougong bracket parts ================= */
const PARTS=[
 {key:'ludou',explode:[0,0,0],build(g,m){
   const a=box(1.9,0.3,1.35,m); a.position.set(0,0.15,0); g.add(a);
   const b=box(1.55,0.72,1.05,m); b.position.set(0,0.66,0); g.add(b);
 }},
 {key:'huagong',explode:[0,1.6,0],build(g,m){
   const arm=extrude([[-1.35,0],[1.35,0],[0.93,0.75],[-0.93,0.75]],0.6,m);
   arm.rotation.y=Math.PI/2; arm.position.set(0,1.375,0.15); g.add(arm);
 }},
 {key:'ang',explode:[0,2.6,0.8],build(g,m){
   const w=new THREE.Group(); w.position.set(0,3.63,-1.55); w.rotation.x=0.30;
   const arm=extrude([[0,0],[4.4,0],[3.55,0.75],[0,0.75]],0.62,m);
   arm.rotation.y=-Math.PI/2; w.add(arm); g.add(w);
 }},
 {key:'cross',explode:[0,3.4,1.6],build(g,m,ms){
   const arm=extrude([[-1.75,0],[1.75,0],[1.3,0.65],[-1.3,0.65]],0.55,m);
   arm.position.set(0,2.4,1.45); g.add(arm);
   [-1.35,0,1.35].forEach(x=>{const d=box(0.42,0.32,0.42,ms);d.position.set(x,1.91,1.45);g.add(d);});
 }},
 {key:'ang',explode:[0,4.2,2.4],build(g,m){
   const w=new THREE.Group(); w.position.set(0,4.03,-2.6); w.rotation.x=0.30;
   const arm=extrude([[0,0],[6.2,0],[5.2,0.75],[0,0.75]],0.62,m);
   arm.rotation.y=-Math.PI/2; w.add(arm); g.add(w);
 }},
 {key:'cross',explode:[0,5.0,3.2],build(g,m,ms){
   const arm=extrude([[-2.35,0],[2.35,0],[1.9,0.6],[-1.9,0.6]],0.55,m);
   arm.position.set(0,2.95,2.85); g.add(arm);
   const d=box(0.42,0.32,0.42,ms); d.position.set(0,2.49,2.85); g.add(d);
 }},
 {key:'cross',explode:[0,5.8,4.0],build(g,m,ms){
   const arm=extrude([[-1.65,0],[1.65,0],[1.25,0.6],[-1.25,0.6]],0.55,m);
   arm.position.set(0,2.82,3.3); g.add(arm);
   const d=box(0.42,0.32,0.42,ms); d.position.set(0,2.36,3.3); g.add(d);
   const tm=box(3.6,0.3,0.5,ms); tm.position.set(0,3.27,3.3); g.add(tm);
 }},
 {key:'beam',explode:[0,6.4,5.2],build(g,m){
   const p=cyl(0.4,0.4,3.6,m,16); p.rotation.z=Math.PI/2; p.position.set(0,3.82,3.3); g.add(p);
 }},
 {key:'beam',explode:[0,7.2,0],build(g,m){
   [2.85,3.55,4.25].forEach(y=>{const b=box(4.4,0.5,0.5,m);b.position.set(0,y,-0.55);g.add(b);});
   [2.575,3.2,3.9].forEach(y=>{const d=box(0.45,0.28,0.45,m);d.position.set(0,y,-0.55);g.add(d);});
 }}
];
const liveMats=[];
const DG={mode:'explode',step:0,T:1,parts:[]};

const liveGroup=new THREE.Group();
const partGeos=[];
PARTS.forEach((def,i)=>{
  const g=new THREE.Group();
  const mat=M[def.key].clone(); liveMats.push({mat:mat,key:def.key});
  const mSmall=M.small.clone(); liveMats.push({mat:mSmall,key:'small'});
  def.build(g,mat,mSmall);
  g.userData={idx:i,explode:new THREE.Vector3(def.explode[0],def.explode[1],def.explode[2]),f:0,mat:mat,def:def};
  liveGroup.add(g); DG.parts.push(g);
  partGeos.push(collectPartGeo(g));
});
liveGroup.scale.setScalar(0.85);
liveGroup.position.set(0,BRACKET_Y,8.8);
liveGroup.userData.dg={pos:{x:0,z:8.8},rot:0};
world.add(liveGroup);

const ghostMat=new THREE.MeshBasicMaterial({color:0xb23a1f,transparent:true,opacity:0.13,depthWrite:false});
const ghost=new THREE.Mesh(partGeos[0],ghostMat);
ghost.visible=false; liveGroup.add(ghost);

/* static brackets (instanced) */
const staticPositions=[];
(function(){
  const colXs=[]; for(let i=0;i<8;i++) colXs.push(-17+i*34/7);
  colXs.forEach(x=>{staticPositions.push({x:x,z:8.8,rot:0,s:0.85});staticPositions.push({x:x,z:-8.8,rot:Math.PI,s:0.85});});
  [-4.4,0,4.4].forEach(z=>{staticPositions.push({x:17,z:z,rot:Math.PI/2,s:0.85});staticPositions.push({x:-17,z:z,rot:-Math.PI/2,s:0.85});});
  for(let i=0;i<7;i++){const x=-17+(i+0.5)*34/7;staticPositions.push({x:x,z:8.8,rot:0,s:0.78});staticPositions.push({x:x,z:-8.8,rot:Math.PI,s:0.78});}
  // exclude hero position (0, 8.8)
  for(let i=staticPositions.length-1;i>=0;i--) if(staticPositions[i].x===0&&staticPositions[i].z===8.8) staticPositions.splice(i,1);
})();
const staticMeshes=[];
(function(){
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),sc=new THREE.Vector3(),p=new THREE.Vector3();
  PARTS.forEach((def,i)=>{
    const im=new THREE.InstancedMesh(partGeos[i],M[def.key],staticPositions.length);
    staticPositions.forEach((sp,j)=>{
      e.set(0,sp.rot,0); q.setFromEuler(e); sc.setScalar(sp.s);
      p.set(sp.x,BRACKET_Y,sp.z);
      m4.compose(p,q,sc); im.setMatrixAt(j,m4);
    });
    im.instanceMatrix.needsUpdate=true; im.frustumCulled=false; im.castShadow=true;
    im.userData.positions=staticPositions;
    gBrackets.add(im); staticMeshes.push(im);
  });
})();

/* ================= orbit controls ================= */
const ctrl={
  target:new THREE.Vector3(0,5.5,0),gTarget:new THREE.Vector3(0,5.5,0),
  theta:0,phi:1,radius:42,gTheta:0,gPhi:1,gRadius:42,
  update(dt){
    const k=1-Math.exp(-dt*7);
    this.theta+=(this.gTheta-this.theta)*k;
    this.phi+=(this.gPhi-this.phi)*k;
    this.radius+=(this.gRadius-this.radius)*k;
    this.target.lerp(this.gTarget,k);
    camera.position.set(
      this.target.x+this.radius*Math.sin(this.phi)*Math.sin(this.theta),
      this.target.y+this.radius*Math.cos(this.phi),
      this.target.z+this.radius*Math.sin(this.phi)*Math.cos(this.theta));
    camera.lookAt(this.target);
  }
};
function syncCtrl(){
  const off=camera.position.clone().sub(ctrl.gTarget);
  ctrl.gRadius=clamp(off.length(),3.5,95);
  ctrl.gPhi=clamp(Math.acos(clamp(off.y/Math.max(ctrl.gRadius,0.001),-1,1)),0.12,1.52);
  ctrl.gTheta=Math.atan2(off.x,off.z);
  ctrl.radius=ctrl.gRadius; ctrl.phi=ctrl.gPhi; ctrl.theta=ctrl.gTheta;
  ctrl.target.copy(ctrl.gTarget);
}
syncCtrl();

const fly={active:false,t:0,dur:1.5,fromP:new THREE.Vector3(),toP:new THREE.Vector3(),fromT:new THREE.Vector3(),toT:new THREE.Vector3(),
  start(camP,tgt,dur){
    this.fromP.copy(camera.position); this.toP.copy(camP);
    this.fromT.copy(ctrl.gTarget); this.toT.copy(tgt);
    this.t=0; this.dur=dur||1.5; this.active=true;
  },
  update(dt){
    if(!this.active) return;
    this.t+=dt/this.dur;
    const e=this.t<0.5?4*this.t*this.t*this.t:1-Math.pow(-2*this.t+2,3)/2;
    camera.position.lerpVectors(this.fromP,this.toP,e);
    ctrl.target.lerpVectors(this.fromT,this.toT,e);
    ctrl.gTarget.copy(ctrl.target);
    if(this.t>=1){this.active=false; syncCtrl();}
  }
};

/* pointer input */
const pointers=new Map();
let downX=0,downY=0,moved=0,pinchD=0;
let hoverNdc=null,hoverXY={x:0,y:0},pendingBracket=null,hoverPart=null,tooltipClickable=false;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  fly.active=false;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){
    const pts=[...pointers.values()];
    pinchD=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
  }
  downX=e.clientX; downY=e.clientY; moved=0;
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove',e=>{
  hoverNdc={x:(e.clientX/window.innerWidth)*2-1,y:-(e.clientY/window.innerHeight)*2+1};
  hoverXY={x:e.clientX,y:e.clientY};
  if(!pointers.has(e.pointerId)) return;
  const prev=pointers.get(e.pointerId);
  const dx=e.clientX-prev.x, dy=e.clientY-prev.y;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1){
    moved+=Math.abs(dx)+Math.abs(dy);
    if(e.shiftKey||e.buttons===2){
      const k=ctrl.gRadius*0.0011;
      const fwd=new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y=0; fwd.normalize();
      const right=new THREE.Vector3().crossVectors(fwd,new THREE.Vector3(0,1,0)).normalize();
      ctrl.gTarget.addScaledVector(right,-dx*k).addScaledVector(new THREE.Vector3(0,1,0),dy*k);
    }else{
      ctrl.gTheta-=dx*0.0052;
      ctrl.gPhi=clamp(ctrl.gPhi-dy*0.0052,0.12,1.52);
    }
  }else if(pointers.size===2){
    const pts=[...pointers.values()];
    const d=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
    if(pinchD>0) ctrl.gRadius=clamp(ctrl.gRadius*pinchD/Math.max(d,1),3.5,95);
    pinchD=d;
  }
});
canvas.addEventListener('pointerup',e=>{
  pointers.delete(e.pointerId);
  if(pointers.size===0) canvas.classList.remove('dragging');
  if(moved<6&&pointers.size===0){
    if(mode==='pano'){ if(pendingBracket) enterDougong(pendingBracket.pos,pendingBracket.rot); }
    else if(hoverPart&&DG.mode==='assemble'&&hoverPart.userData.idx===DG.step) install();
  }
});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);canvas.classList.remove('dragging');});
canvas.addEventListener('pointerleave',()=>{hoverNdc=null;});
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  ctrl.gRadius=clamp(ctrl.gRadius*Math.exp(e.deltaY*0.0011),3.5,95);
},{passive:false});

/* ================= dougong controller ================= */
let mode='pano';
const lastDg={pos:{x:0,z:8.8},rot:0};
let savedCam=null;

function enterDougong(p,rotY){
  lastDg.pos=p; lastDg.rot=rotY;
  liveGroup.position.set(p.x,BRACKET_Y,p.z);
  liveGroup.rotation.y=rotY;
  liveGroup.userData.dg={pos:p,rot:rotY};
  if(!savedCam) savedCam={pos:camera.position.clone(),target:ctrl.gTarget.clone()};
  setMode('dougong');
  if(DG.mode==='explode'){DG.parts.forEach(pt=>{pt.userData.f=1;});}
  else{DG.parts.forEach(pt=>{pt.userData.f=0;});}
  document.getElementById('explodeSlider').value=DG.T*100;
  const out=new THREE.Vector3(Math.sin(rotY),0,Math.cos(rotY));
  const lat=new THREE.Vector3(Math.cos(rotY),0,-Math.sin(rotY));
  const target=new THREE.Vector3(p.x,BRACKET_Y+1.9,p.z).addScaledVector(out,1.7);
  const cam=target.clone().addScaledVector(out,7.6).addScaledVector(lat,4.8); cam.y+=3.2;
  flyTo(cam,target,1.5);
}
function exitDougong(){
  DG.parts.forEach(pt=>{pt.userData.f=0;});
  if(savedCam) flyTo(savedCam.pos,savedCam.target,1.4);
}
function setMode(m){
  if(mode===m) return;
  mode=m;
  document.querySelectorAll('#modeSwitch button').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));
  document.getElementById('infoCard').classList.toggle('hide',m!=='pano');
  document.getElementById('panelPano').classList.toggle('hide',m!=='pano');
  document.getElementById('panelDougong').classList.toggle('hide',m!=='dougong');
  document.getElementById('partList').classList.toggle('hide',!(m==='dougong'&&DG.mode==='assemble'));
  document.getElementById('hint').textContent=t(m==='pano'?'hintPano':'hintDougong');
  if(m==='dougong') enterDougong(lastDg.pos,lastDg.rot);
  else exitDougong();
}
function setDgMode(m){
  DG.mode=m;
  document.getElementById('tabExplode').classList.toggle('on',m==='explode');
  document.getElementById('tabAssemble').classList.toggle('on',m==='assemble');
  document.getElementById('dgExplode').hidden=m!=='explode';
  document.getElementById('dgAssemble').hidden=m!=='assemble';
  document.getElementById('partList').classList.toggle('hide',m!=='assemble');
  if(m==='assemble'){DG.step=0;DG.parts.forEach(pt=>{pt.userData.f=0;});refreshAssembleUI();}
  updateExplodeCount();
}
function install(){
  if(mode!=='dougong'||DG.mode!=='assemble'||DG.step>=9) return;
  DG.step++; refreshAssembleUI();
  if(DG.step>=9) setTimeout(()=>{if(DG.mode==='assemble')showToast();},500);
}
function undo(){if(DG.step>0){DG.step--;refreshAssembleUI();}}
function refreshAssembleUI(){
  document.getElementById('stepNum').textContent=DG.step+' / 9';
  document.getElementById('stepBar').style.width=(DG.step/9*100)+'%';
  document.getElementById('btnUndo').disabled=DG.step===0;
  document.getElementById('btnInstall').disabled=DG.step>=9;
  if(DG.step<9){
    const d=PARTS[DG.step];
    document.getElementById('curPartName').innerHTML=t(d.nameKey)+'<small>'+t(d.nameKey+'e')+'</small>';
    document.getElementById('curPartDesc').textContent=t(d.descKey);
    ghost.geometry=partGeos[DG.step];
  }else{
    document.getElementById('curPartName').textContent=t('complete');
    document.getElementById('curPartDesc').textContent=t('completeSub');
  }
  buildPartList();
}
function buildPartList(){
  const ol=document.getElementById('partItems');
  ol.innerHTML=PARTS.map((d,i)=>'<li class="'+(i<DG.step?'done':i===DG.step?'next':'')+'" data-i="'+i+'"><span class="n">0'+(i+1)+'</span><span class="t">'+t(d.nameKey)+'<small>'+t(d.nameKey+'e')+'</small></span><span class="st"></span></li>').join('');
  ol.querySelectorAll('li').forEach(li=>li.addEventListener('click',()=>{if(+li.dataset.i===DG.step)install();}));
}
function updateExplodeCount(){
  const n=DG.parts.filter(p=>p.userData.f>0.5).length;
  document.getElementById('explodeCount').textContent=lang==='zh'?('已拆出 '+n+' / 9 件'):(n+' / 9 parts released');
}
function showToast(){document.getElementById('toast').classList.add('show');}
function hideToast(){document.getElementById('toast').classList.remove('show');}

/* part name keys */
PARTS.forEach((d,i)=>{d.nameKey='p'+(i+1);d.descKey='d'+(i+1);});

/* ================= hover / raycast ================= */
const ray=new THREE.Raycaster();
const tooltip=document.getElementById('tooltip');
function setHoverInfo(lines,x,y){
  tooltip.innerHTML=lines.join('<br>');
  tooltip.style.left=x+'px'; tooltip.style.top=y+'px';
  tooltip.style.opacity=1;
}
function clearHover(){
  tooltip.style.opacity=0;
  canvas.classList.remove('pick');
  pendingBracket=null; hoverPart=null;
}
function doHover(){
  if(!hoverNdc){clearHover();return;}
  ray.setFromCamera(hoverNdc,camera);
  if(mode==='pano'){
    const hits=ray.intersectObjects(staticMeshes,false);
    if(hits.length){
      const h=hits[0];
      const sp=h.object.userData.positions[h.instanceId];
      pendingBracket={pos:{x:sp.x,z:sp.z},rot:sp.rot};
      setHoverInfo([t('bracketTip')],hoverXY.x,hoverXY.y);
      canvas.classList.add('pick');
      return;
    }
    const lh=ray.intersectObjects(liveGroup.children,true);
    if(lh.length){
      pendingBracket={pos:lastDg.pos,rot:lastDg.rot};
      setHoverInfo([t('bracketTip')],hoverXY.x,hoverXY.y);
      canvas.classList.add('pick');
      return;
    }
    clearHover();
  }else{
    const hits=ray.intersectObjects(liveGroup.children,true);
    if(hits.length){
      let o=hits[0].object;
      while(o&&o.userData.idx===undefined)o=o.parent;
      if(o){
        const d=o.userData.def;
        hoverPart=o;
        const clickable=DG.mode==='assemble'&&o.userData.idx===DG.step;
        setHoverInfo([t(d.nameKey),'<small style="opacity:.65">'+t(d.nameKey+'e')+'</small>'],hoverXY.x,hoverXY.y);
        canvas.classList.add('pick');
        return;
      }
    }
    clearHover(); hoverPart=null;
  }
}

/* ================= per-frame dougong update ================= */
function updateParts(dt,time){
  const k=Math.min(1,dt*5.5);
  DG.parts.forEach((p,i)=>{
    let fT;
    if(mode!=='dougong') fT=0;
    else if(DG.mode==='explode') fT=sstep(clamp(DG.T*1.6-i*0.06,0,1));
    else fT=i<DG.step?0:1;
    const u=p.userData;
    u.f+=(fT-u.f)*k;
    const isCur=mode==='dougong'&&DG.mode==='assemble'&&i===DG.step;
    const bob=isCur?Math.sin(time*2.6)*0.09:0;
    const wob=isCur?Math.sin(time*0.9)*0.1:0;
    p.position.set(u.explode.x*u.f,u.explode.y*u.f+bob,u.explode.z*u.f);
    p.rotation.y=wob;
    if(isCur){u.mat.emissive.setHex(0xb23a1f);u.mat.emissiveIntensity=0.22+0.16*Math.sin(time*4);}
    else if(u.mat.emissiveIntensity!==0){u.mat.emissiveIntensity=0;}
  });
  ghost.visible=mode==='dougong'&&DG.mode==='assemble'&&DG.step<9;
  if(ghost.visible) ghost.material.opacity=0.1+0.06*Math.sin(time*3);
}

/* ================= UI wiring ================= */
function applyMat(name){
  const P=PALETTES[name];
  for(const k in M) M[k].color.set(P[k]);
  liveMats.forEach(r=>r.mat.color.set(P[r.key]));
  document.querySelectorAll('.mat-switch .dot').forEach(d=>d.classList.toggle('on',d.dataset.mat===name));
}
function applyLang(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const k=el.dataset.i18n;
    if(I18N[lang][k]!==undefined) el.textContent=I18N[lang][k];
  });
  document.documentElement.lang=lang==='zh'?'zh-CN':'en';
  document.getElementById('langToggle').textContent=lang==='zh'?'EN':'中';
  buildPartList(); refreshAssembleUI(); updateExplodeCount();
  document.getElementById('hint').textContent=t(mode==='pano'?'hintPano':'hintDougong');
}
document.querySelectorAll('.mat-switch .dot').forEach(d=>d.addEventListener('click',()=>applyMat(d.dataset.mat)));
document.getElementById('langToggle').addEventListener('click',()=>{lang=lang==='zh'?'en':'zh';applyLang();});
document.querySelectorAll('#modeSwitch button').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
document.getElementById('focusBtn').addEventListener('click',()=>setMode('dougong'));
document.getElementById('tabExplode').addEventListener('click',()=>setDgMode('explode'));
document.getElementById('tabAssemble').addEventListener('click',()=>setDgMode('assemble'));
document.getElementById('explodeSlider').addEventListener('input',e=>{DG.T=e.target.value/100;});
document.getElementById('btnExplodeAll').addEventListener('click',()=>{DG.T=1;document.getElementById('explodeSlider').value=100;});
document.getElementById('btnAssembleAll').addEventListener('click',()=>{DG.T=0;document.getElementById('explodeSlider').value=0;});
document.getElementById('btnInstall').addEventListener('click',install);
document.getElementById('btnUndo').addEventListener('click',undo);
document.getElementById('btnExitDougong').addEventListener('click',()=>setMode('pano'));
document.getElementById('toastExplode').addEventListener('click',()=>{hideToast();setDgMode('explode');DG.T=1;document.getElementById('explodeSlider').value=100;});
document.getElementById('toastPano').addEventListener('click',()=>{hideToast();setMode('pano');});
document.querySelectorAll('#layerChips button').forEach(b=>b.addEventListener('click',()=>{
  const g={roof:gRoof,walls:gWalls,frame:gFrame,brackets:null}[b.dataset.layer];
  if(b.dataset.layer==='brackets'){
    gBrackets.visible=!gBrackets.visible;
    liveGroup.visible=!liveGroup.visible;
  }else{
    g.visible=!g.visible;
  }
  b.classList.toggle('off');
}));
const views={
  front:{cam:new THREE.Vector3(0,9,42),tgt:new THREE.Vector3(0,6,0)},
  side:{cam:new THREE.Vector3(42,9,0),tgt:new THREE.Vector3(0,6,0)},
  iso:{cam:new THREE.Vector3(26,17,31),tgt:new THREE.Vector3(0,5.5,0)}
};
document.querySelectorAll('#viewChips button').forEach(b=>b.addEventListener('click',()=>{
  const v=views[b.dataset.view]; flyTo(v.cam,v.tgt,1.4);
}));
const drawer=document.getElementById('archiveDrawer'),scrim=document.getElementById('scrim');
document.getElementById('archiveBtn').addEventListener('click',()=>{drawer.classList.add('show');scrim.classList.add('show');});
document.getElementById('drawerClose').addEventListener('click',()=>{drawer.classList.remove('show');scrim.classList.remove('show');});
scrim.addEventListener('click',()=>{drawer.classList.remove('show');scrim.classList.remove('show');});
window.addEventListener('keydown',e=>{
  if(mode!=='dougong'||DG.mode!=='assemble') return;
  if(e.key==='ArrowRight') install();
  if(e.key==='ArrowLeft') undo();
});
window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});

/* ================= init ================= */
applyMat('current');
applyLang();
setDgMode('explode');
DG.parts.forEach(p=>{p.userData.f=0;});

const clock=new THREE.Clock();
function tick(){
  requestAnimationFrame(tick);
  const dt=Math.min(clock.getDelta(),0.05);
  const time=clock.elapsedTime;
  if(fly.active) fly.update(dt); else ctrl.update(dt);
  updateParts(dt,time);
  doHover();
  if(mode==='dougong'&&DG.mode==='explode') updateExplodeCount();
  renderer.render(scene,camera);
}

document.getElementById('loader').classList.add('done');
window.addEventListener('load',()=>setTimeout(()=>document.getElementById('loader').classList.add('done'),550));
setTimeout(()=>document.getElementById('loader').classList.add('done'),2500);
window.__dbg={scene:scene,renderer:renderer,camera:camera,M:M,gRoof:gRoof};
tick();

})();
