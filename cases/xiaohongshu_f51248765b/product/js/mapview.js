/* ========== 视图一：全国地图 ========== */

const MapView = {
  svg: null,
  tooltip: null,
  toastTimer: null,

  init() {
    this.svg = document.getElementById("china-map");
    this.tooltip = document.getElementById("map-tooltip");
    this.buildMap();
    this.bindEvents();
  },

  buildMap() {
    const NS = "http://www.w3.org/2000/svg";
    const paths = GeoUtil.buildProvincePaths(CHINA_GEO);
    const bounds = GeoUtil.projectedBounds();
    const pad = 26;
    this.svg.setAttribute("viewBox",
      (bounds.x - pad) + " " + (bounds.y - pad) + " " + (bounds.w + pad * 2) + " " + (bounds.h + pad * 2 + 90));

    /* 省份 */
    for (const p of paths) {
      const el = document.createElementNS(NS, "path");
      el.setAttribute("d", p.d);
      el.setAttribute("class", "province-path");
      el.dataset.adcode = p.adcode;
      el.dataset.name = p.name;
      if (String(p.adcode) === "140000") el.classList.add("hot");
      this.svg.appendChild(el);
    }

    /* 南海诸岛插图 */
    this.drawSouthSeaInset(NS);

    /* 古建点位 */
    for (const pt of MAP_POINTS) {
      this.svg.appendChild(this.createPoint(NS, pt));
    }
  },

  drawSouthSeaInset(NS) {
    const g = document.createElementNS(NS, "g");
    const x0 = 856, y0 = 640, w = 128, h = 150;
    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("x", x0); rect.setAttribute("y", y0);
    rect.setAttribute("width", w); rect.setAttribute("height", h);
    rect.setAttribute("fill", "none");
    rect.setAttribute("stroke", "#33333f");
    rect.setAttribute("stroke-width", "1");
    g.appendChild(rect);
    const dots = [[880, 690], [912, 726], [898, 752], [936, 700], [952, 742]];
    for (const [dx, dy] of dots) {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", dx); c.setAttribute("cy", dy);
      c.setAttribute("r", "2"); c.setAttribute("fill", "#6f6a5c");
      g.appendChild(c);
    }
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", x0 + w / 2); t.setAttribute("y", y0 + h - 12);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("font-size", "11");
    t.setAttribute("fill", "#9a937f");
    t.setAttribute("letter-spacing", "2");
    t.textContent = "南海诸岛";
    g.appendChild(t);
    this.svg.appendChild(g);
  },

  createPoint(NS, pt) {
    const [x, y] = GeoUtil.project(pt.lon, pt.lat);
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "map-point" + (pt.featured ? " featured" : ""));
    g.dataset.name = pt.name;

    const halo = document.createElementNS(NS, "circle");
    halo.setAttribute("cx", x); halo.setAttribute("cy", y);
    halo.setAttribute("r", "6");
    halo.setAttribute("class", "halo");
    g.appendChild(halo);

    const core = document.createElementNS(NS, "circle");
    core.setAttribute("cx", x); core.setAttribute("cy", y);
    core.setAttribute("r", pt.featured ? "5.5" : "4");
    core.setAttribute("class", "core");
    g.appendChild(core);

    const label = document.createElementNS(NS, "text");
    label.setAttribute("class", "pt-label");
    label.textContent = pt.name;
    const dir = pt.label || "right";
    if (dir === "right") { label.setAttribute("x", x + 10); label.setAttribute("y", y + 4); label.setAttribute("text-anchor", "start"); }
    else if (dir === "left") { label.setAttribute("x", x - 10); label.setAttribute("y", y + 4); label.setAttribute("text-anchor", "end"); }
    else if (dir === "top") { label.setAttribute("x", x); label.setAttribute("y", y - 10); label.setAttribute("text-anchor", "middle"); }
    else { label.setAttribute("x", x); label.setAttribute("y", y + 20); label.setAttribute("text-anchor", "middle"); }
    g.appendChild(label);

    g.addEventListener("mouseenter", (e) => this.showTooltip(e, pt));
    g.addEventListener("mousemove", (e) => this.moveTooltip(e));
    g.addEventListener("mouseleave", () => this.hideTooltip());
    g.addEventListener("click", () => {
      if (pt.featured) App.enterProvince();
      else this.toast("「" + pt.name + "」数字档案筹备中");
    });
    return g;
  },

  bindEvents() {
    this.svg.addEventListener("click", (e) => {
      const path = e.target.closest(".province-path");
      if (!path) return;
      if (String(path.dataset.adcode) === "140000") {
        App.enterProvince();
      } else {
        this.toast("「" + path.dataset.name + "」三维档案筹备中");
      }
    });
  },

  showTooltip(e, pt) {
    const cta = pt.featured ? "点击进入山西三维视图" : "数字档案筹备中";
    this.tooltip.innerHTML =
      '<div class="tt-name">' + pt.name + "</div>" +
      '<div class="tt-sub">' + pt.sub + "</div>" +
      '<div class="tt-cta">' + cta + "</div>";
    this.tooltip.hidden = false;
    this.moveTooltip(e);
  },

  moveTooltip(e) {
    const wrap = this.svg.parentElement.getBoundingClientRect();
    let x = e.clientX - wrap.left + 16;
    let y = e.clientY - wrap.top + 14;
    const tw = this.tooltip.offsetWidth, th = this.tooltip.offsetHeight;
    if (x + tw > wrap.width - 8) x = e.clientX - wrap.left - tw - 12;
    if (y + th > wrap.height - 8) y = e.clientY - wrap.top - th - 10;
    this.tooltip.style.left = x + "px";
    this.tooltip.style.top = y + "px";
  },

  hideTooltip() {
    this.tooltip.hidden = true;
  },

  toast(msg) {
    let el = document.getElementById("map-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "map-toast";
      el.style.cssText = "position:absolute;left:50%;bottom:64px;transform:translateX(-50%);" +
        "background:rgba(18,18,26,.95);border:1px solid #8a6f45;color:#e8c88f;" +
        "padding:8px 20px;font-size:13px;letter-spacing:2px;border-radius:3px;" +
        "z-index:50;transition:opacity .3s;pointer-events:none;";
      document.getElementById("view-map").appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.style.opacity = "0"; }, 1800);
  }
};
