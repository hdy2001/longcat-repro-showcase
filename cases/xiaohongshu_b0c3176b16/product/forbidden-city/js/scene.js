// ============================================================
// scene.js — 组装完整夜景故宫（两个页面共用）
// ============================================================
import * as THREE from 'three';
import { makeMaterials } from './materials.js';
import { createSky, createStars, createMoon, createClouds, createGround, createMoat, createInnerRiver, createPalaceWalls } from './env.js';
import { buildCity } from './city.js';
import { createCrowd } from './people.js';
import { decorateTrees, addGlowSprites, createComposer } from './fx.js';

export function createScene(renderer, opts = {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a1222, 0.0008);
  scene.background = new THREE.Color(0x05070f);

  const M = makeMaterials();

  // ---------- 灯光 ----------
  const hemi = new THREE.HemisphereLight(0x2a3e6e, 0x0d1018, 1.1);
  scene.add(hemi);
  const moonLight = new THREE.DirectionalLight(0x8fa3d0, 0.55);
  moonLight.position.set(300, 500, -800);
  scene.add(moonLight);
  const warmFill = new THREE.DirectionalLight(0xff9a4a, 0.16);
  warmFill.position.set(-200, 120, 600);
  scene.add(warmFill);
  // 太和殿前暖光池
  const p1 = new THREE.PointLight(0xff8a3c, 900, 90, 2); p1.position.set(0, 12, 310); scene.add(p1);
  const p2 = new THREE.PointLight(0xff7a30, 600, 70, 2); p2.position.set(0, 10, 165); scene.add(p2);
  const p3 = new THREE.PointLight(0xffb060, 400, 60, 2); p3.position.set(0, 9, 10); scene.add(p3);
  // 沿宫灯杆的暖光池（地面光晕）
  [[0, 430], [0, 392], [0, 352], [0, 318], [0, 240], [0, 175], [0, 100], [0, 30], [0, -45], [0, -120], [0, -185]].forEach(([x, z]) => {
    const pl = new THREE.PointLight(0xff9440, 130, 34, 2);
    pl.position.set(x, 5.2, z);
    scene.add(pl);
  });

  // ---------- 天空 ----------
  const sky = createSky(); scene.add(sky);
  const stars = createStars(2600); scene.add(stars);
  const moon = createMoon(); scene.add(moon);
  const clouds = createClouds(8); scene.add(clouds);

  // ---------- 地面 / 城 ----------
  scene.add(createGround(M));
  scene.add(createMoat(M));
  scene.add(createInnerRiver(M));
  scene.add(createPalaceWalls(M));

  // ---------- 城市 ----------
  const city = buildCity(scene, M);
  decorateTrees(scene, M, city.trees);
  addGlowSprites(scene, city.root.userData.glowAnchors);

  // ---------- 人群 ----------
  const crowd = createCrowd(scene, M, opts.crowdCount || 170);

  // ---------- 每帧更新 ----------
  function update(dt, t) {
    stars.userData.mat.uniforms.uTime.value = t;
    sky.material.uniforms.uTime.value = t;
    clouds.userData.update(dt);
    crowd.update(dt, t);
  }

  return { scene, city, crowd, update, M };
}
