/* ════════════════════════════════════════════════════════════
   古建数字图谱 · 建筑详情页
   结构模型 / 影像 / 全景VR / 特色结构 / 历史与传说
   ════════════════════════════════════════════════════════════ */
import { ModelView } from "./model-view.js";
import { PanoView } from "./pano.js";

/* ── 特色结构互动演示 ── */
const DEMOS = {
  brackets(kind){
    const title = kind==="yx" ? "应县木塔 · 五铺作斗拱" : "南禅寺 · 五铺作双杪";
    return { html: `
    <svg viewBox="0 0 300 110" xmlns="http://www.w3.org/2000/svg">
      <style>.bp{opacity:0;transform:translateY(-7px);transition:.35s}.bp.on{opacity:1;transform:none}.cap{opacity:0;transition:.4s}.cap.on{opacity:1}</style>
      <rect width="300" height="110" fill="#0c0a08"/>
      <g class="bp" id="b1"><path d="M128 96 L134 84 L166 84 L172 96 Z" fill="#241a10" stroke="#d9a441"/></g>
      <g class="bp" id="b2"><rect x="112" y="76" width="76" height="8" fill="#2a1d10" stroke="#d9a441"/></g>
      <g class="bp" id="b3"><path d="M140 76 L168 44 L176 50 L148 76 Z" fill="#33260f" stroke="#f0c979"/></g>
      <g class="bp" id="b4"><rect x="104" y="68" width="92" height="7" fill="#241a10" stroke="#d9a441"/></g>
      <g class="bp" id="b5"><rect x="120" y="60" width="60" height="8" fill="#2a1d10" stroke="#d9a441"/>
        <rect x="128" y="50" width="9" height="10" fill="#241a10" stroke="#d9a441"/><rect x="163" y="50" width="9" height="10" fill="#241a10" stroke="#d9a441"/></g>
      <g class="bp" id="b6"><rect x="96" y="42" width="108" height="6" fill="#1d1811" stroke="#d9a441"/></g>
      <text class="cap" x="150" y="18" fill="#f0c979" font-size="10" text-anchor="middle" letter-spacing="2">五铺作 · 双杪出跳</text>
      <text x="150" y="106" fill="#6d6455" font-size="8.5" text-anchor="middle">栌斗 → 华拱 → 下昂 → 耍头 → 令拱 → 檐方</text>
    </svg><span class="t-hint">${"点击逐件叠加"}</span>`,
    wire(wrap){
      const steps=["b1","b2","b3","b4","b5","b6"]; let i=0;
      wrap.addEventListener("click", ()=>{
        if(i<steps.length){ const el=wrap.querySelector("#"+steps[i++]); el.classList.add("on");
          if(i===steps.length) wrap.querySelector(".cap").classList.add("on");
        } else { wrap.querySelectorAll(".bp").forEach(e=>e.classList.remove("on")); wrap.querySelector(".cap").classList.remove("on"); i=0; }
      });
    } };
  },

  layers(){
    const seg=[]; const names=["一","二","三","四","五"];
    for(let i=0;i<9;i++){
      const ming = i%2===0;
      seg.push(`<div class="ls ${ming?"m":"a"}" data-m="${ming?1:0}" style="animation-delay:${i*.05}s">
        <span>${ming? names[i>>1]+"明层" : "暗层"+(i>>1)}</span></div>`);
    }
    return { html: `
    <svg viewBox="0 0 300 110" xmlns="http://www.w3.org/2000/svg">
      <style>.ls{height:9px;margin:2px 40px;border:1px solid #3a3226;display:flex;align-items:center;justify-content:center;transition:.3s;border-radius:2px}
      .ls span{font-size:7px;color:#8d8172;letter-spacing:1px;transition:.3s}
      .ls.m.on{background:#4a381e;border-color:#d9a441}.ls.m.on span{color:#f0c979}
      .ls.a.on{background:#4a1518;border-color:#e5484d}.ls.a.on span{color:#ffb9bc}
      .cap{opacity:0;transition:.4s}.cap.on{opacity:1}</style>
      <rect width="300" height="110" fill="#0c0a08"/>
      ${seg.join("")}
      <text class="cap" x="150" y="16" fill="#d9a441" font-size="9.5" text-anchor="middle" letter-spacing="1">明层礼佛 · 暗层箍束 · 五明四暗</text>
    </svg><span class="t-hint">点击切换高亮</span>`,
    wire(wrap){
      let mode=0; const els=[...wrap.querySelectorAll(".ls")];
      const cap=wrap.querySelector(".cap");
      wrap.addEventListener("click", ()=>{
        mode=(mode+1)%3;
        els.forEach(el=>el.classList.toggle("on", (mode===1&&el.dataset.m==="1")||(mode===2&&el.dataset.m==="0")));
        cap.textContent = mode===1?"明层 · 礼佛空间":mode===2?"暗层 · 斜撑箍束":"五明四暗 · 套筒结构";
        cap.classList.add("on");
      });
    } };
  },

  tilt(kind){
    const isYx = kind==="yx";
    return { html: `
    <svg viewBox="0 0 300 110" xmlns="http://www.w3.org/2000/svg">
      <style>.col{transition:transform .6s;transform-origin:bottom center}.tilted .c1{transform:rotate(1.4deg)}.tilted .c4{transform:rotate(-1.4deg)}
      .tilted .c2{transform:rotate(.9deg);transform:scaleY(1.05)}.tilted .c3{transform:rotate(-.9deg);transform:scaleY(1.05)}
      .evA{transition:.5s}.evB{opacity:0;transition:.5s}.tilted .evA{opacity:0}.tilted .evB{opacity:1}
      .cap{opacity:0;transition:.4s}.cap.on{opacity:1}</style>
      <rect width="300" height="110" fill="#0c0a08"/>
      <g>
        <rect class="col c1" x="52" y="46" width="6" height="52" fill="#1a140d" stroke="#d9a441"/>
        <rect class="col c2" x="104" y="44" width="6" height="54" fill="#1a140d" stroke="#d9a441"/>
        <rect class="col c3" x="190" y="44" width="6" height="54" fill="#1a140d" stroke="#d9a441"/>
        <rect class="col c4" x="242" y="46" width="6" height="52" fill="#1a140d" stroke="#d9a441"/>
        <path class="evA" d="M44 48 Q150 40 256 48" stroke="#d9a441" fill="none" stroke-width="1.6"/>
        <path class="evB" d="M40 40 Q150 30 260 40" stroke="#f0c979" fill="none" stroke-width="1.6"/>
      </g>
      <text class="cap" x="150" y="14" fill="#d9a441" font-size="9.5" text-anchor="middle" letter-spacing="1">侧脚 · 柱头内倾 ｜ 升起 · 角柱加高</text>
    </svg><span class="t-hint">点击开合</span>`,
    wire(wrap){
      const cap=wrap.querySelector(".cap"); let on=false;
      wrap.addEventListener("click", ()=>{ on=!on; wrap.querySelector("svg").classList.toggle("tilted",on); cap.classList.add("on"); });
    } };
  },

  shake(){
    return { html: `
    <svg viewBox="0 0 300 110" xmlns="http://www.w3.org/2000/svg">
      <style>.pg{transform-origin:150px 96px}.shaking .pg{animation:sw 2.4s ease-out}
      @keyframes sw{0%{transform:rotate(0)}15%{transform:rotate(1.6deg)}35%{transform:rotate(-1.3deg)}55%{transform:rotate(.9deg)}75%{transform:rotate(-.5deg)}100%{transform:rotate(0)}}
      .cap{opacity:0;transition:.4s}.cap.on{opacity:1}</style>
      <rect width="300" height="110" fill="#0c0a08"/>
      <g class="pg">
        <polygon points="138,96 162,96 158,88 142,88" fill="#17130e" stroke="#d9a441"/>
        <polygon points="132,88 168,88 162,76 138,76" fill="#1c1a20" stroke="#d9a441"/>
        <polygon points="127,76 173,76 167,64 133,64" fill="#1c1a20" stroke="#d9a441"/>
        <polygon points="122,64 178,64 172,52 128,52" fill="#1c1a20" stroke="#d9a441"/>
        <polygon points="117,52 183,52 177,40 123,40" fill="#1c1a20" stroke="#d9a441"/>
        <line x1="150" y1="40" x2="150" y2="24" stroke="#f0c979" stroke-width="1.4"/>
        <circle cx="150" cy="22" r="2.4" fill="#f0c979"/>
      </g>
      <text class="cap" x="150" y="14" fill="#d9a441" font-size="9.5" text-anchor="middle" letter-spacing="1">柔性卸力 · 摇晃自复</text>
    </svg><span class="t-hint">点击模拟地震</span>`,
    wire(wrap){
      const cap=wrap.querySelector(".cap");
      wrap.addEventListener("click", ()=>{
        const svg=wrap.querySelector("svg"); svg.classList.add("shaking"); cap.classList.add("on");
        setTimeout(()=>svg.classList.remove("shaking"),2400);
      });
    } };
  },

  finial(kind){
    if(kind==="yx"){
      return { html: `
      <svg viewBox="0 0 300 110" xmlns="http://www.w3.org/2000/svg">
        <style>.fs{transition:.5s;filter:none}.lit .fs{filter:drop-shadow(0 0 6px #f0c979);fill:#8a5f22}
        .lit .fsl{stroke:#f0c979}.cap{opacity:0;transition:.4s}.cap.on{opacity:1}</style>
        <rect width="300" height="110" fill="#0c0a08"/>
        <polygon points="110,96 190,96 184,76 116,76" fill="#1c1a20" stroke="#d9a441"/>
        <polygon points="104,76 196,76 190,58 110,58" fill="#1c1a20" stroke="#d9a441"/>
        <g class="fs" fill="#3a2c15" stroke="#8a6a30">
          <line class="fsl" x1="150" y1="58" x2="150" y2="26" stroke="#8a6a30" stroke-width="1.4"/>
          <rect x="142" y="50" width="16" height="3"/><rect x="139" y="42" width="22" height="3"/>
          <rect x="136" y="34" width="28" height="3"/><rect x="133" y="26" width="34" height="3"/>
        </g>
        <circle class="fs" cx="150" cy="20" r="4"/>
        <text class="cap" x="150" y="14" fill="#f0c979" font-size="9.5" text-anchor="middle" letter-spacing="1">塔刹 · 相轮宝珠 · 八链拉结</text>
      </svg><span class="t-hint">点击点亮塔刹</span>`,
      wire(wrap){ const cap=wrap.querySelector(".cap");
        wrap.addEventListener("click",()=>{wrap.querySelector("svg").classList.add("lit");cap.classList.add("on");}); } };
    }
    return { html: `
    <svg viewBox="0 0 300 110" xmlns="http://www.w3.org/2000/svg">
      <style>.cw{transition:.5s;filter:none;fill:#241a10}.lit .cw{filter:drop-shadow(0 0 6px #f0c979);fill:#33260f}
      .lit .cwl{stroke:#f0c979}.cap{opacity:0;transition:.4s}.cap.on{opacity:1}</style>
      <rect width="300" height="110" fill="#0c0a08"/>
      <rect x="96" y="88" width="108" height="6" fill="#1d1811" stroke="#8a6a30"/>
      <polygon points="110,88 190,88 184,68 116,68" fill="#1c1a20" stroke="#8a6a30"/>
      <line class="cwl" x1="110" y1="68" x2="150" y2="52" stroke="#8a6a30" stroke-width="1.2"/>
      <line class="cwl" x1="190" y1="68" x2="150" y2="52" stroke="#8a6a30" stroke-width="1.2"/>
      <g class="cw" stroke="#8a6a30">
        <path d="M138 52 q-12 -2 -10 -12 q8 4 12 10 Z"/>
        <path d="M162 52 q12 -2 10 -12 q-8 4 -12 10 Z"/>
      </g>
      <text class="cap" x="150" y="14" fill="#f0c979" font-size="9.5" text-anchor="middle" letter-spacing="1">鸱尾 · 唐式脊饰孤例</text>
    </svg><span class="t-hint">点击点亮鸱尾</span>`,
    wire(wrap){ const cap=wrap.querySelector(".cap");
      wrap.addEventListener("click",()=>{wrap.querySelector("svg").classList.add("lit");cap.classList.add("on");}); } };
  },

  roof(){
    return { html: `
    <svg viewBox="0 0 300 110" xmlns="http://www.w3.org/2000/svg">
      <style>.rf{transition:.4s;stroke:#6d6455}.litA .rfA{stroke:#d9a441;stroke-width:2}.litA .rfB{opacity:.25}
      .litB .rfB{stroke:#d9a441;stroke-width:2}.litB .rfA{opacity:.25}
      .shan{opacity:0;transition:.4s}.litB .shan{opacity:1}.cap{opacity:0;transition:.4s}.cap.on{opacity:1}</style>
      <rect width="300" height="110" fill="#0c0a08"/>
      <g class="rf rfA"><polygon points="40,88 90,52 140,88" fill="#1c1a20"/><line x1="40" y1="88" x2="140" y2="88"/></g>
      <text x="90" y="102" fill="#8d8172" font-size="9" text-anchor="middle">庑殿顶</text>
      <g class="rf rfB"><polygon points="180,88 215,60 250,88 238,94 215,72 192,94" fill="#1c1a20"/>
        <polygon class="shan" points="215,60 238,94 192,94" fill="#4a1518" stroke="#e5484d"/>
        <line x1="180" y1="88" x2="250" y2="88"/></g>
      <text x="215" y="102" fill="#8d8172" font-size="9" text-anchor="middle">歇山顶</text>
      <text class="cap" x="150" y="14" fill="#d9a441" font-size="9.5" text-anchor="middle" letter-spacing="1">庑殿 vs 歇山 · 山花所在</text>
    </svg><span class="t-hint">点击切换对比</span>`,
    wire(wrap){ const cap=wrap.querySelector(".cap"); let a=true;
      wrap.addEventListener("click",()=>{ a=!a; const svg=wrap.querySelector("svg");
        svg.classList.toggle("litA",a); svg.classList.toggle("litB",!a); cap.classList.add("on"); }); } };
  },

  truss(){
    return { html: `
    <svg viewBox="0 0 300 110" xmlns="http://www.w3.org/2000/svg">
      <style>.tr{transition:.4s;stroke:#6d6455}.lit .trG{stroke:#d9a441;stroke-width:2}.lit .trR{stroke:#e5484d;stroke-width:2}
      .cap{opacity:0;transition:.4s}.cap.on{opacity:1}</style>
      <rect width="300" height="110" fill="#0c0a08"/>
      <g class="tr">
        <rect x="70" y="72" width="160" height="8" fill="#1a140d" class="trG"/>
        <rect x="120" y="50" width="60" height="7" fill="#1a140d" class="trG"/>
        <rect x="132" y="57" width="8" height="15" fill="#2a1d10" class="trR"/>
        <rect x="160" y="57" width="8" height="15" fill="#2a1d10" class="trR"/>
        <line x1="120" y1="50" x2="150" y2="30" class="trR" stroke-width="2.4"/>
        <line x1="180" y1="50" x2="150" y2="30" class="trR" stroke-width="2.4"/>
        <line x1="120" y1="50" x2="100" y2="72" class="tr" stroke-width="1.6"/>
        <line x1="180" y1="50" x2="200" y2="72" class="tr" stroke-width="1.6"/>
      </g>
      <text class="cap" x="150" y="14" fill="#d9a441" font-size="9.5" text-anchor="middle" letter-spacing="1">叉手 · 蜀柱 · 唐式梁架</text>
    </svg><span class="t-hint">点击高亮梁架</span>`,
    wire(wrap){ const cap=wrap.querySelector(".cap");
      wrap.addEventListener("click",()=>{wrap.querySelector("svg").classList.add("lit");cap.classList.add("on");}); } };
  },
};

/* ── 视图主体 ── */
window.BuildingView = {
  id: null,
  model: null,
  pano: null,
  _inited: { model:false, pano:false },

  hooks: null,
  init(hooks){ this.hooks = hooks; },

  render(id){
    this.id = id;
    const D = window.BUILDING_DETAIL[id];
    // 头部
    document.getElementById("bldHead").innerHTML = `
      <div class="mini">${window.ILLUS.swatch(id)}</div>
      <div>
        <h2>${D.name}</h2>
        <div class="sub">${D.short} ｜ ${D.prov} ｜ ${D.dynasty}</div>
      </div>
      <div class="tags">
        <span class="tag">${D.latin}</span>
        <span class="tag">${D.height}</span>
        <span class="tag red">${D.level}</span>
      </div>`;
    // tabs
    const tabs = document.getElementById("bldTabs");
    tabs.querySelectorAll("button").forEach(b=>{
      b.classList.toggle("on", b.dataset.tab==="model");
      b.onclick = ()=>{
        tabs.querySelectorAll("button").forEach(x=>x.classList.toggle("on", x===b));
        document.querySelectorAll(".bld-tab").forEach(s=>s.classList.toggle("on", s.id==="tab-"+b.dataset.tab));
        this._ensure(b.dataset.tab);
      };
    });
    document.getElementById("tab-model").classList.add("on");
    ["images","pano","struct","history"].forEach(t=>{
      const el=document.getElementById("tab-"+t); if(el) el.classList.remove("on");
    });
    this._ensure("model");
  },

  _ensure(tab){
    if(tab==="model" && !this._inited.model){
      this._inited.model = true;
      this.model = new ModelView(
        document.getElementById("modelStage"),
        document.getElementById("modelCanvas"),
        this.id,
        { toast: m=>this.hooks.toast(m) }
      );
    }
    if(tab==="pano" && !this._inited.pano){
      this._inited.pano = true;
      this.pano = new PanoView(
        document.getElementById("panoStage"),
        document.getElementById("panoCanvas"),
        this.id
      );
    }
    if(tab==="images") this._renderImages();
    if(tab==="struct") this._renderStruct();
    if(tab==="history") this._renderHistory();
  },

  _renderImages(){
    const gal = document.getElementById("gallery");
    if(gal.dataset.done) return; gal.dataset.done = "1";
    const items = this.id==="yx" ? [
      { src:"assets/img_00.jpg", cap:"概念渲染 · 素材图", desc:"木塔夜色中的分层解构意象（用户提供素材）" },
      { svg: window.ILLUS.pagodaElevation(), cap:"立面测绘图", desc:"五层六檐 · 八角重楼 · 通高 67.31 m" },
      { svg: window.ILLUS.pagodaSection(), cap:"纵剖面 · 九层结构", desc:"五明四暗 · 套筒式刚性箍层" },
      { svg: window.ILLUS.bracketDetail("yx"), cap:"斗拱细部", desc:"五铺作 · 全塔斗拱 54 种 480 朵" },
      { svg: window.ILLUS.finialDetail("yx"), cap:"塔刹细部", desc:"刹杆 · 七重相轮 · 宝珠火焰" },
    ] : [
      { src:"assets/img_00.jpg", cap:"概念渲染 · 素材图", desc:"唐代殿堂夜色意象（用户提供素材）" },
      { svg: window.ILLUS.hallElevation(), cap:"立面测绘图", desc:"单檐歇山顶 · 面阔进深各三间" },
      { svg: window.ILLUS.hallSection(), cap:"纵剖面 · 唐式梁架", desc:"四椽栿 · 平梁 · 叉手 · 蜀柱" },
      { svg: window.ILLUS.bracketDetail("nc"), cap:"斗拱细部", desc:"五铺作双杪 · 唐风雄大" },
      { svg: window.ILLUS.finialDetail("nc"), cap:"鸱尾细部", desc:"正脊鸱尾 · 内卷素面 · 唐式孤例" },
    ];
    items.forEach(it=>{
      const div = document.createElement("div");
      div.className = "gal-item";
      div.innerHTML = `<div class="pic">${it.svg ? it.svg : `<img src="${it.src}" alt="${it.cap}">`}</div>
        <div class="cap"><h4>${it.cap}</h4><p>${it.desc}</p></div>`;
      gal.appendChild(div);
    });
  },

  _renderStruct(){
    const grid = document.getElementById("structGrid");
    if(grid.dataset.done) return; grid.dataset.done = "1";
    const D = window.BUILDING_DETAIL[this.id];
    D.struct.forEach(s=>{
      const demo = DEMOS[s.demo](this.id);
      const card = document.createElement("div");
      card.className = "struct-card"; card.dataset.no = s.no;
      card.innerHTML = `
        <h3>${s.title}</h3>
        <div class="en">${s.en}</div>
        <p>${s.desc}</p>
        <div class="demo-wrap">${demo.html}</div>`;
      grid.appendChild(card);
      demo.wire(card.querySelector(".demo-wrap"));
    });
  },

  _renderHistory(){
    const wrap = document.getElementById("historyWrap");
    if(wrap.dataset.done) return; wrap.dataset.done = "1";
    const D = window.BUILDING_DETAIL[this.id];
    wrap.innerHTML = `
      <div class="hist-main">
        <div class="hist-block">
          <h3>建筑沿革</h3>
          ${D.history.map(p=>`<p>${p}</p>`).join("")}
        </div>
        <div class="hist-block">
          <h3>大事年表</h3>
          <div class="timeline">
            ${D.timeline.map(t=>`
              <div class="tl-item ${t.major?"major":""}">
                <span class="tl-dot"></span>
                <div><div class="tl-yr">${t.yr} 年</div><div class="tl-tx">${t.tx}</div></div>
              </div>`).join("")}
          </div>
        </div>
      </div>
      <div class="hist-side">
        <div class="legend-block">
          <h3>传说与典故</h3>
          ${D.legend.map(p=>`<p>${p}</p>`).join("")}
        </div>
        <div class="legend-block">
          <h3>学者之言</h3>
          <p style="color:var(--ink-faint);font-size:11.5px">${D.quote}</p>
        </div>
      </div>`;
  },

  dispose(){
    if(this.model){ this.model.dispose(); this.model=null; }
    if(this.pano){ this.pano.dispose(); this.pano=null; }
    this._inited = { model:false, pano:false };
  }
};
