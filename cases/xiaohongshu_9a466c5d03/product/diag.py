import bpy, math, mathutils
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="pagoda.glb")
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 700
scene.render.resolution_y = 800
world = bpy.data.worlds.new("W"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.80, 0.88, 1)
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", 'SUN'))
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
scene.collection.objects.link(sun)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam); scene.camera = cam
cam.data.lens = 42

groups = ["0_台基","1_副阶","2_一层","3_暗层1","4_二层","5_暗层2","6_三层","7_暗层3","8_四层","9_暗层4","10_五层","11_塔刹"]
meshes = [o for o in scene.collection.objects if o.type == 'MESH']
for keep in groups:
    for o in meshes:
        o.hide_render = not o.name.startswith(keep.split("_")[0] + "_") or o.parent.name != keep
    # simpler: show only objects whose top-level parent matches
    for o in meshes:
        top = o
        while top.parent: top = top.parent
        o.hide_render = (top.name != keep)
    loc = (46, -50, 30)
    cam.location = loc
    d = mathutils.Vector((0,0,24)) - mathutils.Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = f"workspace/diag_{keep.split('_')[1]}.png"
    bpy.ops.render.render(write_still=True)
print("DIAG DONE")
