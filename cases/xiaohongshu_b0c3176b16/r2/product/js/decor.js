// ============================================================
// 地面布景：古柏剪影 / 火树银花 / 宫灯灯柱 / 地面光池 / 游人
// ============================================================
import * as THREE from 'three';
import { PAL } from './config.js';

export function buildDecor(scene, M, glowTex) {
  const disposables = [];
  const updaters = []; // 每帧回调

  // ---------- 古柏剪影（Instanced 圆锥树冠） ----------
  {
    const spots = [];
    // 外朝广场两列
    for (let z = 250; z >= 40; z -= 28) { spots.push([24, z], [-24, z]); }
    // 内金水河两岸
    for (const s of [1, -1]) for (let x = 40; x <= 200; x += 40) {
      const zc = 330 + 24 * (1 - Math.pow(x / 225, 2));
      spots.push([s * x, zc - 10], [s * x, zc + 10]);
    }
    // 内廷两侧
    for (let z = -160; z >= -320; z -= 26) { spots.push([34, z], [-34, z], [58, z - 13], [-58, z - 13]); }
    // 御花园密植
    for (let i = 0; i < 26; i++) {
      const x = (Math.random() - 0.5) * 110;
      const z = -340 - Math.random() * 95;
      spots.push([x, z]);
    }
    // 城外剪影（北/南城墙外）
    for (let x = -340; x <= 340; x += 24) { spots.push([x + (Math.random() - 0.5) * 8, -512 - Math.random() * 20]); spots.push([x + (Math.random() - 0.5) * 8, 512 + Math.random() * 14]); }
    for (let z = -300; z <= 300; z += 30) { spots.push([430 + Math.random() * 20, z]); spots.push([-430 - Math.random() * 20, z]); }

    const cone = new THREE.ConeGeometry(1, 1, 7);
    const trunk = new THREE.CylinderGeometry(0.14, 0.2, 1, 5);
    const im = new THREE.InstancedMesh(cone, M.tree, spots.length);
    const imT = new THREE.InstancedMesh(trunk, M.trunk, spots.length);
    const m4 = new THREE.Matrix4();
    spots.forEach(([x, z], i) => {
      const h = 7 + Math.random() * 6, r = 2.2 + Math.random() * 1.8;
      m4.makeScale(r, h, r).setPosition(x, h / 2 + 2.5, z);
      im.setMatrixAt(i, m4);
      m4.makeScale(1, 1, 1).setPosition(x, 1.2, z);
      imT.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = imT.instanceMatrix.needsUpdate = true;
    scene.add(im, imT);
  }

  // ---------- 火树（金色灯球树：暖金点光源散布） ----------
  const fireTrees = [];
  {
    const spots = [];
    for (const z of [372, 300, 238, 150, 44, -58, -150, -258, -356]) { spots.push([24, z], [-24, z]); }
    spots.push([48, -414], [-48, -414], [14, -396], [-14, -396]);
    const pGeo = new THREE.BufferGeometry();
    const pPos = [], pCol = [];
    const palette = [new THREE.Color(0xffd98a), new THREE.Color(0xffb45e), new THREE.Color(0xffe9b0), new THREE.Color(0xff9a4d)];
    for (const [x, z] of spots) {
      const n = 130;
      for (let i = 0; i < n; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        const rr = Math.pow(Math.random(), 0.5);
        const ex = rr * Math.sin(ph) * Math.cos(th) * 4.6;
        const ey = rr * Math.cos(ph) * 4.6 + 5.2;
        const ez = rr * Math.sin(ph) * Math.sin(th) * 4.6;
        pPos.push(x + ex, ey, z + ez);
        const pc = palette[i % palette.length];
        pCol.push(pc.r, pc.g, pc.b);
      }
      fireTrees.push([x, z]);
    }
    pGeo.setAttribute('position', new THREE.Float32BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.Float32BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({ size: 0.68, vertexColors: true, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    const pts = new THREE.Points(pGeo, pMat);
    scene.add(pts);
    disposables.push(pGeo, pMat);

    // 树干
    const trunk = new THREE.CylinderGeometry(0.3, 0.5, 4.6, 6);
    const im = new THREE.InstancedMesh(trunk, M.trunk, fireTrees.length);
    const m4 = new THREE.Matrix4();
    fireTrees.forEach(([x, z], i) => { m4.identity().setPosition(x, 2.3, z); im.setMatrixAt(i, m4); });
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
  }

  // ---------- 宫灯灯柱（灯杆 + 双侧挂灯 + 光晕） ----------
  const poleSpots = [];
  {
    const poles = [];
    for (let z = 448; z >= -446; z -= 28) {
      if (Math.abs(z - 340) < 14) continue;      // 让开内金水河
      if (Math.abs(z - 96) < 10 || Math.abs(z - 6) < 8) continue; // 让开三台/中和殿
      poles.push([15, z], [-15, z]);
    }
    poleSpots.push(...poles);
    const pole = new THREE.CylinderGeometry(0.12, 0.18, 7.4, 6);
    const im = new THREE.InstancedMesh(pole, M.column, poles.length);
    const m4 = new THREE.Matrix4();
    const haloPos = [];
    poles.forEach(([x, z], i) => {
      m4.identity().setPosition(x, 3.7, z); im.setMatrixAt(i, m4);
      haloPos.push(x + 1.1, 6.2, z, x - 1.1, 6.2, z);
    });
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);

    // 灯笼（发光盒）
    const lan = new THREE.BoxGeometry(0.9, 1.2, 0.9);
    const imL = new THREE.InstancedMesh(lan, M.lanternRed, poles.length * 2);
    let li = 0;
    for (const [x, z] of poles) {
      for (const s of [1, -1]) { m4.identity().setPosition(x + s * 1.1, 6.2, z); imL.setMatrixAt(li++, m4); }
    }
    imL.instanceMatrix.needsUpdate = true;
    scene.add(imL);

    // 横杆
    const bar = new THREE.CylinderGeometry(0.07, 0.07, 2.6, 5);
    const imB = new THREE.InstancedMesh(bar, M.column, poles.length);
    poles.forEach(([x, z], i) => {
      m4.makeRotationZ(Math.PI / 2).setPosition(x, 7.1, z);
      imB.setMatrixAt(i, m4);
    });
    imB.instanceMatrix.needsUpdate = true;
    scene.add(imB);

    // 灯晕精灵（Points 大光斑）
    const hGeo = new THREE.BufferGeometry();
    hGeo.setAttribute('position', new THREE.Float32BufferAttribute(haloPos, 3));
    const hMat = new THREE.PointsMaterial({ size: 5.2, map: glowTex, color: 0xffc06a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(hGeo, hMat));
    disposables.push(hGeo, hMat);
  }

  // ---------- 地面暖金光池（火树银花的“地花”） ----------
  {
    const pools = [];
    for (const [x, z] of fireTrees) pools.push([x, z, 7.5]);
    for (const z of [250, 180, 120, -40, -180, -320]) pools.push([40, z, 4], [-40, z, 4]);
    const geo = new THREE.BufferGeometry();
    const pos = [], col = [];
    const c = new THREE.Color(0xffb45e);
    for (const [x, z, s] of pools) {
      // 椭圆光池用多个点近似
      for (let i = 0; i < 60; i++) {
        const th = (i / 60) * Math.PI * 2;
        const rr = 0.3 + 0.7 * ((i * 7) % 10) / 10;
        pos.push(x + Math.cos(th) * s * rr, 0.12, z + Math.sin(th) * s * 0.7 * rr);
        col.push(c.r, c.g, c.b);
      }
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.9, map: glowTex, vertexColors: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(geo, mat));
    disposables.push(geo, mat);
  }

  // ---------- 游人（低多边形小人，沿路行走） ----------
  {
    const lanes = [
      { axis: 'z', fixed: 0, from: 436, to: -448, n: 46, spread: 5 },     // 中轴御路
      { axis: 'z', fixed: 14, from: 250, to: -400, n: 16, spread: 2 },    // 东路
      { axis: 'z', fixed: -14, from: 250, to: -400, n: 16, spread: 2 },   // 西路
    ];
    const jacketColors = [0xd8d3c8, 0xc46a5a, 0x5a7ac4, 0xc4a45a, 0x7ac48a, 0xb06ac4, 0xd8d3c8, 0xe8e4da];
    const jacket = new THREE.CapsuleGeometry(0.42, 0.75, 3, 8);
    const head = new THREE.SphereGeometry(0.3, 8, 7);
    let total = 0;
    for (const l of lanes) total += l.n;
    const imBody = new THREE.InstancedMesh(jacket, new THREE.MeshStandardMaterial({ roughness: 0.8 }), total);
    const imHead = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ color: 0xe8c49a, roughness: 0.7 }), total);
    imBody.name = 'people';
    const walkers = [];
    const m4 = new THREE.Matrix4();
    let idx = 0;
    for (const l of lanes) {
      for (let i = 0; i < l.n; i++) {
        const t = (i + Math.random()) / l.n;
        const pos = l.from + (l.to - l.from) * t;
        const x = l.fixed + (Math.random() - 0.5) * l.spread;
        const z = l.axis === 'z' ? pos : l.fixed;
        const px = l.axis === 'z' ? x : pos;
        walkers.push({ x, z, from: l.from, to: l.to, speed: (2.2 + Math.random() * 1.6) * (Math.random() < 0.5 ? 1 : -1), phase: Math.random() * 6.28, s: 0.85 + Math.random() * 0.35, dir: 1 });
        m4.identity().setPosition(px, 0.9, z);
        imBody.setMatrixAt(idx, m4);
        imBody.setColorAt(idx, new THREE.Color(jacketColors[i % jacketColors.length]));
        m4.identity().setPosition(px, 1.85, z);
        imHead.setMatrixAt(idx, m4);
        idx++;
      }
    }
    imBody.instanceMatrix.needsUpdate = imHead.instanceMatrix.needsUpdate = true;
    if (imBody.instanceColor) imBody.instanceColor.needsUpdate = true;
    scene.add(imBody, imHead);
    disposables.push(jacket, head, imBody.material, imHead.material);

    updaters.push((dt, t) => {
      let k = 0;
      for (const w of walkers) {
        let z = w.z + w.speed * dt;
        if (z < w.to) z = w.from;
        if (z > w.from) z = w.to;
        w.z = z;
        const bob = Math.abs(Math.sin(t * 7 * Math.abs(w.speed) * 0.45 + w.phase)) * 0.12;
        const s = w.s;
        m4.makeRotationY(w.speed > 0 ? Math.PI : 0);
        m4.scale(new THREE.Vector3(s, s, s));
        m4.setPosition(w.x, 0.9 * s + bob, z);
        imBody.setMatrixAt(k, m4);
        m4.setPosition(w.x, 1.85 * s + bob, z);
        imHead.setMatrixAt(k, m4);
        k++;
      }
      imBody.instanceMatrix.needsUpdate = true;
      imHead.instanceMatrix.needsUpdate = true;
    });
  }

  // ---------- 灯串（檐柱间悬链金色灯球，火树银花） ----------
  {
    const strPos = [];
    const c = new THREE.Color(0xffcf7e);
    const sCol = [];
    const addStr = (x1, z1, x2, z2, sag = 2.2, n = 12) => {
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
        const y = 7.1 - Math.sin(t * Math.PI) * sag;
        strPos.push(x, y, z);
        sCol.push(c.r, c.g, c.b);
      }
    };
    for (const x of [15, -15]) {
      for (let i = 0; i < poleSpots.length; i += 2) {
        const [, z1] = poleSpots[i];
        const next = poleSpots.find(p => p[0] === x && p[1] < z1 - 1);
        if (next) addStr(x, z1, x, next[1]);
      }
    }
    // 午门两翼与阙楼之间拉大串
    addStr(-31, 398, -16, 398, 3.0, 8); addStr(16, 398, 31, 398, 3.0, 8);
    addStr(-61, 414, -46, 414, 2.4, 6); addStr(46, 414, 61, 414, 2.4, 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(strPos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(sCol, 3));
    const mat = new THREE.PointsMaterial({ size: 1.5, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(geo, mat));
    disposables.push(geo, mat);
  }

  // ---------- 御路两侧金色地灯带 ----------
  {
    const pos = [], col = [];
    const c1 = new THREE.Color(0xffd98a), c2 = new THREE.Color(0xff9a4d);
    for (let z = 436; z >= -448; z -= 5.5) {
      for (const x of [-3.4, 3.4]) {
        pos.push(x, 0.15, z);
        const cc = (Math.floor(z / 5.5) % 2) ? c1 : c2;
        col.push(cc.r, cc.g, cc.b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.85, map: glowTex, vertexColors: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(geo, mat));
    disposables.push(geo, mat);
  }

  // ---------- 散落宫院的地灯（火树银花般的暖金点光源） ----------
  {
    const pos = [], col = [];
    const c1 = new THREE.Color(0xffc76a), c2 = new THREE.Color(0xff8a4d), c3 = new THREE.Color(0xffe9b0);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 300; i++) {
      const x = (rnd() - 0.5) * 700;
      const z = (rnd() - 0.5) * 900;
      if (Math.abs(x) < 9 && z > -460 && z < 450) continue;                 // 御路
      if (z > 316 && z < 352 && Math.abs(x) < 220) continue;               // 内金水河
      pos.push(x, 0.25, z);
      const cc = rnd() < 0.6 ? c1 : (rnd() < 0.5 ? c2 : c3);
      col.push(cc.r, cc.g, cc.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.7, map: glowTex, vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(geo, mat));
    disposables.push(geo, mat);
  }

  return { updaters };
}
