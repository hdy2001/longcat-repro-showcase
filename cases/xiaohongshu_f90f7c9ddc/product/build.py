#!/usr/bin/env python3
"""组装单文件 HTML：three.min.js + OrbitControls.js + app.js 内联进 template.html"""
import pathlib

ws = pathlib.Path(__file__).parent
out = ws / "xiaoxitian_3d.html"

html = (ws / "template.html").read_text(encoding="utf-8")
html = html.replace("/*__THREE__*/", (ws / "three.min.js").read_text(encoding="utf-8"))
html = html.replace("/*__CONTROLS__*/", (ws / "OrbitControls.js").read_text(encoding="utf-8"))
html = html.replace("/*__APP__*/", (ws / "app.js").read_text(encoding="utf-8"))

out.write_text(html, encoding="utf-8")
print(f"written: {out} ({out.stat().st_size/1024:.0f} KB)")
