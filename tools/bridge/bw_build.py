"""场景构建：把桥接导出的 scene.json 变成 .blend

用法：
  Blender -b --factory-startup --python bw_build.py -- <scene.json> [--out scene.blend] [--look clay|match]

- 每个模型：导入 glb → 归一化（最长边 = modelSize，XZ 居中，底面贴地）
  → 挂到一个 Empty 上（位置/朝向/缩放由渲染器每帧驱动）
- 颜色：modelColorMode=solid 用纯色覆盖；original 保留原材质
- 地面：工程 groundColor；灯光：clay 用三点布光，match 用更平的舞台光
"""
import json
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bw_common import hex_to_linear, pos_to_blender, three_euler_to_quat  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if not argv:
    raise SystemExit("需要 scene.json 路径")
SCENE_JSON = os.path.abspath(argv[0])
OUT_BLEND = os.path.abspath(argv[argv.index("--out") + 1]) if "--out" in argv else \
    os.path.join(os.path.dirname(SCENE_JSON), "scene.blend")
LOOK = argv[argv.index("--look") + 1] if "--look" in argv else "clay"

cfg = json.load(open(SCENE_JSON, encoding="utf-8"))
proj = cfg["project"]
base_dir = os.path.dirname(SCENE_JSON)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = int(proj.get("fps", 24))
scene.render.resolution_x = proj.get("width", 1280)
scene.render.resolution_y = proj.get("height", 720)
scene.render.resolution_percentage = 100
scene.render.engine = 'BLENDER_EEVEE'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'

# ---------------------------------------------------------------- ground
bpy.ops.mesh.primitive_plane_add(size=600, location=(0, 0, -0.002))
ground = bpy.context.object
ground.name = "Bridge_Ground"
gmat = bpy.data.materials.new("Ground")
gmat.use_nodes = True
gbsdf = gmat.node_tree.nodes.get("Principled BSDF")
if gbsdf is None:
    gbsdf = next(n for n in gmat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
gbsdf.inputs["Base Color"].default_value = hex_to_linear(proj.get("groundColor", "#41494c"))
gbsdf.inputs["Roughness"].default_value = 0.92
ground.data.materials.append(gmat)

# ---------------------------------------------------------------- world
world = bpy.data.worlds.new("BridgeWorld")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
if LOOK == "clay":
    bg.inputs[0].default_value = (0.045, 0.055, 0.065, 1.0)
    bg.inputs[1].default_value = 0.55
else:
    bg.inputs[0].default_value = (0.075, 0.095, 0.105, 1.0)
    bg.inputs[1].default_value = 0.8


# ---------------------------------------------------------------- materials
def clay_material(name, hex_color, rough=0.62):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    if b is None:
        b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = hex_to_linear(hex_color)
    b.inputs["Roughness"].default_value = rough
    return m


_material_cache = {}


def apply_look(obj, model):
    """solid → 纯色覆盖；original → 保留原材质但统一粗糙度。"""
    mode = model.get("colorMode", "original")
    tint = model.get("tint", "#b8b8b8")
    if mode == "solid":
        key = ("solid", tint.lower())
        mat = _material_cache.get(key)
        if mat is None:
            mat = clay_material(f"Solid_{tint}", tint)
            _material_cache[key] = mat
        targets = [o for o in obj.children_recursive if o.type == 'MESH']
        for mesh in targets:
            mesh.data.materials.clear()
            mesh.data.materials.append(mat)
        return
    # original: 保留材质颜色，统一粗糙度，避免镜面高光破坏白模观感
    for mesh in [o for o in obj.children_recursive if o.type == 'MESH']:
        for slot in mesh.material_slots:
            m = slot.material
            if not m or not m.use_nodes:
                continue
            b = m.node_tree.nodes.get("Principled BSDF")
            if b is None:
                b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if b:
                b.inputs["Roughness"].default_value = max(0.45, b.inputs["Roughness"].default_value)


# ---------------------------------------------------------------- models
def world_bbox(objects):
    lo = Vector((1e18, 1e18, 1e18))
    hi = Vector((-1e18, -1e18, -1e18))
    for o in objects:
        if o.type != 'MESH':
            continue
        for corner in o.bound_box:
            p = o.matrix_world @ Vector(corner)
            for i in range(3):
                lo[i] = min(lo[i], p[i])
                hi[i] = max(hi[i], p[i])
    return lo, hi


spawned = []
for model in cfg["objects"]:
    src = model["src"]
    if not os.path.isabs(src):
        src = os.path.normpath(os.path.join(base_dir, src))
    if not os.path.exists(src):
        print(f"[warn] 缺少资产 {src}")
        continue
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=src)
    imported = [o for o in bpy.data.objects if o not in before]
    # Blender 的 glTF 导入器会为骨骼创建 Icosphere 形状辅助对象；
    # three.js 侧没有它，必须删掉，否则会被算进归一化包围盒、也会被渲染出来。
    helpers = [o for o in imported
               if o.type == 'MESH' and o.parent is None
               and o.data.name.startswith("Icosphere")]
    for h in helpers:
        imported.remove(h)
        bpy.data.objects.remove(h, do_unlink=True)
    roots = [o for o in imported if o.parent is None]
    meshes = [o for o in imported if o.type == 'MESH']
    if not meshes:
        print(f"[warn] {model['id']} 没有网格，跳过")
        continue
    bpy.context.view_layer.update()
    lo, hi = world_bbox(meshes)
    size = hi - lo
    longest = max(size.x, size.y, size.z)
    if longest <= 1e-6:
        continue
    factor = float(model.get("modelSize") or 1.0) / longest
    center = (lo + hi) * 0.5
    # 先把资产在自身坐标系里居中、底面贴地
    offset = Vector((-center.x, -center.y, -lo.z))
    for r in roots:
        r.location = r.location + offset
    bpy.context.view_layer.update()

    pivot = bpy.data.objects.new(f"PIVOT_{model['id']}", None)
    bpy.context.scene.collection.objects.link(pivot)
    pivot.empty_display_size = 0.3
    for r in roots:
        r.parent = pivot
        r.matrix_parent_inverse = pivot.matrix_world.inverted()
    pivot.scale = (factor, factor, factor)
    pivot["bridge_model_id"] = model["id"]
    pivot["bridge_scale"] = factor

    holder = bpy.data.objects.new(f"MODEL_{model['id']}", None)
    bpy.context.scene.collection.objects.link(holder)
    pivot.parent = holder
    holder["bridge_id"] = model["id"]

    apply_look(pivot, model)
    # 隐藏对象必须连子对象一起隐藏，否则父级 hide_render 不会挡住网格
    if model.get("hidden"):
        for o in [pivot] + list(pivot.children_recursive):
            o.hide_render = True
            o.hide_viewport = True
    p = pos_to_blender(model.get("position", [0, 0, 0]))
    holder.location = p
    holder.rotation_mode = 'QUATERNION'
    holder.rotation_quaternion = three_euler_to_quat(
        model.get("rotationX", 0), model.get("rotation", 0), model.get("rotationZ", 0))
    spawned.append(model["id"])
    print(f"[model] {model['id']:16s} 面数={sum(len(o.data.polygons) for o in meshes):7d} "
          f"归一化={factor:.4f} 隐藏={model.get('hidden')}")

# ---------------------------------------------------------------- lights
if LOOK == "clay":
    bpy.ops.object.light_add(type='SUN', location=(10, -12, 16))
    sun = bpy.context.object
    sun.data.energy = 3.4
    sun.data.angle = 0.09
    sun.rotation_euler = (0.72, 0.05, 0.55)
    bpy.ops.object.light_add(type='AREA', location=(-14, 12, 9))
    rim = bpy.context.object
    rim.data.energy = 2600
    rim.data.size = 8.0
    rim.rotation_euler = (1.05, 0, -2.3)
    bpy.ops.object.light_add(type='AREA', location=(16, 8, 5))
    fill = bpy.context.object
    fill.data.energy = 700
    fill.data.size = 10.0
    fill.rotation_euler = (1.25, 0, 1.95)
else:
    bpy.ops.object.light_add(type='SUN', location=(8, -10, 14))
    sun = bpy.context.object
    sun.data.energy = 2.6
    sun.data.angle = 0.2
    sun.rotation_euler = (0.65, 0.0, 0.5)
    bpy.ops.object.light_add(type='AREA', location=(-12, 10, 8))
    rim = bpy.context.object
    rim.data.energy = 1200
    rim.data.size = 10.0
    rim.rotation_euler = (1.0, 0, -2.2)

for name, obj in (("Sun", sun), ("Rim", rim)):
    obj.data.use_shadow = True

# ---------------------------------------------------------------- camera
cam_data = bpy.data.cameras.new("BridgeCam")
cam_data.sensor_fit = 'VERTICAL'
cam_data.angle_y = 0.8
cam = bpy.data.objects.new("BridgeCam", cam_data)
bpy.context.scene.collection.objects.link(cam)
scene.camera = cam

# ---------------------------------------------------------------- render tuning
scene.eevee.taa_render_samples = 32
scene.eevee.use_raytracing = True
scene.eevee.use_fast_gi = True
try:
    scene.eevee.fast_gi_distance = 4.0
except Exception:
    pass
scene.view_settings.view_transform = 'AgX'
try:
    scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass

bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print(f"BUILT {len(spawned)} models → {OUT_BLEND}")
