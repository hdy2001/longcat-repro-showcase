import bpy, math, mathutils
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="pagoda.glb")
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 800
scene.render.resolution_y = 800
world = bpy.data.worlds.new("W"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.80, 0.88, 1)
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", 'SUN'))
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
scene.collection.objects.link(sun)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam); scene.camera = cam
cam.data.lens = 50
# 塔刹特写
cam.location = (18, -20, 62)
d = mathutils.Vector((0,0,61)) - mathutils.Vector(cam.location)
cam.rotation_euler = d.to_track_quat('-Z','Y').to_euler()
scene.render.filepath = "workspace/diag_finial.png"
bpy.ops.render.render(write_still=True)
print("DONE")
