/* ════════════════════════════════════════════════════════════
   古建数字图谱 · 结构模型视图
   分层拆解 · 构件选择 · 隐藏 / 隔离 / 红色高亮 · 编号标签
   ════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from '../vendor/three/CSS2DRenderer.js';

const MAT = {
  wood:     new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: .82, metalness: .06 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x6e4526, roughness: .85, metalness: .05 }),
  woodLight:new THREE.MeshStandardMaterial({ color: 0xa06a3c, roughness: .8,  metalness: .05 }),
  stone:    new THREE.MeshStandardMaterial({ color: 0x7d7a72, roughness: .95 }),
  tile:     new THREE.MeshStandardMaterial({ color: 0x4b4b55, roughness: .9, side: THREE.DoubleSide }),
  tileEdge: new THREE.MeshStandardMaterial({ color: 0x6a6a76, roughness: .85 }),
  gold:     new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: .35, metalness: .7 }),
  wall:     new THREE.MeshStandardMaterial({ color: 0x2e2118, roughness: .92 }),
  door:     new THREE.MeshStandardMaterial({ color: 0x7a2e22, roughness: .85 }),
  window:   new THREE.MeshStandardMaterial({ color: 0x3d3428, roughness: .9 }),
};

function mesh(geo, mat, x=0, y=0, z=0){
  const m = new THREE.Mesh(geo, mat.clone());
  m.position.set(x, y, z);
  return m;
}
/* 开口八角环带（阑额/平座/檐口） */
function band(r, h, mat, seg=8, open=true){
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg, 1, open), mat);
}
/* 两点之间的细杆（戗脊/铁链/叉手） */
function tube(p1, p2, r, mat){
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
  m.position.copy(p1).addScaledVector(dir, .5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
  return m;
}
/* 八角攒尖/屋檐（开口圆台） */
function octRoof(rBottom, rTop, h, mat){
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 8, 1, true), mat);
}

/* ────────────────────────────────────────────────
   应县木塔 · 程序化结构模型
   ──────────────────────────────────────────────── */
function buildYingxian(){
  const layers = [];   // {no,name,desc,group}
  const comps = new Map(); // id -> {id,name,desc,layer,meshes[],label}
  let layerIdx = 0;
  const L = (no, name, desc) => {
    const g = new THREE.Group();
    const layer = { no, name, desc, group: g, idx: layerIdx++ };
    layers.push(layer);
    return layer;
  };
  const addComp = (layer, id, name, desc, meshes) => {
    meshes.forEach(m => m.userData.compId = id);
    comps.set(id, { id, name, desc, layer, meshes });
    meshes.forEach(m => layer.group.add(m));
  };
  const colRing = (n, r, h, cr, mat, y) => {
    const arr = [];
    for(let i=0;i<n;i++){
      const a = i/n*Math.PI*2;
      arr.push(mesh(new THREE.CylinderGeometry(cr, cr, h, 8), mat, Math.cos(a)*r, y, Math.sin(a)*r));
    }
    return arr;
  };
  const bracketRing = (n, r, y, s=1) => {
    const arr = [];
    for(let i=0;i<n;i++){
      const a = i/n*Math.PI*2, c = Math.cos(a), si = Math.sin(a);
      const b1 = mesh(new THREE.BoxGeometry(.34*s,.2*s,.34*s), MAT.woodLight, c*r, y, si*r);
      const b2 = mesh(new THREE.BoxGeometry(.5*s,.14*s,.2*s), MAT.wood, c*r, y+.17*s, si*r);
      const b3 = mesh(new THREE.BoxGeometry(.2*s,.14*s,.5*s), MAT.wood, c*r, y+.17*s, si*r);
      arr.push(b1,b2,b3);
    }
    return arr;
  };
  const octLayer = (story, bodyR, bodyH, colR, eaveRB, eaveRT, balcony, bracketN) => {
    /* 返回 {layer 内各 comp 尺寸} 由调用方拼装 */
    return { bodyR, bodyH, colR, eaveRB, eaveRT, balcony, bracketN };
  };

  /* ── 00 台基 ── */
  {
    const layer = L("YX-00", "台基 · 双层须弥座", "砖石台基，承托全塔，隔潮避水。");
    const m1 = mesh(new THREE.CylinderGeometry(8.3, 8.6, .55, 8), MAT.stone, 0, .28, 0);
    const m2 = mesh(new THREE.CylinderGeometry(7.5, 7.9, .5, 8), MAT.stone, 0, .78, 0);
    const m3 = mesh(new THREE.CylinderGeometry(7.0, 7.2, .35, 8), MAT.stoneLight, 0, 1.2, 0);
    addComp(layer, "YX-00-01", "台基（双层须弥座）",
      "砖石砌筑的双层须弥座，逐层收分，将六百七十余米塔身的重量均匀传入地基。", [m1,m2,m3]);
  }

  /* ── 明层模板 ── */
  const ming = [
    { no:"YX-S1", name:"一层 · 明层（副阶环廊）", desc:"首层副阶环廊，供人绕塔礼佛，檐下斗拱雄大。" },
    { no:"YX-S2", name:"二层 · 明层（平座勾栏）", desc:"暗层之上设平座勾栏，可凭栏远眺，结构上为刚性箍层。" },
    { no:"YX-S3", name:"三层 · 明层", desc:"明层第三层，四面设直棂窗，内供佛像。" },
    { no:"YX-S4", name:"四层 · 明层", desc:"明层第四层，柱网收分，斗拱出跳渐减。" },
    { no:"YX-S5", name:"五层 · 明层（攒尖）", desc:"顶层明层，上为八角攒尖顶，承接塔刹。" },
  ];
  const dims = [ // bodyR, bodyH, eaveRB, eaveRT, hasBalcony, hasDoors, hasWin
    { r:5.6, h:2.7, eb:7.1, rt:5.3, bal:false, doors:true,  win:false },
    { r:4.9, h:2.35, eb:6.2, rt:4.7, bal:true,  doors:false, win:true  },
    { r:4.35,h:2.2,  eb:5.6, rt:4.3, bal:true,  doors:false, win:true  },
    { r:3.9, h:2.05, eb:5.0, rt:3.9, bal:true,  doors:false, win:false },
    { r:3.5, h:1.9,  eb:4.55,rt:3.55,bal:true,  doors:false, win:false },
  ];
  for(let i=0;i<5;i++){
    const d = dims[i], layer = L(ming[i].no, ming[i].name, ming[i].desc);
    const y0 = 1.38, bodyY = y0 + d.h/2;
    const no = layer.no;
    // 副阶檐柱
    addComp(layer, `${no}-01`, "副阶檐柱", "外环十六柱，支撑副阶深远出檐。", colRing(16, d.r, d.h, .16, MAT.wood, bodyY));
    // 内槽柱
    addComp(layer, `${no}-02`, "内槽柱", "内环八柱，与外柱圈以枋木拉结成套筒。", colRing(8, d.r*.62, d.h*.96, .2, MAT.woodDark, bodyY));
    // 阑额
    const lan1 = band(d.r+.06, .2, MAT.woodLight); lan1.position.y = y0+d.h-.1;
    const lan2 = band(d.r*.62+.05, .18, MAT.woodLight); lan2.position.y = y0+d.h-.12;
    addComp(layer, `${no}-03`, "阑额", "柱头联络之枋，箍束柱网。", [lan1, lan2]);
    // 斗拱
    addComp(layer, `${no}-04`, "斗拱", "副檐斗拱，出跳悬挑，是木塔'柔性抗震'的关键节点。", bracketRing(16, d.r+.18, y0+d.h+.1));
    // 门窗 / 直棂窗
    if(i===0){
      const doors = [], wins = [];
      for(let k=0;k<8;k++){
        const a = k/8*Math.PI*2 + Math.PI/8;
        if(k%2===0) doors.push(mesh(new THREE.BoxGeometry(1.05, 1.75, .08), MAT.door, Math.cos(a)*d.r*.78, y0+.95, Math.sin(a)*d.r*.78));
        else wins.push(mesh(new THREE.BoxGeometry(.9, 1.1, .08), MAT.window, Math.cos(a)*d.r*.78, y0+1.05, Math.sin(a)*d.r*.78));
      }
      doors.forEach(m=>m.lookAt(0,m.position.y,0));
      wins.forEach(m=>m.lookAt(0,m.position.y,0));
      addComp(layer, `${no}-05`, "板门 · 直棂窗", "首层四面设板门与直棂窗。", [...doors, ...wins]);
    } else if(d.win){
      const wins = [];
      for(let k=0;k<8;k++){
        const a = k/8*Math.PI*2 + Math.PI/8;
        const w = mesh(new THREE.BoxGeometry(1.0, 1.2, .08), MAT.window, Math.cos(a)*d.r*.8, y0+d.h*.55, Math.sin(a)*d.r*.8);
        w.lookAt(0, w.position.y, 0);
        wins.push(w);
      }
      addComp(layer, `${no}-05`, "直棂窗", "四面直棂窗，纳光通风。", wins);
    }
    // 平座栏杆（二层起）
    if(d.bal){
      const rail1 = band(d.r+.35, .42, MAT.woodDark); rail1.position.y = y0+d.h+.28;
      const rail2 = band(d.r+.42, .08, MAT.woodLight); rail2.position.y = y0+d.h+.52;
      addComp(layer, `${no}-06`, "平座栏杆", "暗层顶面外挑平座，周设勾栏，供登临远眺。", [rail1, rail2]);
    }
    // 屋檐 / 攒尖
    const eaveH = 1.0 + (4-i)*.06;
    const roofMeshes = [
      octRoof(d.eb, d.rt, eaveH, MAT.tile),
      band(d.eb+.02, .09, MAT.tileEdge),
      band(d.rt+.02, .1, MAT.tileEdge),
    ];
    roofMeshes[0].position.y = y0 + d.h + .35 + eaveH/2;
    roofMeshes[1].position.y = y0 + d.h + .32;
    roofMeshes[2].position.y = y0 + d.h + .35 + eaveH - .05;
    addComp(layer, `${no}-07`, i===4 ? "攒尖顶" : `${"一二三四五“[i]}层屋檐`,
      i===4 ? "顶层八角攒尖顶，宝顶之下承接塔刹。" : `第${"一二三四五“[i]}层屋檐，八角出檐，檐角微翘。`, roofMeshes);
  }

  /* ── 暗层 ── */
  const an = [
    { no:"YX-A1", name:"暗层一 · 斜撑箍束", desc:"以斜撑与枋木构成的刚性结构层，内藏不露。" },
    { no:"YX-A2", name:"暗层二 · 斜撑箍束", desc:"第二道暗层，与上下明层咬合成整体。" },
    { no:"YX-A3", name:"暗层三 · 斜撑箍束", desc:"第三道暗层，结构作用同前。" },
    { no:"YX-A4", name:"暗层四 · 斜撑箍束", desc:"顶层暗层，箍束上部塔身，承托攒尖顶。" },
  ];
  const anDims = [ {r:3.3,h:1.5}, {r:3.0,h:1.4}, {r:2.7,h:1.3}, {r:2.45,h:1.2} ];
  anDims.forEach((d,i)=>{
    const layer = L(an[i].no, an[i].name, an[i].desc);
    const meshes = colRing(8, d.r, d.h, .13, MAT.woodDark, d.h/2);
    for(let k=0;k<8;k++){
      const a1=k/8*Math.PI*2, a2=(k+1)/8*Math.PI*2;
      const p1=new THREE.Vector3(Math.cos(a1)*d.r, .1, Math.sin(a1)*d.r);
      const p2=new THREE.Vector3(Math.cos(a2)*d.r, d.h-.1, Math.sin(a2)*d.r);
      meshes.push(tube(p1,p2,.06,MAT.wood));
    }
    meshes.push(band(d.r+.05,.16,MAT.woodLight));
    meshes[meshes.length-1].position.y = d.h*.5;
    addComp(layer, `${an[i].no}-01`, "暗层斜撑箍层",
      "暗层以斜撑、短柱与环向枋木构成刚性箍带，如桶箍般束紧塔身，是木塔抗震的关键结构层。", meshes);
  });

  /* ── 塔刹 ── */
  {
    const layer = L("YX-TS", "塔刹 · 相轮宝珠", "铁刹杆贯顶，七重相轮，八条铁链拉结于八条戗脊。");
    const topY = 1.38 + dims[4].h + .35 + (1.0+0*.06) + .3; // 攒尖顶上方
    const pole = mesh(new THREE.CylinderGeometry(.07,.09,4.4,8), MAT.gold, 0, topY+2.2, 0);
    const rings = [];
    for(let i=0;i<7;i++){
      rings.push(mesh(new THREE.CylinderGeometry(.85-i*.09,.85-i*.09,.14,12), MAT.gold, 0, topY+.6+i*.5, 0));
    }
    const orb = mesh(new THREE.SphereGeometry(.34,12,10), MAT.gold, 0, topY+4.35, 0);
    const flame = mesh(new THREE.ConeGeometry(.2,.55,8), MAT.gold, 0, topY+4.85, 0);
    addComp(layer, "YX-TS-01", "刹杆", "铁制刹杆贯穿塔顶，为全塔制高之枢。", [pole]);
    addComp(layer, "YX-TS-02", "相轮（七重）", "七重相轮层层收分，表佛塔庄严。", rings);
    addComp(layer, "YX-TS-03", "宝珠 · 火焰", "刹顶宝珠火焰，夜间远望如灯。", [orb, flame]);
    // 铁链
    const chains = [];
    const top = new THREE.Vector3(0, topY+3.4, 0);
    for(let k=0;k<8;k++){
      const a=k/8*Math.PI*2+Math.PI/8;
      const end = new THREE.Vector3(Math.cos(a)*4.35, topY-.35, Math.sin(a)*4.35);
      chains.push(tube(top, end, .028, MAT.gold));
    }
    addComp(layer, "YX-TS-04", "铁链拉结", "八条铁链自刹顶拉结八方檐角，稳定塔刹。", chains);
  }

  return { layers, comps, gap: 2.5, name: "应县木塔" };
}

/* ────────────────────────────────────────────────
   南禅寺大殿 · 程序化结构模型
   ──────────────────────────────────────────────── */
function buildNanchan(){
  const layers = []; const comps = new Map(); let layerIdx = 0;
  const L = (no,name,desc)=>{ const g=new THREE.Group(); const layer={no,name,desc,group:g,idx:layerIdx++}; layers.push(layer); return layer; };
  const addComp = (layer,id,name,desc,meshes)=>{ meshes.forEach(m=>m.userData.compId=id); comps.set(id,{id,name,desc,layer,meshes}); meshes.forEach(m=>layer.group.add(m)); };

  /* ── 00 台基 ── */
  {
    const layer = L("NC-00","台基","低矮砖石台基，前设踏道。");
    const m1 = mesh(new THREE.BoxGeometry(13.4,.7,11.4), MAT.stone, 0,.35,0);
    const steps = [];
    [0,1,2].forEach(i=> steps.push(mesh(new THREE.BoxGeometry(2.4-i*.3,.24,1.0), MAT.stoneLight, 0, .12+i*.24, 5.7+(2-i)*.42)));
    addComp(layer,"NC-00-01","台基 · 踏道","砖石台基高不足一米，前出踏道三级。",[m1,...steps]);
  }
  /* ── S1 檐柱网 ── */
  {
    const layer = L("NC-S1","檐柱网 · 侧脚","檐柱十二根，柱头微向内倾（侧脚），角柱加高（升起）。");
    const xs=[-5.5,-1.83,1.83,5.5], zs=[-4,-1.33,1.33,4], cols=[];
    let n=1;
    const at=(x,z)=>cols.push(mesh(new THREE.CylinderGeometry(.24,.26,4.4,10), MAT.wood, x, 2.9, z));
    xs.forEach(x=>{ at(x,-4); at(x,4); });
    zs.slice(1,3).forEach(z=>{ at(-5.5,z); at(5.5,z); });
    cols.forEach(m=>addComp(layer,`NC-C-${String(n).padStart(2,"0")}`,"檐柱","檐柱一根，柱头内倾，侧脚稳固。",[m]),n++);
  }
  /* ── S2 斗拱层 ── */
  {
    const layer = L("NC-S2","斗拱层 · 五铺作","柱头铺作五铺作双杪，补间铺作仅一朵，唐风雄大。");
    const tou=[], bu=[];
    const xs=[-5.5,-1.83,1.83,5.5], zs=[-4,-1.33,1.33,4];
    const mk=(x,z)=>{
      tou.push(mesh(new THREE.BoxGeometry(.55,.32,.55), MAT.woodLight, x, 5.28, z));
      tou.push(mesh(new THREE.BoxGeometry(1.15,.16,.24), MAT.wood, x, 5.5, z));
      tou.push(mesh(new THREE.BoxGeometry(.24,.16,1.15), MAT.wood, x, 5.5, z));
    };
    xs.forEach(x=>{ mk(x,-4); mk(x,4); });
    zs.slice(1,3).forEach(z=>{ mk(-5.5,z); mk(5.5,z); });
    addComp(layer,"NC-DG-02","柱头铺作（五铺作）","每柱柱头一朵五铺作斗拱，双杪出跳，直接承托檐方——唐代斗拱不纯为装饰，而是结构悬挑之臂。",tou);
    [-3.67,3.67].forEach(x=>{ [-4,4].forEach(z=>{
      bu.push(mesh(new THREE.BoxGeometry(.4,.26,.4), MAT.woodLight, x, 5.24, z));
      bu.push(mesh(new THREE.BoxGeometry(.85,.14,.2), MAT.wood, x, 5.44, z));
    });});
    [-5.5,5.5].forEach(x=>{ [-2.67,2.67].forEach(z=>{
      bu.push(mesh(new THREE.BoxGeometry(.4,.26,.4), MAT.woodLight, x, 5.24, z));
      bu.push(mesh(new THREE.BoxGeometry(.2,.14,.85), MAT.wood, x, 5.44, z));
    });});
    addComp(layer,"NC-DG-03","补间铺作","两柱之间补间一朵，疏朗开阔，正是唐构“斗拱硕大、补间稀疏”的标识。",bu);
    // 阑额
    const e1 = mesh(new THREE.BoxGeometry(11.6,.26,.3), MAT.woodLight, 0, 5.02, -4.05);
    const e2 = e1.clone(); e2.position.z = 4.05;
    const e3 = mesh(new THREE.BoxGeometry(.3,.26,8.4), MAT.woodLight, -5.55, 5.02, 0);
    const e4 = e3.clone(); e4.position.x = 5.55;
    addComp(layer,"NC-DG-01","阑额","柱头间联络枋木，唐构阑额不出头，简洁古朴。",[e1,e2,e3,e4]);
  }
  /* ── S3 梁架 ── */
  {
    const layer = L("NC-S3","梁架 · 叉手蜀柱","四椽栿通搭前后檐，上立蜀柱、平梁，叉手如人字相扶——标准唐式梁架。");
    const fu  = mesh(new THREE.BoxGeometry(.34,.4,8.6), MAT.wood, 0, 5.85, 0);       // 四椽栿（沿进深）
    const ping= mesh(new THREE.BoxGeometry(4.6,.32,.28), MAT.wood, 0, 7.15, 0);       // 平梁（沿面阔）
    const shu = [];
    [-1.9,1.9].forEach(x=> shu.push(mesh(new THREE.CylinderGeometry(.14,.16,1.35,8), MAT.wood, x, 6.72, 0))); // 蜀柱
    const cha = [
      tube(new THREE.Vector3(-2.0,7.3,0), new THREE.Vector3(0,8.35,0), .11, MAT.wood),
      tube(new THREE.Vector3( 2.0,7.3,0), new THREE.Vector3(0,8.35,0), .11, MAT.wood),
    ];
    const tuo = [
      tube(new THREE.Vector3(-2.0,7.3,0), new THREE.Vector3(-3.6,5.9,0), .09, MAT.woodDark),
      tube(new THREE.Vector3( 2.0,7.3,0), new THREE.Vector3( 3.6,5.9,0), .09, MAT.woodDark),
    ];
    const qian = [
      mesh(new THREE.BoxGeometry(2.6,.22,.24), MAT.woodDark, -4.1, 5.7, 0),
      mesh(new THREE.BoxGeometry(2.6,.22,.24), MAT.woodDark,  4.1, 5.7, 0),
    ];
    addComp(layer,"NC-L-01","四椽栿","大梁四椽栿通搭前后檐柱，是屋身至屋顶的传力主干，梁背微曲（月梁之意）。",[fu]);
    addComp(layer,"NC-L-02","平梁","平梁架于蜀柱之上，梁上再立蜀柱、施叉手以托脊槫。",[ping]);
    addComp(layer,"NC-L-03","蜀柱","短柱立于四椽栿，支承平梁，唐式梁架的典型构件。",shu);
    addComp(layer,"NC-L-04","叉手","叉手两根自平梁两端斜托脊槫，形如人字——唐构特征，宋以后渐被侏儒柱取代。",cha);
    addComp(layer,"NC-L-05","托脚","托脚斜撑于平梁与四椽栿之间，防梁架侧移。",tuo);
    addComp(layer,"NC-L-06","剳牵","联系蜀柱与檐柱的横向枋木，使梁架与柱网咬合成整体。",qian);
  }
  /* ── S4 屋身 ── */
  {
    const layer = L("NC-S4","屋身 · 墙体门窗","山墙与后檐墙围护，前檐设板门、直棂窗。");
    const w1 = mesh(new THREE.BoxGeometry(.2,6.2,7.6), MAT.wall, -5.5, 3.8, 0);
    const w2 = w1.clone(); w2.position.x = 5.5;
    // 山花（三角）
    const tri = new THREE.Shape();
    tri.moveTo(-3.4,0); tri.lineTo(3.4,0); tri.lineTo(0,1.7); tri.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(tri, { depth:.16, bevelEnabled:false });
    const g1 = new THREE.Mesh(gableGeo, MAT.wall.clone()); g1.rotation.y = -Math.PI/2; g1.position.set(5.58, 6.9, 0);
    const g2 = new THREE.Mesh(gableGeo, MAT.wall.clone()); g2.rotation.y = Math.PI/2; g2.position.set(-5.58, 6.9, 0);
    const back = mesh(new THREE.BoxGeometry(11,6.2,.18), MAT.wall, 0, 3.8, -4.05);
    addComp(layer,"NC-W-01","山墙 · 山花","两端山墙收束梁架，上部三角形山花覆于博风板之间。",[w1,w2,g1,g2]);
    const doors = [
      mesh(new THREE.BoxGeometry(1.7,2.7,.12), MAT.door, -1.0, 2.05, 4.08),
      mesh(new THREE.BoxGeometry(1.7,2.7,.12), MAT.door,  1.0, 2.05, 4.08),
    ];
    addComp(layer,"NC-W-02","板门","明间两扇板门，唐代寺观常设板门，简洁庄重。",doors);
    const wins = [];
    [-4.6,-2.6,2.6,4.6].forEach(x=>{
      wins.push(mesh(new THREE.BoxGeometry(1.1,1.3,.1), MAT.window, x, 1.85, 4.08));
      for(let k=0;k<3;k++) wins.push(mesh(new THREE.BoxGeometry(.06,1.05,.14), MAT.woodLight, x-.32+k*.32, 1.85, 4.08));
    });
    addComp(layer,"NC-W-03","直棂窗","直棂窗竖棂密排，唐构常见形制。",wins);
    addComp(layer,"NC-W-04","后檐墙","后檐编竹泥墙围护殿身。",[back]);
  }
  /* ── S5 屋顶 ── */
  {
    const layer = L("NC-S5","屋顶 · 歇山顶","单檐歇山顶：正脊、四垂脊、四戗脊，两端山花悬鱼，出檐深远。");
    const V = (x,y,z)=>new THREE.Vector3(x,y,z);
    const ridge1=V(-5.45,8.45,0), ridge2=V(5.45,8.45,0);
    const U=[V(-5.45,6.9,3.4),V(5.45,6.9,3.4),V(5.45,6.9,-3.4),V(-5.45,6.9,-3.4)];
    const Lo=[V(-7.1,5.75,4.7),V(7.1,5.75,4.7),V(7.1,5.75,-4.7),V(-7.1,5.75,-4.7)];
    const quad=(a,b,c,d)=>{ const g=new THREE.BufferGeometry();
      g.setFromPoints([a,b,c,d]); g.setIndex([0,1,2,0,2,3]); g.computeVertexNormals();
      const m=new THREE.Mesh(g, MAT.tile.clone()); m.material.side=THREE.DoubleSide; return m; };
    const roofMeshes = [
      quad(ridge1,ridge2,U[1],U[0]),            // 前坡
      quad(ridge2,ridge1,U[3],U[2]),            // 后坡
      quad(U[0],U[1],Lo[1],Lo[0]),              // 前厦
      quad(U[2],U[3],Lo[3],Lo[2]),              // 后厦
      quad(U[1],U[2],Lo[2],Lo[1]),              // 右厦
      quad(U[3],U[0],Lo[0],Lo[3]),              // 左厦
    ];
    // 封底
    roofMeshes.push(quad(Lo[0],Lo[1],Lo[2],Lo[3]));
    addComp(layer,"NC-R-01","歇山顶","单檐庑殿与歇山之间的高等级屋顶，四坡九脊，檐口深远近四米，为殿身遮风挡雨。",roofMeshes);
    const main = tube(ridge1, ridge2, .13, MAT.tileEdge); main.position.y = .12;
    const tailL = mesh(new THREE.ConeGeometry(.3,.7,6), MAT.tileEdge, -5.55, 8.68, 0);
    const tailR = mesh(new THREE.ConeGeometry(.3,.7,6), MAT.tileEdge,  5.55, 8.68, 0);
    addComp(layer,"NC-R-02","正脊 · 鸱尾","正脊两端唐式鸱尾，内卷素面，为现存孤例（原物藏于殿内）。",[main,tailL,tailR]);
    const chui = [
      tube(ridge1,U[0],.09,MAT.tileEdge), tube(ridge1,U[3],.09,MAT.tileEdge),
      tube(ridge2,U[1],.09,MAT.tileEdge), tube(ridge2,U[2],.09,MAT.tileEdge),
    ];
    addComp(layer,"NC-R-03","垂脊","四条垂脊自正脊端部下延至山面。",chui);
    const qiang = [
      tube(U[0],Lo[0],.09,MAT.tileEdge), tube(U[1],Lo[1],.09,MAT.tileEdge),
      tube(U[2],Lo[2],.09,MAT.tileEdge), tube(U[3],Lo[3],.09,MAT.tileEdge),
    ];
    addComp(layer,"NC-R-04","戗脊","戗脊自角部起翘，将屋面荷载传至角梁。",qiang);
    const bf1 = tube(ridge1,U[0],.07,MAT.woodLight); bf1.scale.x=1.4;
    const bf2 = tube(ridge1,U[3],.07,MAT.woodLight); bf2.scale.x=1.4;
    const bf3 = tube(ridge2,U[1],.07,MAT.woodLight); bf3.scale.x=1.4;
    const bf4 = tube(ridge2,U[2],.07,MAT.woodLight); bf4.scale.x=1.4;
    addComp(layer,"NC-R-05","博风板","博风板封护山面檩条端头，板上悬鱼惹草。",[bf1,bf2,bf3,bf4]);
    const fish = [];
    [-1,1].forEach(s=>{
      const f = mesh(new THREE.OctahedronGeometry(.28), MAT.gold, s*5.62, 7.6, 0);
      f.scale.set(.55,1.1,.35);
      fish.push(f);
    });
    addComp(layer,"NC-R-06","悬鱼","山面博风相交处悬鱼惹草，寓“水克火”之意。",fish);
  }
  return { layers, comps, gap: 3.0, name:"南禅寺大殿" };
}

/* ────────────────────────────────────────────────
   视图控制器
   ──────────────────────────────────────────────── */
window.ModelView = class {
  constructor(container, canvas, buildingId, hooks={}){
    this.container = container; this.canvas = canvas; this.hooks = hooks;
    this.buildingId = buildingId;
    this.model = buildingId==="yx" ? buildYingxian() : buildNanchan();
    this.comps = this.model.comps; this.layers = this.model.layers;
    this.gap = this.model.gap;
    this.selected = null;      // {type:'comp'|'layer', id|no}
    this.targetT = 0; this.t = 0;
    this.labelsOn = true;
    this._initThree();
    this._buildScene();
    this._buildTree();
    this._bindUI();
    this._loop = this._loop.bind(this);
    this.raf = requestAnimationFrame(this._loop);
  }

  _initThree(){
    const w = this.container.clientWidth || 800, h = this.container.clientHeight || 600;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias:true, alpha:true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    Object.assign(this.labelRenderer.domElement.style, { position:"absolute", top:"0", left:"0", pointerEvents:"none" });
    this.container.appendChild(this.labelRenderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0b0a08, 70, 190);
    this.camera = new THREE.PerspectiveCamera(46, w/h, .1, 500);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = .06;
    this.controls.maxDistance = 160; this.controls.minDistance = 6;
    this.controls.autoRotateSpeed = 1.2;
    // 灯光
    this.scene.add(new THREE.HemisphereLight(0xf2e2c2, 0x1a140d, 1.0));
    const key = new THREE.DirectionalLight(0xffe6b8, 1.6); key.position.set(28, 46, 22); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x93a7cc, .5); rim.position.set(-30, 20, -28); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xd9a441, .35); fill.position.set(0, 12, 40); this.scene.add(fill);
    // 地面
    const gc = document.createElement("canvas"); gc.width = gc.height = 256;
    const gx = gc.getContext("2d");
    const grad = gx.createRadialGradient(128,128,10,128,128,128);
    grad.addColorStop(0,"rgba(0,0,0,.55)"); grad.addColorStop(1,"rgba(0,0,0,0)");
    gx.fillStyle = grad; gx.fillRect(0,0,256,256);
    const gTex = new THREE.CanvasTexture(gc);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 40),
      new THREE.MeshBasicMaterial({ map:gTex, transparent:true, depthWrite:false }));
    ground.rotation.x = -Math.PI/2; ground.position.y = -.02;
    this.scene.add(ground);
    this.ground = ground;
    // 拾取
    this.raycaster = new THREE.Raycaster();
    this.pickables = [];
    this.comps.forEach(c => this.pickables.push(...c.meshes));
    // 点击 vs 拖拽
    let downX=0, downY=0;
    this.canvas.addEventListener("pointerdown", e=>{ downX=e.clientX; downY=e.clientY; });
    this.canvas.addEventListener("pointerup", e=>{
      if(Math.hypot(e.clientX-downX, e.clientY-downY) > 6) return;
      this._onPick(e);
    });
    new ResizeObserver(()=>this._resize()).observe(this.container);
  }

  _buildScene(){
    const box = new THREE.Box3();
    this.layers.forEach(layer=>{
      layer.group.userData.baseY = 0;
      this.scene.add(layer.group);
    });
    // 记录每层锚点高度用于标签与相机
    this.scene.updateMatrixWorld(true);
    // 标签
    this.compLabels = [];
    this.comps.forEach(c=>{
      const anchor = c.meshes[0];
      const el = document.createElement("div");
      el.className = "mk-label";
      el.innerHTML = `${c.id}<span class="cn">${c.name}</span>`;
      const o = new CSS2DObject(el);
      o.position.set(0, this._meshTop(c)+.35, 0);
      anchor.add(o);
      c.labelEl = el; c.labelObj = o;
      this.compLabels.push(o);
      this._applyLabel(c);
    });
    // 包围盒 → 相机
    this.scene.updateMatrixWorld(true);
    this.scene.traverse(o=>{ if(o.isMesh && o.userData.compId) box.expandByObject(o); });
    if(!box.isEmpty()){
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3()).length();
      this.controls.target.copy(c);
      this.camera.position.set(c.x + s*.62, c.y + s*.55, c.z + s*.62);
      this.camera.lookAt(c);
      this.baseDist = s;
    }
  }
  _meshTop(c){
    const b = new THREE.Box3().setFromObject(c.meshes[0]);
    return b.max.y - c.meshes[0].position.y + c.layer.group.position.y;
  }

  _buildTree(){
    const tree = document.getElementById("layerTree");
    tree.innerHTML = "";
    this.treeRows = new Map();
    this.layers.forEach(layer=>{
      const row = document.createElement("div");
      row.className = "layer-row"; row.dataset.no = layer.no;
      row.innerHTML = `
        <span class="no">${layer.no}</span>
        <span class="nm">${layer.name}</span>
        <span class="ops">
          <button data-op="hl" title=“红色高亮整层”>高亮</button>
          <button data-op="iso" title=“仅看本层”>隔离</button>
        </span>
        <button class="eye" title=“显示 / 隐藏”>👁</button>`;
      row.querySelector(".eye").addEventListener("click", e=>{
        e.stopPropagation();
        this._toggleLayerVisible(layer);
      });
      row.querySelectorAll(".ops button").forEach(btn=>{
        btn.addEventListener("click", e=>{
          e.stopPropagation();
          const op = btn.dataset.op;
          if(op==="hl") this._selectLayer(layer, true);
          if(op==="iso") this._isolateLayer(layer);
        });
      });
      row.addEventListener("click", ()=>this._selectLayer(layer, true));
      tree.appendChild(row);
      this.treeRows.set(layer.no, row);
    });
  }

  _bindUI(){
    const $ = id => document.getElementById(id);
    const range = $("explodeRange");
    const syncRange = ()=>{
      range.value = Math.round(this.targetT*100);
      range.style.setProperty("--fill", (this.targetT*100)+"%");
    };
    range.addEventListener("input", ()=>{ this.targetT = range.value/100; range.style.setProperty("--fill", range.value+"%"); });
    this._syncRange = syncRange;
    $("btnExplode").addEventListener("click", ()=>{ this.targetT = 1; syncRange(); });
    $("btnAssemble").addEventListener("click", ()=>{ this.targetT = 0; syncRange(); });
    $("actHighlight").addEventListener("click", ()=>{ this.selected ? this._highlight(this.selected) : this.hooks.toast(“请先在模型上点选构件”); });
    $("actHide").addEventListener("click", ()=>{ this.selected ? this._hide(this.selected) : this.hooks.toast(“请先在模型上点选构件”); });
    $("actIsolate").addEventListener("click", ()=>{ this.selected ? this._isolate(this.selected) : this.hooks.toast(“请先在模型上点选构件”); });
    $("actShowAll").addEventListener("click", ()=>this._showAll());
    $("actSpin").addEventListener("click", e=>{
      this.controls.autoRotate = !this.controls.autoRotate;
      e.currentTarget.classList.toggle("on", this.controls.autoRotate);
    });
    $("actLabels").addEventListener("click", e=>{
      this.labelsOn = !this.labelsOn;
      e.currentTarget.classList.toggle("on", this.labelsOn);
      this.compLabels.forEach(o=>o.visible = this.labelsOn);
    });
    $("compClose").addEventListener("click", ()=>this._deselect());
    $("compHide").addEventListener("click", ()=>this.selected && this._hide(this.selected));
    $("compIsolate").addEventListener("click", ()=>this.selected && this._isolate(this.selected));
    $("compHighlight").addEventListener("click", ()=>this.selected && this._highlight(this.selected));
  }

  /* ── 选择 ── */
  _onPick(e){
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables.filter(m=>m.visible), false);
    if(hits.length){
      const id = hits[0].object.userData.compId;
      this._selectComp(id);
    } else this._deselect();
  }
  _selectComp(id, hl=false){
    const c = this.comps.get(id); if(!c) return;
    this._clearSel();
    this.selected = { type:"comp", id };
    c.labelEl && c.labelEl.classList.add("sel");
    if(hl) this._highlight(this.selected);
    this._showCard(c.id, c.name, c.desc);
    this._markTreeRow(c.layer.no);
  }
  _selectLayer(layer, hl=false){
    this._clearSel();
    this.selected = { type:"layer", no: layer.no };
    if(hl) this._highlight(this.selected);
    this._showCard(layer.no, layer.name, layer.desc);
    this._markTreeRow(layer.no);
  }
  _markTreeRow(no){
    this.treeRows.forEach((row,k)=>row.classList.toggle("sel", k===no));
  }
  _clearSel(){
    if(this.selected && this.selected.type==="comp"){
      const c = this.comps.get(this.selected.id);
      c && c.labelEl && c.labelEl.classList.remove("sel");
    }
    this.selected = null;
    this._markTreeRow(null);
  }
  _deselect(){
    this._clearSel();
    const card = document.getElementById("compCard");
    card.hidden = true;
  }
  _showCard(no, name, desc){
    document.getElementById("compNo").textContent = `构件编号 · ${no}`;
    document.getElementById("compName").textContent = name;
    document.getElementById("compDesc").textContent = desc;
    document.getElementById("compCard").hidden = false;
  }

  /* ── 操作 ── */
  _eachComp(target, fn){
    if(target.type==="comp") fn(this.comps.get(target.id));
    else { const layer = this.layers.find(l=>l.no===target.no); layer && this.comps.forEach(c=>{ if(c.layer===layer) fn(c); }); }
  }
  _highlight(target){
    this._eachComp(target, c=>{
      c.meshes.forEach(m=>{ m.material.emissive.setHex(0xe5484d); m.material.emissiveIntensity = .6; });
    });
    this.hooks.toast(“已红色高亮所选构件”);
  }
  _unhighlight(target){
    this._eachComp(target, c=>{
      c.meshes.forEach(m=>{ m.material.emissive.setHex(0x000000); m.material.emissiveIntensity = 1; });
    });
  }
  _isHidden(c){ return !c.meshes[0].visible; }
  _hide(target){
    this.isolateState = true;
    this._eachComp(target, c=>{
      c.meshes.forEach(m=>m.visible=false);
      c.labelObj.visible = false;
    });
    if(target.type==="layer"){
      const row = this.treeRows.get(target.no);
      row && row.classList.add("hidden-l");
      row && row.querySelector(".eye").classList.add("off");
    } else {
      const c = this.comps.get(target.id);
      const row = c && this.treeRows.get(c.layer.no);
      if(row && [...this.comps.values()].filter(x=>x.layer.no===c.layer.no).every(x=>this._isHidden(x))){
        row.classList.add("hidden-l"); row.querySelector(".eye").classList.add("off");
      }
    }
    this.hooks.toast(“已隐藏所选构件”);
  }
  _isolate(target){
    this.isolateState = true;
    this.comps.forEach(c=>{
      const inSel = target.type==="comp" ? c.id===target.id : c.layer.no===target.no;
      c.meshes.forEach(m=>m.visible = inSel);
      c.labelObj.visible = inSel && this.labelsOn;
    });
    this.layers.forEach(l=>{
      const hidden = [...this.comps.values()].filter(c=>c.layer===l).every(c=>this._isHidden(c));
      const row = this.treeRows.get(l.no);
      if(hidden){ row.classList.add("hidden-l"); row.querySelector(".eye").classList.add("off"); }
    });
    this.hooks.toast(“已隔离所选 · 其余构件隐藏”);
  }
  _showAll(){
    this.isolateState = false;
    this.comps.forEach(c=>{
      c.meshes.forEach(m=>m.visible=true);
      c.labelObj.visible = this.labelsOn;
    });
    this.treeRows.forEach(row=>{ row.classList.remove("hidden-l"); row.querySelector(".eye").classList.remove("off"); });
    this._deselect();
    this.hooks.toast(“已显示全部构件”);
  }
  _toggleLayerVisible(layer){
    const allHidden = [...this.comps.values()].filter(c=>c.layer===layer).every(c=>this._isHidden(c));
    this.isolateState = !allHidden;
    const row = this.treeRows.get(layer.no);
    this.comps.forEach(c=>{
      if(c.layer!==layer) return;
      c.meshes.forEach(m=>m.visible = allHidden);
      c.labelObj.visible = allHidden && this.labelsOn;
    });
    row.classList.toggle("hidden-l", !allHidden);
    row.querySelector(".eye").classList.toggle("off", !allHidden);
    this.hooks.toast(allHidden ? `已显示「${layer.name}」` : `已隐藏「${layer.name}」`);
  }
  _applyLabel(){}

  /* ── 主循环 ── */
  _loop(){
    this.raf = requestAnimationFrame(this._loop);
    // 拆解插值
    this.t += (this.targetT - this.t) * .07;
    if(Math.abs(this.targetT - this.t) < .0005) this.t = this.targetT;
    this.layers.forEach((layer,i)=>{
      layer.group.position.y = i * this.gap * this.t;
    });
    this.ground.material.opacity = 1 - this.t*.55;
    // 标签显隐：合拢时仅显示选中构件，拆解后全部展开
    if(!this.isolateState){
      this.comps.forEach(c=>{
        const show = this.labelsOn && (this.t > .12 ||
          (this.selected && this.selected.type==="comp" && this.selected.id===c.id));
        c.labelObj.visible = show;
      });
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  _resize(){
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if(!w || !h) return;
    this.camera.aspect = w/h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.labelRenderer.setSize(w, h);
  }

  dispose(){
    cancelAnimationFrame(this.raf);
    this.controls.dispose();
    this.scene.traverse(o=>{
      if(o.isMesh){ o.geometry && o.geometry.dispose(); if(o.material && o.material.dispose) o.material.dispose(); }
    });
    this.renderer.dispose();
    this.labelRenderer.domElement.remove();
  }
};
