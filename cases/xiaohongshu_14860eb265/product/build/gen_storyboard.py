#!/usr/bin/env python3
"""九宫格分镜图: 3x3 storyboard of the Hanging Temple project."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = 'workspace'
REN = ROOT + '/output/renders'
OUT = REN + '/storyboard.png'

def font(sz):
    for p in ['/System/Library/Fonts/STHeiti Medium.ttc',
              '/System/Library/Fonts/Songti.ttc']:
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            continue
    return ImageFont.load_default()

F_TITLE = font(38)
F = font(19)
F_SM = font(14)

panels = [
    ('01 总览 · 日景', 'day_hero.png', 'overview · day'),
    ('02 正立面', 'view_front.png', 'south elevation'),
    ('03 侧向', 'view_side.png', 'east section'),
    ('04 俯视', 'view_top.png', 'plan'),
    ('05 悬挑结构', 'view_cantilever.png', 'cantilever detail'),
    ('06 走廊内视', 'view_corridor.png', 'corridor walk'),
    ('07 屋檐斗拱', 'view_eave.png', 'eave bracket'),
    ('08 夜景灯光', 'night_hero.png', 'night lanterns'),
    ('09 夕阳氛围', 'view_sunset.png', 'sunset'),
]

COLS, ROWS = 3, 3
CW, CH = 620, 380
PAD = 14
HEADER = 90
W = COLS * CW + (COLS + 1) * PAD
H = HEADER + ROWS * CH + (ROWS + 1) * PAD + 40

img = Image.new('RGB', (W, H), (24, 26, 30))
dr = ImageDraw.Draw(img, 'RGBA')

dr.text((W // 2, 30), '悬空寺 · 九宫格分镜', font=F_TITLE, fill=(240, 236, 230), anchor='ma')
dr.text((W // 2, 62), 'Hanging Temple · Storyboard · 从总览到细部的完整叙事', font=F_SM, fill=(150, 148, 142), anchor='ma')

for i, (label, fname, sub) in enumerate(panels):
    r, c = divmod(i, COLS)
    x = Pad + c * (CW + PAD)
    y = HEADER + PAD + r * (CH + PAD)
    p = os.path.join(REN, fname)
    if not os.path.exists(p):
        # placeholder
        tile = Image.new('RGB', (CW, CH), (40, 42, 48))
        dr_tile = ImageDraw.Draw(tile)
        dr_tile.text((CW // 2, CH // 2), fname + ' (missing)', font=F, fill=(150, 150, 150), anchor='mm')
    else:
        tile = Image.open(p).convert('RGB')
        # cover-fit
        tw, th = tile.size
        scale = max(CW / tw, CH / th)
        tile = tile.resize((int(tw * scale), int(th * scale)), Image.LANCZOS)
        ox = (tile.size[0] - CW) // 2
        oy = (tile.size[1] - CH) // 2
        tile = tile.crop((ox, oy, ox + CW, oy + CH))
    img.paste(tile, (x, y))
    # border + label
    dr.rectangle([x, y, x + CW, y + CH], outline=(60, 62, 70), width=2)
    dr.rectangle([x, y + CH - 44, x + CW, y + CH], fill=(20, 21, 25, 220))
    dr.text((x + 12, y + CH - 38), label, font=F, fill=(245, 220, 160))
    dr.text((x + 12, y + CH - 14), sub, font=F_SM, fill=(170, 168, 160))

dr.text((W // 2, H - 18), '01 鸟瞰全景 · 02 正立面 · 03 侧剖面 · 04 总平面 · 05 悬挑 · 06 走廊 · 07 斗拱 · 08 夜景 · 09 夕阳',
        font=F_SM, fill=(130, 128, 122), anchor='ma')

img.save(OUT, quality=95)
print('SAVED', OUT, img.size)
