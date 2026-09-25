#!/usr/bin/env python3
"""Inline assets/ images as base64 data URIs into template.html -> index.html (single file)."""
import base64, json, os
from PIL import Image

ORDER = ['img_00.jpg'] + ['uniform_%02d.jpg' % i for i in range(1, 10)]
imgs = []
for name in ORDER:
    path = os.path.join('assets', name)
    with open(path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('ascii')
    w, h = Image.open(path).size
    imgs.append({'src': 'data:image/jpeg;base64,' + b64, 'w': w, 'h': h})

with open('template.html', encoding='utf-8') as f:
    tpl = f.read()
assert '__IMAGES_JSON__' in tpl and '__FIRST_IMG__' in tpl
tpl = tpl.replace('__IMAGES_JSON__', json.dumps(imgs, ensure_ascii=False))
tpl = tpl.replace('__FIRST_IMG__', imgs[0]['src'])
assert '__IMAGES_JSON__' not in tpl and '__FIRST_IMG__' not in tpl

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(tpl)
print('index.html written: %.2f MB, %d images' % (os.path.getsize('index.html') / 1e6, len(imgs)))
