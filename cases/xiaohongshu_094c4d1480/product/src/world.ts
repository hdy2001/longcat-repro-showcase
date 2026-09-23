// ===== 天空 / 光照 / 雾 =====
import * as THREE from 'three';
import { MAP } from './map/mapData';

export interface WorldEnv {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
}

// 渐变天空穹顶
function createSkyDome(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(480, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2f7fd6) },     // 天顶深蓝
      midColor: { value: new THREE.Color(0x7db8e8) },     // 天蓝
      horizonColor: { value: new THREE.Color(0xe8d5a8) }, // 地平线沙尘色
      sunDir: { value: new THREE.Vector3(0.5, 0.62, 0.35).normalize() },
      sunColor: { value: new THREE.Color(0xfff3d0) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor, midColor, horizonColor, sunColor, sunDir;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, -0.1, 1.0);
        vec3 col;
        if (h < 0.12) {
          col = mix(horizonColor, midColor, smoothstep(-0.05, 0.12, h));
        } else {
          col = mix(midColor, topColor, smoothstep(0.12, 0.75, h));
        }
        float sunD = max(dot(normalize(vDir), sunDir), 0.0);
        col += sunColor * (pow(sunD, 350.0) * 1.6 + pow(sunD, 24.0) * 0.28 + pow(sunD, 6.0) * 0.10);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0, 0);
  mesh.renderOrder = -10;
  return mesh;
}

// 太阳圆盘光晕 sprite
function createSunSprite(): THREE.Sprite {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,250,230,1)');
  g.addColorStop(0.25, 'rgba(255,244,200,0.85)');
  g.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(150, 150, 1);
  const dir = new THREE.Vector3(0.5, 0.62, 0.35).normalize();
  sprite.position.copy(dir.multiplyScalar(420));
  return sprite;
}

// 云朵（几片半透明面片）
function createClouds(): THREE.Group {
  const group = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d')!;
  const rand = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  for (let i = 0; i < 5; i++) {
    const g = ctx.createRadialGradient(64 + (rand() - 0.5) * 20, 32 + (rand() - 0.5) * 10, 4, 64, 32, 52);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(64, 32, 52 + rand() * 16, 20 + rand() * 8, 0, 0, 7);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.5 + rand() * 0.3, fog: false, depthWrite: false });
    const s = new THREE.Sprite(mat);
    const scale = 60 + rand() * 90;
    s.scale.set(scale, scale * 0.42, 1);
    s.position.set((rand() - 0.5) * 700, 120 + rand() * 110, (rand() - 0.5) * 700);
    group.add(s);
  }
  return group;
}

export function buildWorld(scene: THREE.Scene): WorldEnv {
  scene.background = new THREE.Color(0x87b5e0);
  scene.fog = new THREE.Fog(0xdcc394, 120, 420);

  scene.add(createSkyDome());
  scene.add(createSunSprite());
  scene.add(createClouds());

  // 强烈日照（硬阴影）
  const sunDir = new THREE.Vector3(0.5, 0.62, 0.35).normalize();
  const sun = new THREE.DirectionalLight(0xfff2dc, 3.4);
  sun.position.copy(sunDir.clone().multiplyScalar(160));
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75;
  sc.near = 40; sc.far = 320;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  // PCF 硬阴影：radius 小
  sun.shadow.radius = 1.5;
  scene.add(sun);
  scene.add(sun.target);

  // 天空/地面环境光
  const hemi = new THREE.HemisphereLight(0x9ec8f0, 0xc9a86a, 0.85);
  scene.add(hemi);

  // 包点/走廊点光
  const lampPositions: [number, number, number][] = [
    [0, 3.8, 14], [0, 3.8, 22], [-41, 3.6, -40], [-30, 3.6, 40], [30, 3.7, 38], [20, 3.6, -22],
  ];
  for (const [x, y, z] of lampPositions) {
    const pl = new THREE.PointLight(0xffd9a0, 14, 17, 1.8);
    pl.position.set(x, y, z);
    scene.add(pl);
  }

  return { sun, hemi };
}

// 地图范围（供调试相机）
export const MAP_CENTER = { x: 0, z: 0 };
