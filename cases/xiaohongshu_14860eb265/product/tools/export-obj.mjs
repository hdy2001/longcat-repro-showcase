/**
 * 导出 SketchUp 可导入的 OBJ + MTL 模型
 * 用法: node tools/export-obj.mjs
 */
import * as THREE from 'three';
import { buildTempleModel, MATERIALS, PART_INFO } from '../src/model.js';
import { mkdirSync, writeFileSync } from 'fs';

const OUT = new URL('../outputs/model/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const { group, bounds } = buildTempleModel();

/* ---------- OBJ ---------- */
let vOff = 1, vnOff = 1;
const objLines = ['# 恒山悬空寺 · Hengshan Hanging Temple', '# 程序化重建 · 可导入 SketchUp (File > Import > OBJ)', ''];
const mtlNames = new Set();
group.updateMatrixWorld(true);
group.traverse((o) => {
  if (!o.isMesh) return;
  const matName = o.material.name || 'rock';
  mtlNames.add(matName);
  objLines.push(`o ${o.name}`);
  objLines.push(`g ${o.userData.part || o.name}`);
  objLines.push(`usemtl ${matName}`);
  const g = o.geometry;
  const pos = g.attributes.position, nor = g.attributes.normal;
  const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const vMap = new Map();
  const faces = [];
  for (let i = 0; i < pos.count; i += 3) {
    const face = [];
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(pos, i + k).applyMatrix4(o.matrixWorld);
      n.fromBufferAttribute(nor, i + k).applyMatrix3(nm).normalize();
      const key = `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}|${n.x.toFixed(4)},${n.y.toFixed(4)},${n.z.toFixed(4)}`;
      if (!vMap.has(key)) {
        vMap.set(key, vOff + vMap.size);
        objLines.push(`v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}`);
        objLines.push(`vn ${n.x.toFixed(4)} ${n.y.toFixed(4)} ${n.z.toFixed(4)}`);
      }
      face.push(vMap.get(key));
    }
    faces.push(face);
  }
  for (const f of faces) objLines.push(`f ${f.map(i => `${i}//${i}`).join(' ')}`);
  vOff += vMap.size;
  objLines.push('');
});
writeFileSync(OUT + 'hanging_temple.obj', objLines.join('\n'));

/* ---------- MTL ---------- */
const mtlLines = ['# 恒山悬空寺 材质库'];
for (const name of mtlNames) {
  const m = MATERIALS[name] || { color: 0x999999, label: name };
  const c = new THREE.Color(m.color);
  mtlLines.push(`newmtl ${name}`);
  mtlLines.push(`Kd ${c.r.toFixed(3)} ${c.g.toFixed(3)} ${c.b.toFixed(3)}`);
  mtlLines.push(`Ks 0.150 0.150 0.150`);
  mtlLines.push(`d 1.0`);
  mtlLines.push(`# ${m.label} (${m.category})`);
  mtlLines.push('');
}
writeFileSync(OUT + 'hanging_temple.mtl', mtlLines.join('\n'));

/* ---------- manifest ---------- */
const manifest = {
  name: '恒山悬空寺 · Hengshan Hanging Temple',
  source: 'inputs/img_00.webp（参考图程序化重建）',
  generator: 'src/model.js (three.js procedural builder)',
  units: 'meters',
  bounds: {
    min: bounds.min.toArray().map(v => +v.toFixed(2)),
    max: bounds.max.toArray().map(v => +v.toFixed(2)),
  },
  coordinateSystem: { up: '+Y', templeFaces: '+Z (南/河谷方向)', cliffFace: 'z≈0 立面' },
  sketchup: { import: '文件 > 导入 > 选择 OBJ（或直接拖入）', note: '模型已按真实尺度(米)构建，导入后可用实体工具/组件进一步编辑' },
  parts: Object.entries(PART_INFO).map(([key, info]) => ({ id: key, ...info })),
  materials: Object.fromEntries([...mtlNames].map(n => [n, MATERIALS[n] ? MATERIALS[n].label : n])),
};
writeFileSync(OUT + 'manifest.json', JSON.stringify(manifest, null, 2));

const stat = (p) => (require('fs').statSync(p).size / 1024).toFixed(0) + ' KB';
console.log('OBJ 导出完成:');
console.log(' ', OUT + 'hanging_temple.obj');
console.log(' ', OUT + 'hanging_temple.mtl');
console.log(' ', OUT + 'manifest.json');
console.log('  顶点组数:', vOff - 1, ' 法线数:', vnOff - 1, ' 材质:', [...mtlNames].join(', '));
console.log('  包围盒:', JSON.stringify(manifest.bounds));
