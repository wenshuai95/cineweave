"""桥接渲染器：按工程的 shots 逐镜、逐帧还原相机与模型，渲染 PNG。

用法：
  Blender -b scene.blend --python bw_render.py -- <scene.json> [选项]
选项：
  --shots cut-01,cut-10   只渲指定镜头
  --limit N               每镜只渲前 N 帧（验证用）
  --scale 0.5             分辨率缩放
  --out DIR               输出目录（默认 scene.json 同级的 frames/）
  --samples N             EEVEE 采样（默认 32）

角色动画：每个角色按自己的动作表采样（不同角色速度不同），
因此逐帧先把每个角色摆到自己的时间点，取矩阵落盘到内存，再统一渲染。
"""
import json
import os
import sys
import time

import bpy
from mathutils import Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bw_common import (camera_transform, pos_to_blender,  # noqa: E402
                       sample_camera, sample_object, three_euler_to_quat)

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SCENE_JSON = os.path.abspath(argv[0])
cfg = json.load(open(SCENE_JSON, encoding="utf-8"))
FPS = cfg["project"].get("fps", 24)
BASE = os.path.dirname(SCENE_JSON)

shots_filter = set(argv[argv.index("--shots") + 1].split(",")) if "--shots" in argv else None
limit = int(argv[argv.index("--limit") + 1]) if "--limit" in argv else 0
scale = float(argv[argv.index("--scale") + 1]) if "--scale" in argv else 1.0
out_dir = argv[argv.index("--out") + 1] if "--out" in argv else os.path.join(BASE, "frames")
samples = int(argv[argv.index("--samples") + 1]) if "--samples" in argv else 32

scene = bpy.context.scene
scene.render.fps = FPS
# H.264 要求偶数尺寸；浮点缩放后会得到 251 这类奇数，取整到偶数
width = int(round(cfg["project"].get("width", 1280) * scale))
height = int(round(cfg["project"].get("height", 720) * scale))
scene.render.resolution_x = width - width % 2
scene.render.resolution_y = height - height % 2
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.eevee.taa_render_samples = samples
cam = bpy.data.objects["BridgeCam"]
scene.camera = cam
cam.data.sensor_fit = 'VERTICAL'

# ---------------------------------------------------------------- 索引
models = {m["id"]: m for m in cfg["objects"]}
holders = {}
characters = {}   # model_id -> armature object
object_anims = {}  # model_id -> [(object, 原始 action)]
for m in cfg["objects"]:
    holder = bpy.data.objects.get(f"MODEL_{m['id']}")
    if not holder:
        print(f"[warn] 场景里没有 MODEL_{m['id']}")
        continue
    holders[m["id"]] = holder
    arm = next((c for c in holder.children_recursive if c.type == 'ARMATURE'), None)
    if arm is not None:
        characters[m["id"]] = arm
        continue
    # 方盒巨妖这类没有蒙皮的模型：动作挂在多个对象上
    animated = [(o, o.animation_data.action) for o in holder.children_recursive
                if o.animation_data and o.animation_data.action]
    if animated:
        object_anims[m["id"]] = animated

print(f"载入：模型 {len(holders)}，可动角色 {len(characters)}，镜头 {len(cfg['shots'])}")

# ---------------------------------------------------------------- 动作查找
def find_action(clip_name):
    if not clip_name:
        return None
    act = bpy.data.actions.get(clip_name)
    if act:
        return act
    # glTF 重名时 Blender 会加后缀
    for a in bpy.data.actions:
        if a.name.split('.')[0] == clip_name:
            return a
    return None


def set_character_time(arm, clip_name, action_time):
    """把角色切到指定片段/时刻，返回所有骨骼的 matrix_basis 快照。"""
    act = find_action(clip_name)
    if arm.animation_data is None:
        arm.animation_data_create()
    if act is not None:
        arm.animation_data.action = act
        if hasattr(arm.animation_data, "action_slot") and act.slots:
            arm.animation_data.action_slot = act.slots[0]
    frame = action_time * FPS
    fi = int(frame)
    scene.frame_set(fi, subframe=frame - fi)
    return {pb.name: pb.matrix_basis.copy() for pb in arm.pose.bones}


def apply_snapshot(arm, snap):
    for pb in arm.pose.bones:
        m = snap.get(pb.name)
        if m is not None:
            pb.matrix_basis = m


def set_object_time(animated, clip_name, action_time):
    """把对象级动画模型切到指定片段/时刻，返回各对象 matrix_basis 快照。

    这些模型（方块巨妖）的全部部件共享同一个 Action，各对象通过自己的 ActionSlot
    取到对应曲线；重新指定 action 时必须保留各自 slot，否则会串骨架。
    """
    frame = action_time * FPS
    fi = int(frame)
    act = find_action(clip_name)
    for obj, original in animated:
        if obj.animation_data is None:
            obj.animation_data_create()
        current = obj.animation_data.action
        if act is not None and current is not act:
            keep_slot = getattr(obj.animation_data, "action_slot", None)
            obj.animation_data.action = act
            if hasattr(obj.animation_data, "action_slot") and act.slots:
                slot = next((s for s in act.slots
                             if getattr(s, "target_id_type", "") == "OBJECT"
                             and getattr(s, "name_display", "") in (obj.name, obj.data.name if obj.data else "")
                             ), None)
                obj.animation_data.action_slot = slot or keep_slot or act.slots[0]
        elif act is None and current is None:
            obj.animation_data.action = original
    scene.frame_set(fi, subframe=frame - fi)
    return {obj.name: obj.matrix_basis.copy() for obj, _ in animated}


def clear_object_animation(animated):
    for obj, _ in animated:
        if obj.animation_data:
            obj.animation_data.action = None


def apply_object_snapshot(animated, snap):
    for obj, _ in animated:
        m = snap.get(obj.name)
        if m is not None:
            obj.matrix_basis = m


def clear_animation(arm):
    if arm.animation_data:
        arm.animation_data.action = None


# ---------------------------------------------------------------- 渲染
def render_shot(shot):
    cam_cfg = next((c for c in cfg["cameras"] if c["id"] == shot["cameraId"]), None)
    if cam_cfg is None:
        print(f"[warn] 镜头 {shot['id']} 找不到机位 {shot['cameraId']}")
        return 0
    f0 = float(shot["start"])
    frames = max(1, round((float(shot["end"]) - f0) * FPS))
    if limit:
        frames = min(frames, limit)
    shot_dir = os.path.join(out_dir, shot["id"])
    os.makedirs(shot_dir, exist_ok=True)

    t0 = time.time()
    for i in range(frames):
        t = f0 + i / FPS
        # 1) 相机
        cs = sample_camera(cam_cfg, t)
        p, q = camera_transform(cs["position"], cs["target"], cs.get("roll", 0))
        cam.location = p
        cam.rotation_mode = 'QUATERNION'
        cam.rotation_quaternion = q
        cam.data.angle_y = __import__("math").radians(cs["fov"])

        # 2) 静态模型 + 角色对象位姿
        snapshots = {}
        for mid, holder in holders.items():
            model = models[mid]
            st = sample_object(model, t)
            holder.location = pos_to_blender(st["position"])
            holder.rotation_mode = 'QUATERNION'
            holder.rotation_quaternion = three_euler_to_quat(
                st["rotationX"], st["rotation"], st["rotationZ"])
            s = float(st["scale"])
            holder.scale = (s, s, s)
            arm = characters.get(mid)
            if arm is not None and st.get("modelClip"):
                snapshots[mid] = ("armature", arm, set_character_time(arm, st["modelClip"], st["actionTime"]))
            elif mid in object_anims and st.get("modelClip"):
                snapshots[mid] = ("objects", object_anims[mid],
                                  set_object_time(object_anims[mid], st["modelClip"], st["actionTime"]))

        # 3) 统一落位后渲染
        for mid, (kind, target, snap) in snapshots.items():
            if kind == "armature":
                clear_animation(target)
                apply_snapshot(target, snap)
            else:
                clear_object_animation(target)
                apply_object_snapshot(target, snap)
        bpy.context.view_layer.update()

        scene.render.filepath = os.path.join(shot_dir, f"{shot['id']}_{i:04d}.png")
        bpy.ops.render.render(write_still=True)

    dt = time.time() - t0
    print(f"RENDERED {shot['id']} frames={frames} {dt:.1f}s ({dt / frames:.2f}s/帧)", flush=True)
    return frames


todo = [s for s in cfg["shots"] if not shots_filter or s["id"] in shots_filter]
total = 0
for shot in todo:
    total += render_shot(shot)
print(f"ALL_DONE frames={total}")
