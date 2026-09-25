#!/usr/bin/env python3
"""Walkthrough video along the corridor of the Hanging Temple.
Camera path: start east of the deck -> dolly west along the corridor ->
incense burner closeup -> continue west -> pull back to alcove view.
Renders EEVEE frames to output/video/frames/, then ffmpeg encodes mp4."""
import bpy
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BLEND = os.path.join(ROOT, 'output', 'model', 'hanging_temple.blend')
FRAMES = os.path.join(ROOT, 'output', 'video', 'frames')
os.makedirs(FRAMES, exist_ok=True)
START = int(argv[0]) if argv else 1
END = int(argv[1]) if len(argv) > 1 else 480

bpy.ops.wm.open_mainfile(filepath=BLEND)
scene = bpy.context.scene

# ---------------- camera path (keyframed bezier) ----------------
# waypoints: (pos, look_at, time)
# times in frames @30fps
FPS = 30
PATH = [
    # pos, target, frame
    ((26.0, 8.0, 21.5), (-2.0, 0.0, 19.0), 1),      # start outside east
    ((18.5, 3.2, 19.8), (-6.0, 0.5, 18.8), 55),     # step onto deck, walk west
    ((8.0, 3.0, 19.6), (-6.0, 0.8, 18.6), 110),    # along corridor
    ((-1.0, 2.9, 19.5), (-2.0, 1.55, 18.9), 165),   # approach burner
    ((-0.55, 2.35, 19.05), (-2.0, 1.55, 18.75), 200),  # burner closeup
    ((-0.55, 2.35, 19.05), (-2.0, 1.55, 18.75), 240),  # hold closeup
    ((-6.0, 3.0, 19.6), (-12.0, 0.0, 19.5), 300),   # continue west
    ((-14.0, 3.6, 20.2), (-14.5, -2.0, 22.0), 350), # west end, look up at west hall
    ((-16.5, 7.0, 22.5), (-10.0, -2.0, 21.0), 410), # pull back
    ((-22.0, 14.0, 26.0), (-4.0, -2.0, 19.5), 480), # rise to overview
]

def bezier(p0, p1, p2, p3, t):
    mt = 1 - t
    return (mt**3 * p0[0] + 3*mt*mt*t * p1[0] + 3*mt*t*t * p2[0] + t**3 * p3[0],
            mt**3 * p0[1] + 3*mt*mt*t * p1[1] + 3*mt*t*t * p2[1] + t**3 * p3[1],
            mt**3 * p0[2] + 3*mt*mt*t * p1[2] + 3*mt*t*t * p2[2] + t**3 * p3[2])

def catmull_rom(points, samples_per_seg=24):
    pts = [Vector(p) for p in points]
    if len(pts) < 2:
        return pts
    ext = [pts[0]] + pts + [pts[-1]]
    out = []
    for i in range(len(ext) - 3):
        p0, p1, p2, p3 = ext[i], ext[i+1], ext[i+2], ext[i+3]
        for s in range(samples_per_seg):
            t = s / samples_per_seg
            t2, t3 = t*t, t*t*t
            v = 0.5 * ((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3)
            out.append(v)
    out.append(pts[-1])
    return out

# build smooth position & target tracks
pos_keys = [Vector(p) for p, _, _ in PATH]
tgt_keys = [Vector(t) for _, t, _ in PATH]
pos_track = catmull_rom(pos_keys, 30)
tgt_track = catmull_rom(tgt_keys, 30)

# map frame -> track index (track spans frames 1..480)
N = len(pos_track)
def frame_to_idx(f):
    return min(N - 1, max(0, int((f - 1) / 479.0 * (N - 1))))

cam_data = bpy.data.cameras.new('漫游相机')
cam_data.lens = 24
cam_data.dof.use_dof = True
cam_data.dof.aperture_fstop = 7.0
cam = bpy.data.objects.new('漫游相机', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

# animate
total = 480
for f in range(1, total + 1):
    i = frame_to_idx(f)
    cam.location = pos_track[i]
    look = tgt_track[i]
    d = look - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    # subtle handheld bob
    bob = 0.035 * math.sin(f * 0.35)
    cam.location.z += bob
    cam.keyframe_insert(data_path='location', frame=f)
    cam.keyframe_insert(data_path='rotation_euler', frame=f)
    # DOF focus on target, tighter aperture at closeup segment
    if 165 <= f <= 245:
        cam_data.dof.aperture_fstop = 3.5
    else:
        cam_data.dof.aperture_fstop = 7.0
    cam_data.keyframe_insert(data_path='dof.aperture_fstop', frame=f)
cam_data.animation_data.action.fcurves[-1].keyframe_points  # noop

# ---------------- render settings (EEVEE) ----------------
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.render.filepath = os.path.join(FRAMES, 'frame_')
# use day world
scene.world = bpy.data.worlds.get('日景天空') or scene.world

# render range
for f in range(START, END + 1):
    scene.frame_set(f)
    scene.render.filepath = os.path.join(FRAMES, 'frame_%04d.png' % f)
    bpy.ops.render.render(write_still=True)
    if f % 30 == 0:
        print('FRAME', f, flush=True)

print('VIDEO FRAMES DONE', START, END)
