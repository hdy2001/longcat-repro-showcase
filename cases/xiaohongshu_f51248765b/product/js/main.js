/* ════════════════════════════════════════════════════════════
   古建数字图谱 · 主路由
   全国地图 → 山西三维 → 建筑详情（结构模型）
   ════════════════════════════════════════════════════════════ */
(function(){
const $ = id => document.getElementById(id);
let provinceView = null;
let toastTimer = null;

function toast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.hidden = true; }, 2200);
}

function setBreadcrumb(parts){
  const nav = $("breadcrumb");
  nav.innerHTML = "";
  parts.forEach((p,i)=>{
    const span = document.createElement("span");
    span.className = "crumb" + (i===parts.length-1 ? " current" : "");
    span.textContent = p.label;
    if(i<parts.length-1 && p.go){
      span.addEventListener("click", ()=>location.hash = p.go);
      const sep = document.createElement("span");
      sep.className = "sep"; sep.textContent = "›";
      nav.appendChild(span); nav.appendChild(sep);
    } else nav.appendChild(span);
  });
}

function showView(name){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("on"));
  $("view-"+name).classList.add("on");
}

function route(){
  const hash = location.hash || "#/";
  const parts = hash.replace(/^#\/?/,"").split("/").filter(Boolean);

  // 清理上一视图的 3D 资源
  if(parts[0]!=="province" && provinceView){ provinceView.dispose(); provinceView=null; }
  if(parts[0]!=="building" && window.BuildingView){ window.BuildingView.dispose(); }
  // 重置详情页 lazy 标记
  if(parts[0]!=="building"){
    ["gallery","struct","history"].forEach(id=>{
      const el = document.getElementById(id);
      if(el) delete el.dataset.done;
    });
  }

  if(parts[0]==="province"){
    showView("province");
    setBreadcrumb([{label:"全国",go:"#/"},{label:"山西省 · 三维地形",go:null}]);
    if(!provinceView){
      provinceView = new ProvinceView(
        $("provinceStage"), $("provinceCanvas"),
        { goBuilding:id=>goBuilding(id), toast }
      );
    }
  } else if(parts[0]==="building" && parts[1]){
    const id = parts[1];
    if(!window.BUILDING_DETAIL[id]){ location.hash="#/"; return; }
    showView("building");
    const D = window.BUILDING_DETAIL[id];
    setBreadcrumb([
      {label:"全国",go:"#/"},
      {label:"山西省",go:"#/province"},
      {label:D.name,go:null},
    ]);
    window.BuildingView.render(id);
  } else {
    showView("map");
    setBreadcrumb([{label:"全国 · 古建分布",go:null}]);
    if(!window.MapView._ready){
      window.MapView._ready = true;
      window.MapView.init({ goProvince:()=>{location.hash="#/province";}, goBuilding, toast });
    }
  }
}

function goBuilding(id){
  if(id==="yx" || id==="nc") location.hash = "#/building/"+id;
  else location.hash = "#/";
}

$("brandHome").addEventListener("click", ()=>{ location.hash="#/"; });
$("modalClose").addEventListener("click", ()=>{ $("modalMask").hidden = true; });
$("modalMask").addEventListener("click", e=>{ if(e.target.id==="modalMask") e.target.hidden = true; });

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", ()=>{
  if(!location.hash) history.replaceState(null,"","#/");
  route();
});
})();
