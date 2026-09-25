#!/usr/bin/env python3
"""组装单文件 HTML：template + three.min.js + OrbitControls.js + app.js"""
import pathlib

ws = pathlib.Path(__file__).parent
html = (ws / 'template.html').read_text(encoding='utf-8')
three = (ws / 'three.min.js').read_text(encoding='utf-8')
orbit = (ws / 'OrbitControls.js').read_text(encoding='utf-8')
app = (ws / 'app.js').read_text(encoding='utf-8')

# 防止内联脚本中出现 "</script>" 提前闭合
for name, code in (('three', three), ('orbit', orbit), ('app', app)):
    assert '</script' not in code.lower(), f'{name} 含有 </script>'

html = html.replace(
    '<!-- __SCRIPTS__ -->',
    '<script>\n' + three + '\n</script>\n'
    '<script>\n' + orbit + '\n</script>\n'
    '<script>\n' + app + '\n</script>'
)
out = ws / 'yingxian-pagoda.html'
out.write_text(html, encoding='utf-8')
print(f'OK -> {out} ({out.stat().st_size/1024:.0f} KB)')
