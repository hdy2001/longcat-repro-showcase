/* ========== 应用编排：视图切换 ========== */

const App = {
  currentView: "map",
  currentBuilding: "yx",

  init() {
    MapView.init();

    document.getElementById("btn-back-map").addEventListener("click", () => this.show("map"));
    document.getElementById("btn-back-province").addEventListener("click", () => this.show("province"));
    document.getElementById("btn-switch-building").addEventListener("click", () => {
      this.currentBuilding = this.currentBuilding === "yx" ? "nc" : "yx";
      BuildingView.enter(this.currentBuilding);
    });

    // 首帧渲染完成后隐藏加载遮罩
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById("loading").hidden = true;
      }, 300);
    });
  },

  show(view) {
    if (this.currentView === view) return;
    const prev = this.currentView;
    this.currentView = view;

    document.getElementById("view-map").classList.toggle("active", view === "map");
    document.getElementById("view-province").classList.toggle("active", view === "province");
    document.getElementById("view-building").classList.toggle("active", view === "building");

    if (prev === "province") ProvinceView.leave();
    if (prev === "building") BuildingView.leave();

    if (view === "province") ProvinceView.enter();
    if (view === "building") BuildingView.enter(this.currentBuilding);
  },

  enterProvince() {
    this.show("province");
  },

  enterBuilding(key) {
    this.currentBuilding = key;
    this.show("building");
  }
};

window.addEventListener("DOMContentLoaded", () => App.init());
