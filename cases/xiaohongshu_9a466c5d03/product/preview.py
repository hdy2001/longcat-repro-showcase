import bpy, math, sys
from math import sin, cos, radians
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="pagoda.glb")
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 900
scene.render.resolution_y = 1100
scene.render.film_transparent = False
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.80, 0.88, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", 'SUN'))
sun.data.energy = 3.5
sun.rotation_euler = (radians(50), 0, radians(30))
scene.collection.objects.link(sun)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam)
scene.camera = cam
views = {
    "front": ((58, -62, 34), (0, 0, 26)),
    "close": ((30, -34, 18), (0, 0, 12)),
    "top":   ((0.5, -0.5, 105), (0, 0, 20)),
    "inside": ((8, -8, 30), (0, 0, 30)),
}
for name, (loc, tgt) in views.items():
    cam.location = loc
    d = (tgt[0]-loc[0], tgt[1]-loc[1], tgt[2]-loc[2])
    cam.rotation_euler = (
        math.atan2(math.hypot(d[0], d[1]), -d[2]) if False else 0, 0, 0)
    # point camera at target
    import mathutils
    direction = mathutils.Vector(tgt) - mathutils.Vector(loc)
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 42
    scene.render.filepath = f"workspace/preview_{name}.png"
    bpy.ops.render.render(write_still=True)
print("PREVIEWS DONE")
