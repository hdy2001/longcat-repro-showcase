#!/usr/bin/env python3
"""材质分析图: 6 material swatches cropped from real renders + property table."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = 'workspace'
REN = ROOT + '/output/renders'
OUT = REN + '/material_analysis.png'

def font(sz):
    for p in ['/System/Library/Fonts/STHeiti Medium.ttc',
              '/System/Library/Fonts/STHeiti Light.ttc',
              '/System/Library/Fonts/Songti.ttc']:
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            continue
    return ImageFont.load_default()

F_TITLE = font(40)
F_H = font(24)
F = font(18)
F_SM = font(14)

# swatch crops from renders: (source, box in source px, name, en, props)
# sources are 1920x1080 (day_hero) or 1600x900 (others)
day = Image.open(REN + '/day_hero.png').convert('RGB')
eave = Image.open(REN + '/view_eave.png').convert('RGB')
cant = Image.open(REN + '/view_cantilever.png').convert('RGB')

def crop_center(img, cx, cy, w, h):
    return img.crop((cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2))

swatches = [
    ('琉璃瓦', 'Glazed Tile', '金色釉面 · 屋面 · 反光0.32 金属0.08', crop_center(eave, 800, 300, 500, 350)),
    ('木材', 'Timber', '梁柱枋 · 朱红漆面 · 反光0.50', crop_center(cant, 800, 500, 500, 350)),
    ('木板', 'Wood Plank', '栈道铺板 · 水平拼缝 · 反光0.75', crop_center(cant, 500, 650, 500, 350)),
    ('砖墙', 'Brick Wall', '基座红墙 · 灰缝砌体 · 反光0.85', crop_center(day, 700, 950, 600, 250)),
    ('岩石', 'Rock', '恒山崖壁 · 沉积岩层理 · 反光0.93', crop_center(day, 1500, 250, 550, 400)),
    ('石材', 'Stone', '台基/柱础 · 青石 · 反光0.80', crop_center(eave, 400, 850, 450, 300)),
]

W, H = 1500, 1100
img = Image.new('RGB', (W, H), (250, 249, 247))
dr = ImageDraw.Draw(img, 'RGBA')

dr.text((50, 34), '悬空寺 · 材质分析', font=F_TITLE, fill=(28, 32, 40))
dr.text((52, 84), 'Material Analysis · 六类主要建材 · 程序化纹理 + PBR 参数', font=F_SM, fill=(110, 116, 126))
dr.line([(50, 110), (W - 50, 110)], fill=(28, 32, 40), width=2)

# swatch grid 3x2
cw, ch = 430, 300
x0, y0 = 50, 140
for i, (cn, en, props, sw) in enumerate(swatches):
    r, c = divmod(i, 3)
    x, y = x0 + c * (cw + 25), y0 + r * (ch + 60)
    sw = sw.resize((cw - 20, ch - 60), Image.LANCZOS)
    img.paste(sw, (x + 10, y + 10))
    dr.rectangle([x, y, x + cw - 20, y + ch - 60], outline=(180, 178, 172), width=1)
    dr.rectangle([x, y + ch - 60, x + cw - 20, y + ch], fill=(255, 253, 248))
    dr.text((x + 14, y + ch - 52), cn, font=F_H, fill=(28, 32, 40))
    dr.text((x + 14, y + ch - 26), en, font=F_SM, fill=(130, 120, 100))
    # props line below
    dr.text((x + 14, y + ch + 8), props, font=F_SM, fill=(90, 96, 104))

# side panel: material science notes
px = 50
py = 140 + 2 * (ch + 60) + 10
dr.text((px, py), '材质工艺说明', font=F_H, fill=(28, 32, 40))
notes = [
    '琉璃瓦: 黄色铅釉陶瓦, 屋面防水与等级象征; 筒瓦垄在 Blender 中以',
    '  参数化网格+凹凸贴图模拟, 瓦当滴水收边。',
    '木材: 华北落叶松/榆木, 立柱梁枋; 榫卯连接无铁钉, 表面朱红漆防腐。',
    '木板: 栈道悬挑铺板, 下由插入崖壁的悬挑梁(插入深度约2/3)承托。',
    '砖墙: 基座挡土墙, 青砖白灰砌筑, 顶部琉璃瓦檐口排水。',
    '岩石: 恒山砂岩/页岩互层, 水平层理; 寺庙依崖壁凹槽(天然雨棚)而建。',
    '石材: 青石台基与柱础(覆盆式), 隔潮并扩散柱底压应力。',
]
for i, t in enumerate(notes):
    dr.text((px, py + 36 + i * 26), t, font=F_SM, fill=(60, 66, 76))

# footer
dr.line([(50, H - 40), (W - 50, H - 40)], fill=(220, 218, 212), width=1)
dr.text((50, H - 28), '悬空寺数字建档 · 材质样本取自模型对应部位真实渲染区域裁剪', font=F_SM, fill=(140, 138, 132))

img.save(OUT, quality=95)
print('SAVED', OUT, img.size)
