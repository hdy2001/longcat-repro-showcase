// ============================================================
// 夜空：深蓝黑渐变穹顶 + 繁星（闪烁） + 明月（光晕）
// ============================================================
import * as THREE from 'three';
import { PAL } from './config.js';

export function buildSky(scene, moonTex, glowTex) {
  // ---------- 穹顶着色器 ----------
  const skyGeo = new THREE.SphereGeometry(1600, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PAL.sky0) },
      mid: { value: new THREE.Color(0x0a1226) },
      bot: { value: new THREE.Color(0x16233f) },
    },
    vertexShader: /* glsl */`
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;            // -1..1
        vec3 c = h > 0.0
          ? mix(mid, top, pow(h, 0.55))
          : mix(mid, bot, pow(-h, 0.5));
        // 地平线附近微暖（城市灯火反光）
        float horiz = exp(-abs(h) * 7.0);
        c += vec3(0.10, 0.06, 0.02) * horiz;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // ---------- 繁星（闪烁） ----------
  {
    const N = 2200, pos = new Float32Array(N * 3), phase = new Float32Array(N), size = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      // 上半球随机分布
      const th = Math.random() * Math.PI * 2;
      const y = Math.random() * 0.92 + 0.06;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const R = 1500;
      pos[i * 3] = Math.cos(th) * r * R;
      pos[i * 3 + 1] = y * R;
      pos[i * 3 + 2] = Math.sin(th) * r * R;
      phase[i] = Math.random() * 6.28;
      size[i] = 1.2 + Math.random() * 2.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('psize', new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 } },
      vertexShader: /* glsl */`
        attribute float phase; attribute float psize;
        uniform float time;
        varying float vTw;
        void main() {
          vTw = 0.55 + 0.45 * sin(time * 1.6 + phase);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = psize * (700.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying float vTw;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = smoothstep(0.5, 0.05, d) * vTw;
          gl_FragColor = vec4(vec3(0.85, 0.9, 1.0), a);
        }`,
    });
    const stars = new THREE.Points(geo, mat);
    scene.add(stars);
    return { sky, stars: mat };
  }
}

// ---------- 明月 ----------
export function buildMoon(scene, moonTex, glowTex) {
  const grp = new THREE.Group();
  const M = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, depthWrite: false })
  );
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshBasicMaterial({ map: glowTex, color: 0xdfe8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  const halo2 = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshBasicMaterial({ map: glowTex, color: 0x8fa8d8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  grp.add(halo2, halo, M);
  grp.position.set(520, 430, -980);
  scene.add(grp);
  return grp;
}
