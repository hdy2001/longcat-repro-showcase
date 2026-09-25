// 构建: esbuild 打包 TS (three/rapier 保持 CDN 外部导入) → 内联进 template.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';

const res = await build({
  entryPoints: ['src/game.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  external: ['three', 'three/addons/*', '@dimforge/rapier3d-compat'],
  outfile: 'dist/game.bundle.js',
  sourcemap: false,
  minify: false,
  logLevel: 'info',
});

const js = readFileSync('dist/game.bundle.js', 'utf8');
const tpl = readFileSync('template.html', 'utf8');
if (!tpl.includes('<!--GAME_JS-->')) throw new Error('template missing GAME_JS marker');
const out = tpl.replace('<!--GAME_JS-->', () => `\n<script type="module">\n${js}\n</script>`);
writeFileSync('desert-ops.html', out);
console.log(`OK desert-ops.html  ${(out.length / 1024).toFixed(0)} KB`);
