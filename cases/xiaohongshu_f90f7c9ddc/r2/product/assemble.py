#!/usr/bin/env python3
"""把 three.module.js / OrbitControls.js / BufferGeometryUtils.js / app.js 内联进 template.html，
输出单个独立 HTML 文件到工作区根目录。"""
import re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
build = root / '.build'

tpl = (build / 'template.html').read_text(encoding='utf-8')

def clean(src):
    # 去掉 from 'three' 的 import 语句（可能跨行）
    src = re.sub(r"import\s*\{[\s\S]*?\}\s*from\s*['\"]three['\"]\s*;?", "", src)
    # 去掉 export { ... }; 语句（three.module.js 末尾的大导出块）
    src = re.sub(r"export\s*\{[\s\S]*?\};?", "", src)
    return src

three = clean((build / 'three.module.js').read_text(encoding='utf-8'))
orbit = clean((build / 'OrbitControls.js').read_text(encoding='utf-8'))
bgu = clean((build / 'BufferGeometryUtils.js').read_text(encoding='utf-8'))
app = (build / 'app.js').read_text(encoding='utf-8')

html = tpl
for marker, chunk in [('//__THREE__', three), ('//__ORBIT__', orbit), ('//__BGU__', bgu), ('//__APP__', app)]:
    assert marker in html, f'marker missing: {marker}'
    html = html.replace(marker, chunk)

out = root / 'xiaoxitian_daxiongbaodian.html'
out.write_text(html, encoding='utf-8')
print(f'written: {out.name} ({len(html)/1024/1024:.2f} MB)')
