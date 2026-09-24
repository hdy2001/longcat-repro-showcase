#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 three.js + GLTFLoader + GLB(base64) 组装成单个 HTML 查看器"""
import base64, os

WS = os.path.dirname(os.path.abspath(__file__))
tpl = open(os.path.join(WS, "viewer_template.html"), encoding="utf-8").read()
three = open(os.path.join(WS, "three.min.js"), encoding="utf-8").read()
loader = open(os.path.join(WS, "GLTFLoader.js"), encoding="utf-8").read()
glb_b64 = base64.b64encode(open(os.path.join(WS, "pagoda.glb"), "rb").read()).decode("ascii")

def rep(s, marker, code):
    assert marker in s, marker
    return s.replace(marker, code, 1)

html = rep(tpl, "/*__THREE_JS__*/", three)
html = rep(html, "/*__GLTF_LOADER__*/", loader)
html = rep(html, "/*__GLB_B64__*/", glb_b64)

out = os.path.join(WS, "yingxian_pagoda_viewer.html")
open(out, "w", encoding="utf-8").write(html)
print(f"viewer: {out} ({os.path.getsize(out)/1e6:.1f} MB)")
