/* ══════════════════════════════════════════════
   古建数字图谱 · 程序化测绘图
   以 SVG 线描生成"意象测绘图"：立面 / 剖面 / 构件细部
   ══════════════════════════════════════════════ */
(function(){
const GOLD = "#d9a441", GOLD_HI = "#f0c979", DIM = "#7a6a4d", WOOD = "#8a5a33", TILE = "#4d4d57";

const svgOpen = (w, h, bg) =>
  `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">
   <defs>
     <pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
       <line x1="0" y1="0" x2="0" y2="6" stroke="${DIM}" stroke-width="1" opacity=".5"/>
     </pattern>
   </defs>
   <rect width="${w}" height="${h}" fill="${bg||"#0d0b09"}"/>`;

const line = (x1,y1,x2,y2,c=GOLD,w=.8,o=1)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" opacity="${o}"/>`;
const rect = (x,y,w,h,stroke=GOLD,fill="none",sw=.8)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const path = (d,stroke=GOLD,fill="none",sw=.8)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const circle = (cx,cy,r,stroke=GOLD,fill="none",sw=.8)=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const text = (x,y,t,c=GOLD,size=11,anchor="middle",ls=1.5)=>`<text x="${x}" y="${y}" fill="${c}" font-size="${size}" text-anchor="${anchor}" letter-spacing="${ls}" font-family="'Songti SC','SimSun',serif">${t}</text>`;
const label = (x,y,t,c=GOLD,size=10.5,anchor="end")=>text(x,y,t,c,size,anchor);
const lead = (x1,y1,x2,y2)=>line(x1,y1,x2,y2,DIM,.7,.8)+circle(x1,y1,1.6,DIM,DIM,0);
const dimV = (x,y1,y2,t)=>{const a=line(x,y1,x-4,y1,GOLD,.7)+line(x,y2,x-4,y2,GOLD,.7)+line(x,y1,x,y2,GOLD,.7);return a+text(x+4,(y1+y2)/2+3,t,DIM,9.5,"start");};

/* ── 屋檐（起翘） ── */
function eave(cx, y, w, h, lift=7, c=GOLD, fillOp=.35){
  const hw=w/2, pts=`${cx-hw},${y-lift} ${cx-hw*.3},${y} ${cx},${y+h} ${cx+hw*.3},${y} ${cx+hw},${y-lift}`;
  let s = `<polygon points="${pts}" fill="${TILE}" fill-opacity="${fillOp}" stroke="${c}" stroke-width=".9"/>`;
  for(let i=-2;i<=2;i++){ // 瓦垄
    s+=line(cx+i*hw*.2, y-hlift2(i), cx+i*hw*.42, y+h*.62, DIM, .4, .5);
  }
  return s;
  function hlift2(i){return lift*.6}
}

/* ── 应县木塔 · 立面图 ── */
function pagodaElevation(){
  const W=300,H=430,cx=150,gy=396;let s=svgOpen(W,H);
  s+=line(40,gy,260,gy,GOLD,1);
  s+=path(`M${cx-52},${gy} L${cx-46},${gy-18} L${cx+46},${gy-18} L${cx+52},${gy} Z`,GOLD,"#17130e",.9);
  s+=line(cx-52,gy,cx+52,gy,GOLD,1.2);
  const storyW=[98,89,81,74,67], bodyH=[52,38,36,34,32], flare=[30,27,24,22,19], gap=[34,27,26,25,24];
  let y=gy-18;
  const topYs=[];
  for(let i=0;i<5;i++){
    const bw=storyW[i], bh=bodyH[i], fw=bw+flare[i]*2;
    y-=bh;
    // 平座栏杆（1-4层下）
    if(i>0){ s+=rect(cx-fw/2-4,y+2,fw+8,4,DIM); }
    // 柱身
    s+=rect(cx-bw/2,y,bw,bh,GOLD,"#14100b",.9);
    for(let k=1;k<4;k++) s+=line(cx-bw/2+bw*k/4,y,cx-bw/2+bw*k/4,y+bh,DIM,.5,.7);
    if(i===0){ // 一层板门与直棂窗
      s+=path(`M${cx-8},${y+bh} L${cx-8},${y+16} Q${cx},${y+6} ${cx+8},${y+16} L${cx+8},${y+bh}`,GOLD_HI,"#2a1d10",.8);
      for(const sx of [-1,1]) for(let k=0;k<3;k++) s+=line(cx+sx*bw*.3,y+4+k*3,cx+sx*bw*.3,y+bh-4,DIM,.5,.8);
    } else if(i===2){
      s+=rect(cx-10,y+8,20,bh-12,GOLD,"#241a10",.8); // 三层明窗
    }
    y-=2;
    // 斗拱带
    s+=rect(cx-fw/2-2,y,fw+4,4.5,DIM);
    y-=4.5;
    // 屋檐
    s+=eave(cx,y,fw,10+flare[i]*.32);
    y-= (10+flare[i]*.32);
    topYs.push(y);
    y-= gap[i];
  }
  // 塔刹
  const ty=topYs[4];
  s+=line(cx,ty-2,cx,ty-52,GOLD,1.4);
  for(let i=0;i<7;i++) s+=rect(cx-9+i*1.2, ty-12-i*5.6, 18-i*2.4, 2.6, GOLD_HI, "#3a2c15", .6);
  s+=circle(cx,ty-56,4.5,GOLD_HI,"#5a3a18",.7);
  s+=path(`M${cx},${ty-64} q4,6 0,10 q-4,-4 0,-10`,GOLD_HI,"#8a5a33",.7);
  // 尺寸标注
  s+=dimV(36,gy-18,ty-56,"67.31 m");
  s+=dimV(262,gy,gy-18,"台基");
  s+=text(cx,30,"应县木塔 · 立面",GOLD_HI,14);
  s+=text(cx,47,"佛宫寺释迦塔 · 辽清宁二年（1056）",DIM,9);
  s+="</svg>";return s;
}

/* ── 南禅寺大殿 · 立面图 ── */
function hallElevation(){
  const W=340,H=330,cx=170,gy=268;let s=svgOpen(W,H);
  s+=line(36,gy,304,gy,GOLD,1);
  // 台基
  s+=path(`M${cx-86},${gy} L${cx-80},${gy-16} L${cx+80},${gy-16} L${cx+86},${gy} Z`,GOLD,"#17130e",.9);
  // 踏道
  s+=path(`M${cx-14},${gy} L${cx-10},${gy-16} L${cx+10},${gy-16} L${cx+14},${gy} Z`,GOLD,"#1d1811",.8);
  const top=gy-16, colH=64, colXs=[cx-66,cx-22,cx+22,cx+66];
  // 阑额
  s+=rect(cx-70,top-colH-6,140,6,GOLD,"#241a10",.8);
  // 柱
  for(const x of colXs) s+=rect(x-3.5,top-colH,7,colH,GOLD,"#1a140d",.85);
  // 门窗
  s+=rect(cx-19,top-colH+14,12,colH-14,GOLD,"#241a10",.8);
  s+=rect(cx+7,top-colH+14,12,colH-14,GOLD,"#241a10",.8);
  s+=rect(cx-62,top-colH+16,16,colH-16,DIM);
  s+=rect(cx+46,top-colH+16,16,colH-16,DIM);
  for(let k=0;k<4;k++){ s+=line(cx-62+k*5,top-colH+16,cx-62+k*5,top-14,DIM,.5,.8); s+=line(cx+46+k*5,top-colH+16,cx+46+k*5,top-14,DIM,.5,.8); }
  // 斗拱
  for(const x of [...colXs,cx-44,cx+44]) s+=rect(x-6,top-colH-13,12,7,GOLD_HI,"#33260f",.7);
  // 歇山顶
  const ry=top-colH-13;
  s+=path(`M${cx-86},${ry-2} L${cx},${ry-30} L${cx+86},${ry-2} L${cx+70},${ry+6} L${cx},${ry-16} L${cx-70},${ry+6} Z`,GOLD,"#1c1a20",.95);
  s+=line(cx-86,ry-2,cx+86,ry-2,GOLD,.9);
  s+=path(`M${cx-70},${ry+6} L${cx},${ry-16} L${cx+70},${ry+6}`,GOLD_HI,"none",1.1); // 山花轮廓
  s+=path(`M${cx-70},${ry+6} Q${cx},${ry+14} ${cx+70},${ry+6}`,DIM,"none",.7); // 悬鱼线
  s+=path(`M${cx-4},${ry+2} L${cx},${ry+10} L${cx+4},${ry+2}`,GOLD_HI,"#3a2c15",.7); // 悬鱼
  // 正脊鸱尾
  for(const sx of [-1,1]){ const ex=cx+sx*34; s+=path(`M${ex},${ry-30} q${sx*10},-2 ${sx*8},-10 q${sx*2},6 ${-sx*4},7`,GOLD_HI,"none",1.3); }
  // 垂脊
  for(const sx of [-1,1]){ s+=line(cx,ry-30,cx+sx*86,ry-2,GOLD,.8); s+=line(cx,ry-30,cx+sx*70,ry+6,GOLD,.8); }
  // 博风板
  for(const sx of [-1,1]) s+=path(`M${cx+sx*70},${ry+6} l${sx*16},-8 l${sx*2},10 Z`,GOLD,"#241a10",.7);
  // 标注
  s+=dimV(30,gy,ry-30,"通高");
  s+=dimV(312,gy,gy-16,"台基");
  s+=lead(cx+86,ry-2,250,ry-24)+text(254,ry-27,"歇山顶",GOLD,10,"start");
  s+=lead(cx,ry-30,250,ry-44)+text(254,ry-47,"正脊 · 鸱尾",GOLD,10,"start");
  s+=lead(cx-66,top-colH+32,60,top-colH+32)+text(56,top-colH+35,"檐柱",GOLD,10,"end");
  s+=text(cx,24,"南禅寺大殿 · 立面",GOLD_HI,14);
  s+=text(cx,41,"唐建中三年（782）· 单檐歇山顶",DIM,9);
  s+="</svg>";return s;
}

/* ── 应县木塔 · 剖面（九层结构） ── */
function pagodaSection(){
  const W=320,H=440,cx=150,gy=400;let s=svgOpen(W,H);
  s+=line(44,gy,276,gy,GOLD,1);
  s+=rect(cx-40,gy-14,80,14,GOLD,"url(#hatch)",.9);
  const layers=[["明",52],["暗",20],["明",46],["暗",19],["明",42],["暗",18],["明",38],["暗",17],["明",34]];
  let y=gy-14; const ys=[];
  layers.forEach(([t,h],i)=>{
    y-=h;
    const w = t==="明"? 78-i*4 : 66-i*3;
    s+=rect(cx-w/2,y,w,h, t==="明"?GOLD:DIM, t==="明"?"#171209":"#100d08", .8);
    if(t==="明"){ for(let k=1;k<4;k++) s+=line(cx-w/2+w*k/4,y,cx-w/2+w*k/4,y+h,DIM,.45,.6); }
    else { s+=path(`M${cx-w/2},${y} L${cx+w/2},${y+h} M${cx+w/2},${y} L${cx-w/2},${y+h}`,GOLD,"none",.7); }
    ys.push([t,y,h]);
  });
  // 塔刹
  s+=line(cx,y,cx,y-40,GOLD,1.2);
  for(let i=0;i<6;i++) s+=rect(cx-7+i,y-8-i*5,14-i*2,2.2,GOLD_HI,"#3a2c15",.5);
  s+=circle(cx,y-44,3.5,GOLD_HI,"#5a3a18",.6);
  // 标注
  ys.forEach(([t,yy,h],i)=>{
    const nm = t==="明"? `第${"一二三四五"[i>>1]}明层` : `第${"一二三四"[i>>1]}暗层`;
    s+=lead(cx+(t==="明"?39:33),yy+h/2, 236, yy+h/2)+text(240,yy+h/2+3,nm,t==="明"?GOLD:DIM,9.5,"start");
  });
  s+=dimV(34,gy-14,y-44,"67.31 m");
  s+=text(cx,26,"应县木塔 · 纵剖面",GOLD_HI,14);
  s+=text(cx,43,"五明四暗 · 套筒式结构",DIM,9);
  s+="</svg>";return s;
}

/* ── 南禅寺大殿 · 纵剖面（梁架） ── */
function hallSection(){
  const W=340,H=330,cx=170,gy=262;let s=svgOpen(W,H);
  s+=line(36,gy,304,gy,GOLD,1);
  s+=rect(cx-78,gy-12,156,12,GOLD,"url(#hatch)",.9);
  const top=gy-12;
  // 檐柱（剖面见两缝）
  for(const x of [cx-64,cx+64]) s+=rect(x-4,top-58,8,58,GOLD,"#1a140d",.85);
  // 四椽栿
  s+=rect(cx-70,top-66,140,7,GOLD,"#241a10",.85);
  // 平梁
  s+=rect(cx-34,top-92,68,6,GOLD,"#241a10",.85);
  // 蜀柱
  for(const x of [cx-20,cx+20]) s+=rect(x-3,top-86,6,20,GOLD,"#2a1d10",.8);
  // 叉手
  s+=path(`M${cx-30},${top-92} L${cx},${top-116} L${cx+30},${top-92}`,GOLD_HI,"none",1.6);
  // 托脚
  s+=path(`M${cx-30},${top-92} L${cx-52},${top-66} M${cx+30},${top-92} L${cx+52},${top-66}`,DIM,"none",1);
  // 屋顶
  s+=path(`M${cx-84},${top-70} L${cx},${top-128} L${cx+84},${top-70} L${cx+64},${top-58} L${cx},${top-104} L${cx-64},${top-58} Z`,GOLD,"#1c1a20",.95);
  s+=line(cx-84,top-70,cx+84,top-70,GOLD,.8);
  s+=path(`M${cx-64},${top-58} L${cx},${top-104} L${cx+64},${top-58}`,GOLD_HI,"none",1);
  // 脊
  for(const sx of [-1,1]){ const ex=cx+sx*30; s+=path(`M${ex},${top-128} q${sx*9},-2 ${sx*7},-9 q${sx*2},5 ${-sx*3},6`,GOLD_HI,"none",1.2); }
  // 标注
  const L=(x1,y1,x2,y2,t,c=GOLD)=>s+=lead(x1,y1,x2,y2)+text(x2+4,y2+3,t,c,9.5,"start");
  L(cx+70,top-62,250,top-62,"四椽栿");
  L(cx+34,top-89,250,top-89,"平梁");
  L(cx+20,top-76,250,top-76,"蜀柱");
  L(cx+14,top-112,250,top-112,"叉手",GOLD_HI);
  L(cx-64,top-30,60,top-30,"檐柱");
  L(cx+84,top-70,250,top-132,"歇山顶");
  s+=dimV(30,gy,top-128,"通高");
  s+=text(cx,24,"南禅寺大殿 · 纵剖面",GOLD_HI,14);
  s+=text(cx,41,"唐式梁架 · 叉手蜀柱",DIM,9);
  s+="</svg>";return s;
}

/* ── 斗拱细部 ── */
function bracketDetail(kind){
  const W=300,H=210;let s=svgOpen(W,H);
  const cx=110, base=170;
  // 栌斗
  s+=path(`M${cx-16},${base} L${cx-12},${base-14} L${cx+12},${base-14} L${cx+16},${base} Z`,GOLD,"#241a10",.9);
  // 华拱（出跳）
  s+=rect(cx-26,base-22,52,8,GOLD,"#2a1d10",.85);
  // 交互斗 + 下昂
  s+=path(`M${cx-10},${base-22} L${cx-7},${base-32} L${cx+7},${base-32} L${cx+10},${base-22} Z`,GOLD,"#241a10",.85);
  s+=path(`M${cx-4},${base-30} L${cx+26},${base-52} L${cx+30},${base-46} L${cx+2},${base-26} Z`,GOLD_HI,"#33260f",.85);
  // 耍头
  s+=rect(cx-30,base-40,60,7,GOLD,"#241a10",.85);
  // 令拱 + 散斗
  s+=rect(cx-22,base-48,44,7,GOLD,"#2a1d10",.85);
  for(const x of [cx-16,cx+16]) s+=path(`M${x-5},${base-48} L${x-3},${base-56} L${x+3},${base-56} L${x+5},${base-48} Z`,GOLD,"#241a10",.8);
  // 檐方
  s+=rect(cx-44,base-62,88,6,GOLD,"#1d1811",.85);
  // 标注
  const L=(x1,y1,x2,y2,t)=>s+=lead(x1,y1,x2,y2)+text(x2+4,y2+3,t,GOLD,9.5,"start");
  L(cx+16,base-7,210,base-7,"栌斗");
  L(cx+26,base-18,210,base-18,"华拱");
  L(cx+30,base-48,210,base-48,"下昂",GOLD_HI);
  L(cx+30,base-36,210,base-36,"耍头");
  L(cx+22,base-52,210,base-52,"令拱");
  L(cx+44,base-59,210,base-59,"檐方");
  s+=text(cx,24,kind==="yx"?"应县木塔斗拱 · 五铺作":"南禅寺斗拱 · 五铺作",GOLD_HI,13);
  s+=text(cx,41,kind==="yx"?"全塔斗拱54种 · 出跳悬挑":"唐构斗拱雄大 · 出檐深远",DIM,9);
  s+="</svg>";return s;
}

/* ── 塔刹 / 鸱尾 细部 ── */
function finialDetail(kind){
  const W=260,H=230;let s=svgOpen(W,H);
  if(kind==="yx"){
    const cx=130,gy=190;
    s+=line(40,gy,220,gy,GOLD,1);
    s+=rect(cx-26,gy-16,52,16,GOLD,"#17130e",.9);
    s+=line(cx,gy-16,cx,gy-150,GOLD,1.6);
    for(let i=0;i<7;i++) s+=rect(cx-20+i*2.4,gy-30-i*15,40-i*4.8,5,GOLD_HI,"#3a2c15",.7);
    s+=circle(cx,gy-158,9,GOLD_HI,"#5a3a18",.8);
    s+=path(`M${cx},${gy-172} q7,9 0,16 q-7,-7 0,-16`,GOLD_HI,"#8a5a33",.8);
    s+=lead(cx+20,gy-60,190,gy-60)+text(194,gy-57,"相轮七重",GOLD,10,"start");
    s+=lead(cx,gy-150,190,gy-150)+text(194,gy-147,"宝珠",GOLD,10,"start");
    s+=text(cx,26,"应县木塔 · 塔刹",GOLD_HI,13);
    s+=text(cx,43,"铁刹杆 · 八链拉结",DIM,9);
  } else {
    const cx=130,gy=180;
    s+=line(40,gy,220,gy,GOLD,1.2);
    s+=rect(cx-52,gy-8,104,8,GOLD,"#1d1811",.9);
    for(const sx of [-1,1]){
      const ex=cx+sx*40;
      s+=path(`M${ex},${gy-8} q${sx*26},-4 ${sx*22},-34 q${sx*2},14 ${-sx*10},20 q${-sx*14},4 ${-sx*16},-6 Z`,GOLD,"#241a10",1);
      s+=path(`M${ex+sx*8},${gy-14} q${sx*12},-4 ${sx*10},-18`,GOLD_HI,"none",.9);
    }
    s+=lead(cx+62,gy-40,196,gy-40)+text(200,gy-37,"鸱尾（唐式）",GOLD,10,"start");
    s+=text(cx,26,"南禅寺 · 正脊鸱尾",GOLD_HI,13);
    s+=text(cx,43,"内卷素面 · 唐构孤例",DIM,9);
  }
  s+="</svg>";return s;
}

/* ── 小图标（卡片用） ── */
function swatch(id){
  if(id==="yx"){
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#12100c"/>
    <g stroke="#d9a441" stroke-width="1.4" fill="#1c1812">
      <polygon points="20,84 34,84 30,74 24,74"/><polygon points="16,74 38,74 34,64 20,64"/>
      <polygon points="13,64 41,64 37,54 17,54"/><polygon points="10,54 44,54 40,44 14,44"/>
      <polygon points="8,44 46,44 42,34 12,34"/>
    </g>
    <line x1="50" y1="34" x2="50" y2="12" stroke="#f0c979" stroke-width="1.6"/>
    <circle cx="50" cy="10" r="2.6" fill="#f0c979"/>
    <line x1="14" y1="88" x2="86" y2="88" stroke="#d9a441" stroke-width="1.2"/></svg>`;
  }
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#12100c"/>
    <g stroke="#d9a441" stroke-width="1.4" fill="#1c1812">
      <polygon points="14,62 50,40 86,62 74,70 50,54 26,70"/>
      <rect x="26" y="70" width="48" height="14"/>
    </g>
    <line x1="50" y1="40" x2="50" y2="30" stroke="#f0c979" stroke-width="1.4"/>
    <line x1="14" y1="88" x2="86" y2="88" stroke="#d9a441" stroke-width="1.2"/></svg>`;
}

window.ILLUS = { pagodaElevation, hallElevation, pagodaSection, hallSection, bracketDetail, finialDetail, swatch };
})();
