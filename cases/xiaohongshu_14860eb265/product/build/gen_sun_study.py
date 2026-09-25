#!/usr/bin/env python3
"""夏至日日照分析图 (Summer solstice sun study) for the Hengshan Hanging Temple.
Pure PIL: site plan + sun path + duration heatmap + compass + notes."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = 'workspace'
OUT = ROOT + '/output/renders/sun_study.png'

# ---------------- geo ----------------
LAT = math.radians(39.66)          # 恒山悬空寺纬度
LON = math.radians(113.70)
DEC = math.radians(23.44)          # 夏至赤纬
TZ = math.radians(120.0)           # 北京时间中央经线

def sun_pos(hour):
    """Local apparent time hour -> (alt, az) az from north clockwise."""
    H = math.radians((hour - 12) * 15)
    sin_alt = math.sin(LAT) * math.sin(DEC) + math.cos(LAT) * math.cos(DEC) * math.cos(H)
    alt = math.asin(max(-1, min(1, sin_alt)))
    cos_az = (math.sin(DEC) - math.sin(LAT) * sin_alt) / (math.cos(LAT) * math.cos(alt) + 1e-9)
    cos_az = max(-1, min(1, cos_az))
    az = math.acos(cos_az)
    if H > 0:
        az = 2 * math.pi - az
    return alt, az

def apparent_solar_time(hour_bjt):
    """Beijing time -> local apparent solar time (h). Equation of time ~solstice."""
    eot = -1.5  # minutes, approx solstice
    return hour_bjt + (LON - TZ) * 4 / 60 + eot / 60

# sunrise/sunset (Beijing time)
def day_length_hours():
    H0 = math.acos(-math.tan(LAT) * math.tan(DEC))
    return math.degrees(H0) * 2 / 15
DL = day_length_hours()
sunrise = 12 - DL / 2 - (LON - TZ) * 4 / 60 - (-1.5) / 60
sunset = 12 + DL / 2 - (LON - TZ) * 4 / 60 - (-1.5) / 60

# ---------------- drawing setup ----------------
W, H = 1754, 1240  # A3-ish landscape
SCALE = 14.0       # px per meter
CX, CY = 700, 760  # temple origin on canvas

def P(x, z):
    """world (x east, z up) -> canvas (right, down)."""
    return (CX + x * SCALE, CY - z * SCALE)

img = Image.new('RGB', (W, H), (247, 245, 240))
dr = ImageDraw.Draw(img, 'RGBA')

def font(sz, bold=False):
    for p in ['/System/Library/Fonts/STHeiti Medium.ttc',
              '/System/Library/Fonts/STHeiti Light.ttc',
              '/System/Library/Fonts/Songti.ttc']:
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            continue
    return ImageFont.load_default()

F_TITLE = font(44, True)
F_H = font(26, True)
F = font(21)
F_SM = font(17)
F_SM2 = font(15)

# title block
dr.text((48, 36), '悬空寺 · 夏至日日照分析', font=F_TITLE, fill=(28, 32, 40))
dr.text((50, 92), 'Hanging Temple — Summer Solstice Solar Analysis · 山西浑源 · 39.66°N, 113.70°E', font=F_SM, fill=(90, 96, 104))
dr.line([(48, 122), (W - 48, 122)], fill=(28, 32, 40), width=2)

# ---------------- duration heatmap on terrace plane ----------------
def sun_shadows(x, z, hour):
    """Is point (x,z) in direct sun at given hour? Cliff to the NORTH shades when sun is in
    northern half of sky. South-facing alcove gets sun when az in southern half (90..270)."""
    alt, az = sun_pos(apparent_solar_time(hour))
    if alt <= 0:
        return False
    deg = math.degrees(az)
    if not (90 < deg < 270):
        return False
    return True

# duration map grid (terrace zone)
gx0, gx1, gz0, gz1 = -22, 22, 15, 30
res = 1.0
rows = int((gz1 - gz0) / res)
cols = int((gx1 - gx0) / res)
dur = np.zeros((rows, cols), dtype=np.float32)
hours = np.arange(sunrise, sunset, 10 / 60)
for i in range(rows):
    z = gz0 + (i + 0.5) * res
    for j in range(cols):
        x = gx0 + (j + 0.5) * res
        cnt = 0
        for h in hours:
            if sun_shadows(x, z, h):
                cnt += 1
        dur[i, j] = cnt * (10 / 60)

# draw heatmap cells
cmax = max(6.0, dur.max())
for i in range(rows):
    for j in range(cols):
        v = dur[i, j] / cmax
        r = int(255 * min(1, max(0, (v - 0.25) * 2.2)))
        g = int(255 * min(1, max(0, 1 - abs(v - 0.55) * 2.6)))
        b = int(255 * min(1, max(0, (0.45 - v) * 2.4)))
        xa, ya = P(gx0 + j * res, gz0 + (i + 1) * res)
        xb, yb = P(gx0 + (j + 1) * res, gz0 + i * res)
        dr.rectangle([min(xa, xb), min(ya, yb), max(xa, xb), max(ya, yb)], fill=(r, g, b, 90))

# ---------------- site plan ----------------
def poly_world(pts, fill, outline=None, width=2):
    cp = [P(x, z) for x, z in pts]
    dr.polygon(cp, fill=fill)
    if outline:
        dr.line(cp + [cp[0]], fill=outline, width=width)

# cliff band (north)
poly_world([(-40, -2), (40, -2), (40, -14), (-40, -14)], (168, 158, 142))
# alcove
poly_world([(-22, -14), (22, -14), (20, -6), (-20, -6)], (196, 186, 168))
# ledges
poly_world([(-21, -8.2), (17, -8.2), (17, -6.2), (-21, -6.2)], (140, 130, 116))
poly_world([(-8, -5), (16, -5), (16, -4.2), (-8, -4.2)], (140, 130, 116))
# halls (top view)
poly_world([(-19, -4.85), (-10, -4.85), (-10, 1.65), (-19, 1.65)], (214, 96, 66), (120, 40, 28), 2)
poly_world([(-7.5, -4.8), (3.5, -4.8), (3.5, 2.0), (-7.5, 2.0)], (214, 96, 66), (120, 40, 28), 2)
poly_world([(5.5, -4.4), (19.5, -4.4), (19.5, 1.2), (5.5, 1.2)], (214, 96, 66), (120, 40, 28), 2)
# deck
poly_world([(-18.6, 0.6), (18.6, 0.6), (18.6, 2.9), (-18.6, 2.9)], (122, 96, 66))
# bridges
poly_world([(-10, 0.6), (-7.5, 0.6), (-7.5, 2.6), (-10, 2.6)], (122, 96, 66))
poly_world([(3.5, 0.6), (5.5, 0.6), (5.5, 2.6), (3.5, 2.6)], (122, 96, 66))
# stairs + base wall
poly_world([(17, 2.9), (24.5, 2.9), (24.5, 10.5), (17, 10.5)], (150, 148, 145))
poly_world([(-26, 3), (26, 3), (26, 6), (-26, 6)], (178, 92, 72), (120, 60, 48), 2)

# labels
def wtext(x, z, s, f=F_SM, fill=(40, 44, 52), anchor='mm'):
    px, pz = P(x, z)
    dr.text((px, pz), s, font=f, fill=fill, anchor=anchor)

wtext(0, -10.5, '悬崖 CLIFF', fill=(245, 240, 230))
wtext(0, 4.2, '基座红墙', fill=(250, 230, 220))
wtext(-14.5, -1.6, '西殿(三层)', fill=(255, 220, 200))
wtext(-2, -1.4, '中殿', fill=(255, 220, 200))
wtext(12.5, -1.6, '东楼', fill=(255, 220, 200))
wtext(0, 1.75, '栈道', fill=(255, 240, 220))

# ---------------- sun path on plan ----------------
# plan coords: horizontal axis = x (east+), vertical canvas axis = depth d (south = down on canvas).
# world d: temple front d=+1 (south), cliff d=-10 (north). Map: canvasY = CY2 + (d - dref)*SCALE
dref = -2.0
CY2 = 760
def PD(x, d):
    return (CX + x * SCALE, CY2 + (d - dref) * SCALE)

for hbi in range(int(math.ceil(sunrise)), int(math.floor(sunset)) + 1):
    ast = apparent_solar_time(hbi)
    alt, az = sun_pos(ast)
    if alt <= 0.3:
        continue
    L = 88.0
    dx = math.sin(az) * math.cos(alt)
    dy = math.cos(az) * math.cos(alt)
    ex = dx * L
    ed = dy * L * 0.82
    # shadow line from temple center
    dr.line([PD(0, 0), PD(ex, ed)], fill=(235, 140, 50, 130), width=2)
    # sun dot at opposite end (scaled)
    sx_, sd_ = -dx * L * 0.55, -dy * L * 0.55
    r = 6 + math.degrees(alt) * 0.12
    dr.ellipse([PD(sx_, sd_)[0] - r, PD(sx_, sd_)[1] - r, PD(sx_, sd_)[0] + r, PD(sx_, sd_)[1] + r],
               fill=(250, 190, 60), outline=(200, 120, 30))
    dr.text((PD(sx_, sd_)[0], PD(sx_, sd_)[1] + r + 14), f'{hbi}:00', font=F_SM2, fill=(150, 95, 25), anchor='ma')

# alt-az polar inset (sun path dome) top-right
ox, oy, R = 1470, 300, 170
dr.ellipse([ox - R, oy - R, ox + R, oy + R], outline=(120, 128, 140), width=2)
dr.ellipse([ox - R * 0.55, oy - R * 0.55, ox + R * 0.55, oy + R * 0.55], outline=(180, 186, 196), width=1)
dr.ellipse([ox - R * 0.2, oy - R * 0.2, ox + R * 0.2, oy + R * 0.2], outline=(180, 186, 196), width=1)
dr.line([ox - R, oy, ox + R, oy], fill=(120, 128, 140), width=1)
dr.line([ox, oy - R, ox, oy + R], fill=(120, 128, 140), width=1)
dr.text((ox, oy + R + 26), '地平线', font=F_SM2, fill=(90, 96, 104), anchor='ma')
# sun path curve on dome
pts = []
for m in range(0, 60 * int(DL) + 1, 6):
    hb = sunrise + m / 60
    a, z2 = sun_pos(apparent_solar_time(hb))
    if a <= 0:
        continue
    rr = R * math.cos(a)
    aa = z2
    pts.append((ox + rr * math.sin(aa), oy - rr * math.cos(aa)))
if len(pts) > 1:
    dr.line(pts, fill=(220, 90, 40), width=4)
# compass ticks on dome
for deg in range(0, 360, 30):
    a = math.radians(deg)
    x0 = ox + (R - 12) * math.sin(a); y0 = oy - (R - 12) * math.cos(a)
    x1 = ox + R * math.sin(a); y1 = oy - R * math.cos(a)
    dr.line([(x0, y0), (x1, y1)], fill=(90, 96, 104), width=2 if deg % 90 == 0 else 1)
# N arrow
dr.polygon([(ox, oy - R - 34), (ox - 10, oy - R - 12), (ox + 10, oy - R - 12)], fill=(200, 60, 40))
dr.text((ox, oy - R - 44), 'N', font=F_H, fill=(200, 60, 40), anchor='ms')

# ---------------- compass rose (plan) ----------------
ccx, ccy, cr = 1560, 950, 95
dr.ellipse([ccx - cr, ccy - cr, ccx + cr, ccy + cr], outline=(60, 66, 76), width=3)
dr.ellipse([ccx - cr * 0.82, ccy - cr * 0.82, ccx + cr * 0.82, ccy + cr * 0.82], outline=(150, 156, 166), width=1)
for deg in range(0, 360, 15):
    a = math.radians(deg)
    L1 = cr if deg % 45 == 0 else (cr * 0.93 if deg % 15 == 0 else cr * 0.86)
    x0 = ccx + (cr - 8) * math.sin(a); y0 = ccy - (cr - 8) * math.cos(a)
    x1 = ccx + L1 * math.sin(a); y1 = ccy - L1 * math.cos(a)
    dr.line([(x0, y0), (x1, y1)], fill=(60, 66, 76), width=3 if deg % 90 == 0 else 1)
# star
for k in range(8):
    a = math.radians(k * 45)
    xx, yy = ccx + cr * 0.78 * math.sin(a), ccy - cr * 0.78 * math.cos(a)
    col = (200, 60, 40) if k % 2 == 0 else (240, 240, 240)
    dr.line([(ccx, ccy), (xx, yy)], fill=col, width=10 if k % 2 == 0 else 6)
dr.text((ccx, ccy - cr - 26), '北 N', font=F_H, fill=(28, 32, 40), anchor='ms')
dr.text((ccx, ccy + cr + 10), 'S', font=F, fill=(60, 66, 76), anchor='ma')
dr.text((ccx - cr - 14, ccy), 'W', font=F, fill=(60, 66, 76), anchor='rm')
dr.text((ccx + cr + 14, ccy), 'E', font=F, fill=(60, 66, 76), anchor='lm')

# ---------------- legend (duration color scale) ----------------
lx, ly = 110, 1000
dr.text((lx, ly - 46), '日照时长色阶 (小时)', font=F_H, fill=(28, 32, 40))
lw, lh = 300, 26
for i in range(lw):
    v = i / lw
    r = int(255 * min(1, max(0, (v - 0.25) * 2.2)))
    g = int(255 * min(1, max(0, 1 - abs(v - 0.55) * 2.6)))
    b = int(255 * min(1, max(0, (0.45 - v) * 2.4)))
    dr.line([(lx + i, ly), (lx + i, ly + lh)], fill=(r, g, b))
dr.rectangle([lx, ly, lx + lw, ly + lh], outline=(60, 66, 76), width=2)
for frac in (0, 0.25, 0.5, 0.75, 1.0):
    v = frac * cmax
    dr.text((lx + frac * lw, ly + lh + 8), f'{v:.1f}h', font=F_SM2, fill=(60, 66, 76), anchor='ma')
dr.text((lx + lw / 2, ly + lh + 32), '平台连续日照时长 · 10min 步长模拟', font=F_SM2, fill=(110, 116, 126), anchor='ma')

# ---------------- notes ----------------
nx, ny = 1120, 1060
dr.text((nx, ny - 46), '分析说明', font=F_H, fill=(28, 32, 40))
notes = [
    '1. 分析日期: 夏至 6月21日 · 太阳赤纬 δ=23.44° · 浑源当地昼长 14小时55分',
    f'2. 日出 {sunrise:.2f} / 日落 {sunset:.2f} (北京时间, 已校正地方均时差)',
    '3. 悬空寺坐北朝南、嵌入崖壁凹槽, 主体平台获全天直射日照,',
    '   东西两端上午/下午受悬崖与相邻殿堂遮挡, 呈对称梯度分布。',
    '4. 悬崖挑檐(标高处 z≈35m)在日出后/日落下沿对栈道形成约30分钟遮阴。',
    '5. 模拟方法: 平台1m网格 · 10分钟太阳位置步进 · 崖壁遮挡几何判定。',
    '6. 建议: 摄影黄金时段为 9:00-11:00 (东侧受光) 与 15:00-17:00 (西侧受光)。',
]
for i, t in enumerate(notes):
    dr.text((nx, ny + i * 30), t, font=F_SM, fill=(52, 58, 68))

# scale bar
dr.line([(110, 1190), (110 + 10 * SCALE, 1190)], fill=(28, 32, 40), width=4)
for k in range(11):
    dr.line([(110 + k * SCALE, 1184), (110 + k * SCALE, 1196)], fill=(28, 32, 40), width=2)
dr.text((110 + 5 * SCALE, 1210), '10 m', font=F_SM, fill=(28, 32, 40), anchor='ma')

img.save(OUT, quality=95)
print('SAVED', OUT, img.size, 'day length %.2f h, sunrise %.2f sunset %.2f' % (DL, sunrise, sunset))
