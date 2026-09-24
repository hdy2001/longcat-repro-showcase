/* ════════════════════════════════════════════════════════════
   古建数字图谱 · 全国地图视图
   SVG 渲染省界 + 古建名录 + 交互
   ════════════════════════════════════════════════════════════ */
(function(){
const SVGNS = "http://www.w3.org/2000/svg";
const VB_W = 1040, VB_H = 860;

function project(){
  // 依据全部省界点计算投影
  let minLng=180, maxlng=-180, minlat=90, maxlat=-90;
  window.CHINA_GEO.provinces.forEach(p=>{
    const polys = p.polys || p.lines || [];
    polys.forEach(rings=>{
      (Array.isArray(rings[0]) ? rings : [rings]).forEach(ring=>{
        ring.forEach(pt=>{ minlng=Math.min(minlng,pt[0]); maxlng=Math.max(maxlng,pt[0]); minlat=Math.min(minlat,pt[1]); maxlat=Math.max(maxlat,pt[1]); });
      });
    });
  });
  const k = 13;
  const ox = (VB_W-(maxlng-minlng)*k)/2, oy = (VB_H-(maxlat-minlat)*k)/2;
  return { X:lng=>(lng-minlng)*k+ox, Y:lat=>(maxlat-lat)*k+oy };
}

function ringPath(ring, P){
  return "M"+ring.map(pt=>P.X(pt[0]).toFixed(1)+","+P.Y(pt[1]).toFixed(1)).join("L")+"Z";
}

window.MapView = {
  hooks: null,
  selectedProv: null,

  init(hooks){
    this.hooks = hooks;
    const svg = document.getElementById("chinaSvg");
    const P = project();
    const frag = document.createDocumentFragment();
    const gProv = document.createElementNS(SVGNS,"g");
    const gMark = document.createElementNS(SVGNS,"g");
    const gText = document.createElementNS(SVGNS,"g");
    frag.appendChild(gProv); frag.appendChild(gMark); frag.appendChild(gText);
    svg.appendChild(frag);
    this.gProv = gProv; this.gMark = gMark; this.gText = gText;

    // ── 省界 ──
    window.CHINA_GEO.provinces.forEach(p=>{
      if(p.lines){ // 九段线
        p.lines.forEach(ln=>{
          const path = document.createElementNS(SVGNS,"path");
          path.setAttribute("d", ringPath(ln,P));
          path.setAttribute("class","prov dashline");
          gProv.appendChild(path);
        });
        return;
      }
      const path = document.createElementNS(SVGNS,"path");
      let d = "";
      p.polys.forEach(poly=>{ poly.forEach(ring=>{ d += ringPath(ring,P); }); });
      path.setAttribute("d", d);
      path.setAttribute("class","prov");
      path.setAttribute("fill-rule","evenodd");
      path.dataset.name = p.name;
      path.addEventListener("click", ()=>this._onProv(p.name));
      path.addEventListener("mouseenter", ()=>{ if(this.selectedProv!==p.name) path.classList.add("hl"); });
      path.addEventListener("mouseleave", ()=>path.classList.remove("hl"));
      gProv.appendChild(path);
      // 名称
      const big = p.polys[0][0];
      if(big && big.length>2){
        let cx=0, cy=0, n=0;
        big.forEach(pt=>{ cx+=P.X(pt[0]); cy+=P.Y(pt[1]); n++; });
        cx/=n; cy/=n;
        const t = document.createElementNS(SVGNS,"text");
        t.setAttribute("x",cx); t.setAttribute("y",cy+4);
        t.setAttribute("class","prov-name"+(p.name==="山西省"?" big":""));
        t.textContent = p.name.replace("省","").replace("市","").replace("壮族自治区","").replace("回族自治区","").replace("维吾尔自治区","").replace("自治区","").replace("特别行政区","");
        gText.appendChild(t);
      }
    });

    // ── 建筑标记 ──
    window.DATA.buildings.forEach(b=>{
      const g = document.createElementNS(SVGNS,"g");
      g.setAttribute("class","marker"+(b.star?" feat":""));
      const x=P.X(b.lng), y=P.Y(b.lat);
      if(b.star){
        const halo = document.createElementNS(SVGNS,"circle");
        halo.setAttribute("cx",x); halo.setAttribute("cy",y); halo.setAttribute("r",7);
        halo.setAttribute("class","halo pulse");
        const core = document.createElementNS(SVGNS,"circle");
        core.setAttribute("cx",x); core.setAttribute("cy",y); core.setAttribute("r",4.2);
        core.setAttribute("class","core");
        const t = document.createElementNS(SVGNS,"text");
        t.setAttribute("x",x); t.setAttribute("y",y-12);
        t.setAttribute("class","mk-label");
        t.textContent = b.name.replace("五台山","").replace("大殿","");
        g.appendChild(halo); g.appendChild(core); g.appendChild(t);
      } else {
        const core = document.createElementNS(SVGNS,"circle");
        core.setAttribute("cx",x); core.setAttribute("cy",y); core.setAttribute("r",2.6);
        core.setAttribute("class","core");
        g.appendChild(core);
        const title = document.createElementNS(SVGNS,"title");
        title.textContent = `${b.name} · ${b.yr}`;
        g.appendChild(title);
      }
      g.addEventListener("click", ev=>{
        ev.stopPropagation();
        if(b.star) this.hooks.goBuilding(b.id);
        else this._openModal(b);
      });
      g.addEventListener("mouseenter", ()=>g.classList.add("hl"));
      g.addEventListener("mouseleave", ()=>g.classList.remove("hl"));
      gMark.appendChild(g);
    });

    this._renderSide();
  },

  _onProv(name){
    this.selectedProv = name;
    this.gProv.querySelectorAll(".prov").forEach(p=>{
      p.classList.toggle("active", p.dataset.name===name);
    });
    if(name==="山西省"){ this.hooks.goProvince(); return; }
    this._renderList(name);
    this.hooks.toast(`已定位 · ${name}（点击名录查看详情）`);
  },

  _renderSide(){
    // 重点卡片
    const feat = document.getElementById("featCards");
    feat.innerHTML = "";
    ["yx","nc"].forEach(id=>{
      const b = window.DATA.buildings.find(x=>x.id===id);
      const card = document.createElement("div");
      card.className = "feat-card";
      card.innerHTML = `
        <div class="feat-swatch">${window.ILLUS.swatch(id)}</div>
        <div><h3>${b.name}</h3><p>${b.yr} · ${b.type}</p></div>
        <span class="go">进入拆解 →</span>`;
      card.addEventListener("click", ()=>this.hooks.goBuilding(id));
      feat.appendChild(card);
    });
    // 省份 chips
    const provs = [...new Set(window.DATA.buildings.map(b=>b.prov))];
    const chips = document.getElementById("provChips");
    chips.innerHTML = "";
    provs.forEach(pv=>{
      const c = document.createElement("button");
      c.className = "prov-chip"; c.textContent = pv.replace("省","").replace("市","").replace("壮族自治区","").replace("回族自治区","").replace("维吾尔自治区","").replace("自治区","").replace("特别行政区","");
      c.addEventListener("click", ()=>{
        chips.querySelectorAll(".prov-chip").forEach(x=>x.classList.remove("on"));
        c.classList.add("on");
        this._onProv(pv);
      });
      chips.appendChild(c);
    });
    this._renderList(null);
  },

  _renderList(prov){
    const list = document.getElementById("buildList");
    const pn = document.getElementById("provName");
    pn.textContent = prov ? `（${prov}）` : "（点击省份查看）";
    list.innerHTML = "";
    const items = window.DATA.buildings.filter(b=>!prov || b.prov===prov);
    if(!items.length){
      list.innerHTML = `<div class="empty-tip">该省名录整理中<br>本期重点：山西 · 应县木塔 / 南禅寺大殿</div>`;
      return;
    }
    items.forEach(b=>{
      const it = document.createElement("div");
      it.className = "build-item";
      it.innerHTML = `
        ${b.star?'<span class="star">★</span>':''}
        <span class="nm">${b.name}</span>
        <span class="tp">${b.type}</span>
        <span class="yr">${b.yr}</span>`;
      it.addEventListener("click", ()=>{
        if(b.star) this.hooks.goBuilding(b.id);
        else this._openModal(b);
      });
      list.appendChild(it);
    });
  },

  _openModal(b){
    const mask = document.getElementById("modalMask");
    const body = document.getElementById("modalBody");
    body.innerHTML = `
      <h3>${b.name}</h3>
      <div class="yr">${b.yr} · ${b.prov} · ${b.type}</div>
      <p>${b.desc}</p>
      <div class="acts">
        <button class="btn" id="modalGo">查看资料</button>
        <button class="btn gold" id="modalClose2">关闭</button>
      </div>
      <p style="margin-top:10px;font-size:11px;color:var(--ink-faint)">该建筑三维拆解模型正在建设中，本期可拆解模型为「应县木塔」与「南禅寺大殿」。</p>`;
    mask.hidden = false;
    document.getElementById("modalGo").addEventListener("click", ()=>{ mask.hidden=true; this.hooks.toast("详细档案整理中 · 敬请期待"); });
    document.getElementById("modalClose2").addEventListener("click", ()=>{ mask.hidden=true; });
  }
};
})();
