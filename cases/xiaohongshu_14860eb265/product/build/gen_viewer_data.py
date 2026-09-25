#!/usr/bin/env python3
"""Convert hanging_temple.glb into a JS data file with base64 data URI."""
import base64, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
glb = os.path.join(ROOT, 'output', 'model', 'hanging_temple.glb')
out = os.path.join(ROOT, 'output', 'viewer', 'data.js')

data = open(glb, 'rb').read()
b64 = base64.b64encode(data).decode('ascii')
uri = 'data:model/gltf-binary;base64,' + b64
with open(out, 'w') as f:
    f.write('// Auto-generated: GLB model as base64 data URI (%.1f MB)\n' % (len(data) / 1e6))
    f.write('window.GLB_DATA_URI = "%s";\n' % uri)
print('data.js written: %.2f MB' % (os.path.getsize(out) / 1e6))
