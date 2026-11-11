"""把动作库骨架的片段重定向到角色身上，并导出带全部片段的新 GLB。

用法（Blender 无头运行）：
  Blender -b --factory-startup --python retarget_clips.py -- \
      --target <角色.glb> --source <动作库.glb> --out <输出.glb> \
      [--source-rig ual2|performer] [--clips "A,B,C"] [--prefix RT_] [--report report.json]

原理：逐帧把来源骨骼的 matrix_basis（相对自身 rest 的局部变换）复制到同义骨骼，
再烘焙成目标骨架上的新 Action。角色原有的 Action 会一起导出，不覆盖。
"""
import bpy
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bone_map  # noqa: E402


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = {"source_rig": "ual2", "prefix": "RT_", "clips": None, "report": None}
    i = 0
    while i < len(argv):
        key = argv[i]
        if key.startswith("--"):
            name = key[2:].replace("-", "_")
            value = argv[i + 1] if i + 1 < len(argv) else ""
            if name in ("target", "source", "out", "source_rig", "clips", "prefix", "report"):
                opts[name] = value
                i += 2
                continue
        i += 1
    for required in ("target", "source", "out"):
        if not opts.get(required):
            raise SystemExit(f"缺少参数 --{required}")
    return opts


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def first_armature(objects):
    return next((o for o in objects if o.type == 'ARMATURE'), None)


def assign_action(armature, action):
    if armature.animation_data is None:
        armature.animation_data_create()
    armature.animation_data.action = action
    if hasattr(armature.animation_data, "action_slot") and action and action.slots:
        slot = next((s for s in action.slots if getattr(s, "target_id_type", "") == "OBJECT"), action.slots[0])
        armature.animation_data.action_slot = slot


def bake_clip(target, source, source_action, pairs, name, fps):
    f0, f1 = [int(round(v)) for v in source_action.frame_range]
    assign_action(source, source_action)
    new_action = bpy.data.actions.new(name)
    new_action.use_fake_user = True
    assign_action(target, new_action)
    scene = bpy.context.scene
    for frame in range(f0, f1 + 1):
        scene.frame_set(frame)
        for target_bone, source_bone in pairs:
            tb = target.pose.bones.get(target_bone)
            sb = source.pose.bones.get(source_bone)
            if not tb or not sb:
                continue
            tb.matrix_basis = sb.matrix_basis.copy()
            tb.keyframe_insert("rotation_quaternion", frame=frame)
            tb.keyframe_insert("location", frame=frame)
            tb.keyframe_insert("scale", frame=frame)
    return {"name": name, "source": source_action.name, "frames": f1 - f0 + 1,
            "seconds": round((f1 - f0 + 1) / fps, 3)}


def main():
    opts = parse_args()
    fps = 24
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = fps

    target_objects = import_glb(opts["target"])
    target = first_armature(target_objects)
    if target is None:
        raise SystemExit("目标 GLB 里没有骨架")
    original_actions = sorted(a.name for a in bpy.data.actions)
    target_bones = [b.name for b in target.data.bones]

    source_objects = import_glb(opts["source"])
    source_action_names = [a.name for a in bpy.data.actions if a.name not in original_actions]
    source = next(o for o in (first_armature(source_objects),) if o)
    if source is None:
        raise SystemExit("动作库 GLB 里没有骨架")
    # 目标骨架可能和来源同名对象；按导入顺序确保是第二个骨架
    armatures = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    if len(armatures) >= 2 and armatures[0] is target:
        source = armatures[1]
    source_bones = [b.name for b in source.data.bones]

    cover = bone_map.coverage(opts["source_rig"], target_bones, source_bones)
    pairs = [(t, s) for t, s in cover["pairs"].items()]
    print(f"映射骨骼 {len(pairs)} 根；未匹配目标骨 {len(cover['unmatchedTarget'])} 根")

    wanted = None
    if opts.get("clips"):
        wanted = [c.strip() for c in opts["clips"].split(",") if c.strip()]
    candidates = [a for a in bpy.data.actions if a.name not in original_actions]
    if wanted:
        candidates = [a for a in candidates if a.name in wanted]
    if not candidates:
        raise SystemExit("没有找到可重定向的动作片段")

    started = time.time()
    baked = []
    for action in candidates:
        baked.append(bake_clip(target, source, action, pairs, opts["prefix"] + action.name, fps))
        print(f"  baked {action.name} -> {opts['prefix'] + action.name}")
    # 动作库的骨架和片段只用于采样，不能混进导出文件（否则会被当成角色自己的动作）
    for o in source_objects:
        bpy.data.objects.remove(o, do_unlink=True)
    for name in source_action_names:
        act = bpy.data.actions.get(name)
        if act:
            bpy.data.actions.remove(act)
    elapsed = round(time.time() - started, 1)

    # 只导出目标角色（骨架 + 蒙皮网格），渲染助手等辅助对象留在场景里即可
    bpy.ops.object.select_all(action='DESELECT')
    for o in target_objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = target

    out = os.path.abspath(opts["out"])
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format='GLB',
        use_selection=True,
        export_apply=False,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_nla_strips=False,
        export_skins=True,
        export_yup=True,
    )

    report = {
        "target": os.path.abspath(opts["target"]),
        "source": os.path.abspath(opts["source"]),
        "sourceRig": opts["source_rig"],
        "output": out,
        "outputBytes": os.path.getsize(out) if os.path.exists(out) else 0,
        "mappedBones": len(pairs),
        "unmatchedTargetBones": cover["unmatchedTarget"],
        "originalClips": original_actions,
        "bakedClips": baked,
        "seconds": elapsed,
    }
    if opts.get("report"):
        with open(os.path.abspath(opts["report"]), "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=1)
    print("RETARGET_DONE", json.dumps({k: report[k] for k in ("mappedBones", "outputBytes", "seconds")}, ensure_ascii=False))
    print("BAKED", len(baked))


if __name__ == "__main__":
    main()
