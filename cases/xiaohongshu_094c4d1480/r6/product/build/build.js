/* 构建: 编译 game.ts, 内联 three/rapier(含wasm base64), 输出单文件 HTML */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');

// 1) 编译 TypeScript
execSync('npx tsc game.ts --outFile game.js --target es2019 --module none --strict false --skipLibCheck --lib es2019,dom', {
  cwd: __dirname, stdio: 'inherit',
});

// 2) ES module -> 全局 IIFE (放在文档尾部, 等 DOM 就绪后执行)
function toGlobal(src, name) {
  const i = src.lastIndexOf('export{');
  const j = src.indexOf('};', i);
  if (i < 0 || j < 0) throw new Error('export not found: ' + name);
  const body = src.slice(i + 8, j).replace(/\b(\w+)\s+as\s+(\w+)\b/g, '$2: $1');
  return '(function(){' + src.slice(0, i) + 'window.' + name + '={' + body + '};})();';
}

// 3) 读取并转换库
const three = toGlobal(fs.readFileSync(path.join(root, 'libs/three.module.min.js'), 'utf8'), 'THREE');
let rapier = fs.readFileSync(path.join(root, 'libs/rapier3d-compat.js'), 'utf8');
const wasmB64 = fs.readFileSync(path.join(root, 'libs/rapier_wasm3d_bg.wasm')).toString('base64');
const needle = 'void 0===I&&(I=new URL("rapier_wasm3d_bg.wasm","<deleted>"))';
if (!rapier.includes(needle)) throw new Error('rapier wasm url needle not found');
rapier = rapier.replace(needle, 'void 0===I&&(I="data:application/wasm;base64,' + wasmB64 + '")');
rapier = toGlobal(rapier, 'RAPIER');

const game = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');

let html = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
html = html.replace('<!--@THREE-->', () => '<script>\n' + three + '\n</script>');
html = html.replace('<!--@RAPIER-->', () => '<script>\n' + rapier + '\n</script>');
html = html.replace('<!--@GAME-->', () => '<script>\n' + game + '\n</script>');

const out = path.join(root, 'desert_strike.html');
fs.writeFileSync(out, html);
const sz = (fs.statSync(out).size / 1024 / 1024).toFixed(2);
console.log('OK -> ' + out + ' (' + sz + ' MB)');
