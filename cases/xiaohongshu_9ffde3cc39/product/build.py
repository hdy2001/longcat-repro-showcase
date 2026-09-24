from PIL import Image
import base64, io, os

# 源图 720x1280 坐标系中的裁剪矩形 (l, t, r, b)
# 已裁掉：顶部小红书水印（logo + 用户名）、底部标题黑带（含 uniform_01 的右下角用户名/logo）
crops = {
    'uniform_01.jpg': (0, 72, 720, 1000),
    'uniform_02.jpg': (0, 85, 720, 1070),
    'uniform_03.jpg': (0, 85, 720, 1079),
    'uniform_04.jpg': (0, 85, 720, 1079),
    'uniform_05.jpg': (0, 85, 720, 1079),
    'uniform_06.jpg': (0, 85, 720, 1079),
    'uniform_07.jpg': (0, 85, 720, 1079),
    'uniform_08.jpg': (0, 85, 720, 1079),
    'uniform_09.jpg': (0, 85, 720, 1079),
}

EMBED_W = 480  # 内嵌图宽（采样仅用 240px，480 足够且控制体积）

entries = []
for f in sorted(crops):
    im = Image.open(os.path.join('inputs', f)).convert('RGB')
    w, h = im.size
    nh = round(h * EMBED_W / w)
    im = im.resize((EMBED_W, nh), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=78, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    l, t, r, b = crops[f]
    sx = EMBED_W / w
    crop_scaled = [round(l * sx), round(t * sx), round(r * sx), round(b * sx)]
    entries.append((f, b64, crop_scaled))
    print(f'{f}: embedded {EMBED_W}x{nh}, b64={len(b64)} chars, crop={crop_scaled}')

images_js = ',\n  '.join(
    '{ src: "data:image/jpeg;base64,%s", crop: [%d, %d, %d, %d] }' % (b64, *crop)
    for _, b64, crop in entries
)

with open('template.html', encoding='utf-8') as fh:
    tpl = fh.read()
assert tpl.count('__IMAGES__') == 1
html = tpl.replace('__IMAGES__', images_js)
with open('index.html', 'w', encoding='utf-8') as fh:
    fh.write(html)
print(f'index.html written: {len(html)/1024:.0f} KB')
