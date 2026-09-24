// 构建：打包 TS → 内联到 HTML → 输出单文件 desert_strike.html
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outFile = path.join(root, 'desert_strike.html');

await build({
  entryPoints: [path.join(root, 'src/main.ts')],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  minify: true,
  outfile: path.join(root, 'dist/game.js'),
  logLevel: 'info',
});

const js = fs.readFileSync(path.join(root, 'dist/game.js'), 'utf8');
if (js.includes('</script>')) {
  console.error('✗ 打包代码中包含 </script>，会破坏内联！');
  process.exit(1);
}

const tpl = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
if (!tpl.includes('<!--GAME_JS-->')) {
  console.error('✗ 模板缺少 <!--GAME_JS--> 占位符');
  process.exit(1);
}
const html = tpl.replace('<!--GAME_JS-->', () => js);
fs.writeFileSync(outFile, html);
console.log(`✓ 已生成 ${outFile}（${(html.length / 1024).toFixed(0)} KB）`);

// 验证：无相对路径模块导入、无未替换占位符
const relImports = html.match(/(from|import)\s+['"]\.\.?\//g);
if (relImports) {
  console.error('✗ 发现相对路径导入:', relImports);
  process.exit(1);
}
if (html.includes('<!--GAME_JS-->') || html.includes('<!-- TODO -->') || html.includes('{{')) {
  console.error('✗ 发现未替换的模板占位符！');
  process.exit(1);
}
console.log('✓ 校验通过：无相对路径导入、无模板占位符');
