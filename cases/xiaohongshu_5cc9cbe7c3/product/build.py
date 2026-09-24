#!/usr/bin/env python3
"""构建单文件 index.html：内联 three.js + 游戏代码"""
import re, pathlib

root = pathlib.Path(__file__).parent

three = (root / 'three.module.js').read_text(encoding='utf-8')
# 去掉末尾的 export 语句，并据此生成 THREE 命名空间对象（与游戏代码同处一个 module 作用域）
m = re.search(r'\nexport \{([^}]*)\};', three)
assert m, 'export statement not found'
export_names = [n.strip() for n in m.group(1).split(',') if n.strip()]
three = three[:m.start()] + '\n'
three += '\nconst THREE = {\n  ' + ',\n  '.join(export_names) + '\n};\n'
assert 'export {' not in three.split('\n')[-5:], 'export strip failed'

game = ''
for name in ['js/util.js', 'js/world.js', 'js/actors.js', 'js/ui.js', 'js/main.js']:
    game += '\n' + (root / name).read_text(encoding='utf-8')

html = (root / 'template.html').read_text(encoding='utf-8')
html = html.replace('<!--THREE-->', lambda: three) if False else html
html = html.replace('<!--THREE-->', three)
html = html.replace('<!--GAME-->', game)

out = root / 'index.html'
out.write_text(html, encoding='utf-8')
print(f'built {out} ({out.stat().st_size/1024:.0f} KB)')
