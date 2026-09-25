// ============================================================
// 世界组装：材质 → 建筑 → 城市 → 布景 → 天空 → 灯光
// ============================================================
import * as THREE from 'three';
import { buildMaterials, glowTexture, moonTexture, pavingTexture, latticeTexture, marbleTexture } from './materials.js';
import { BuildKit } from './buildings.js';
import { buildCity } from './city.js';
import { buildDecor } from './decor.js';
import { buildSky, buildMoon } from './sky.js';

export function buildWorld() {
  const M = buildMaterials();
  const glowTex = glowTexture();
  const moonTex = moonTexture();
  M.latticeMap = latticeTexture();
  M.windowGlow.map = M.latticeMap;
  M.pavingMap = pavingTexture();
  M.plaza.map = M.pavingMap;
  M.marbleMap = marbleTexture();
  M.marble.map = M.marbleMap;
  M.marbleDark.map = M.marbleMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a1020, 0.00085);

  // ---------- 灯光 ----------
  scene.add(new THREE.HemisphereLight(0x2c3e60, 0x201510, 0.9));
  scene.add(new THREE.AmbientLight(0x18203a, 0.9));
  const moonLight = new THREE.DirectionalLight(0x9db4dd, 0.9);
  moonLight.position.set(600, 800, -300);
  scene.add(moonLight);
  // 主殿暖色点光（照亮广场与立面）
  const warm = (x, y, z, i, d) => {
    const L = new THREE.PointLight(0xffa54d, i, d, 1.8);
    L.position.set(x, y, z);
    scene.add(L);
  };
  warm(0, 60, 96, 3800, 190);      // 太和殿
  warm(0, 50, -72, 2200, 140);     // 保和殿
  warm(0, 50, -186, 2200, 130);    // 乾清宫
  warm(0, 34, 398, 2200, 130);     // 午门
  warm(0, 36, -466, 2200, 130);    // 神武门
  warm(0, 45, 180, 2400, 170);     // 外朝广场
  warm(0, 36, -110, 1400, 120);    // 内廷
  warm(0, 30, -392, 1100, 100);    // 御花园
  warm(190, 24, -216, 1000, 120);   // 东六宫
  warm(-190, 24, -216, 1000, 120);  // 西六宫
  warm(236, 24, 96, 900, 90);      // 文华殿
  warm(-236, 24, 64, 900, 90);     // 武英殿
  warm(376, 36, 480, 900, 100);     // 角楼×4
  warm(-376, 36, 480, 900, 100);
  warm(376, 36, -480, 900, 100);
  warm(-376, 36, -480, 900, 100);
  warm(55, 34, 165, 1800, 150);     // 外朝广场补光
  warm(-55, 34, 165, 1800, 150);
  warm(0, 26, 440, 1600, 120);      // 午门前广场

  // ---------- 建筑 ----------
  const kit = new BuildKit(M);
  buildCity(kit, M);
  kit.build(scene, M);
  for (const extra of kit._extra || []) scene.add(extra);

  // ---------- 宝顶/角楼金色光晕（Sprite 始终面向相机） ----------
  for (const [fx, fy, fz, fs] of kit.finials) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffc06a, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.position.set(fx, fy, fz);
    sp.scale.setScalar(fs || 16);
    scene.add(sp);
  }

  // ---------- 地面布景 ----------
  const { updaters } = buildDecor(scene, M, glowTex);

  // ---------- 天空 ----------
  const { stars } = buildSky(scene, moonTex, glowTex);
  const moonGroup = buildMoon(scene, moonTex, glowTex);

  return {
    scene, M, updaters, stars, moonGroup,
    update(dt, t) {
      stars.uniforms.time.value = t;
      for (const u of updaters) u(dt, t);
      moonGroup.lookAt(0, 300, -400);
    },
  };
}
