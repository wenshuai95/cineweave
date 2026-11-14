#!/usr/bin/env python3
"""CineWeave / 造梦工坊 工程 → Blender 桥接导出器

读取 .workstation.json（v1.21 工程导出格式），产出：
  out/<project>/assets/*.glb     从工程内嵌 base64 或离线资产路径解出的模型
  out/<project>/scene.json       给 bw_build.py / bw_render.py 用的精简场景描述

坐标：工程是 three.js 世界（Y 向上），换到 Blender（Z 向上）：
  B = (x, -z, y)      旋转四元数另行处理（见 bw_common.py）

用法：
  python3 export_workstation.py <工程.workstation.json> [输出根目录]
"""
import base64
import json
import os
import re
import sys

# 离线资产（modelSrc 是 /assets/models/xxx.glb 时）在工具源码里的根
TOOL_ASSET_ROOT = os.path.expanduser(
    "~/Documents/Codex/2026-10-12/wo/work/ai-workstation-v1210/source/public"
)


def slug(text):
    s = re.sub(r"[^\w\u4e00-\u9fff.-]+", "-", text or "project").strip("-")
    return s[:60] or "project"


def decode_src(src, obj_id, assets_dir, asset_root=None, asset_store=None):
    """返回本地 glb 路径（相对 out 目录）。"""
    if not src:
        return None
    if src.startswith("data:"):
        header, _, payload = src.partition(",")
        ext = ".glb" if "gltf-binary" in header else ".bin"
        path = os.path.join(assets_dir, f"{obj_id}{ext}")
        with open(path, "wb") as f:
            f.write(base64.b64decode(payload))
        return os.path.relpath(path, os.path.dirname(assets_dir))
    # 本机资产库：/api/model-assets/<sha256>.glb
    m = re.match(r"^/api/(?:model-)?assets/([0-9a-f]{64})\.glb$", src)
    if m and asset_store:
        candidate = os.path.join(asset_store, m.group(1) + ".glb")
        if os.path.exists(candidate):
            return candidate
        print(f"[warn] 资产库缺少模型 {m.group(1)}")
        return None
    # 离线资产路径，例如 /assets/models/adult-female-casual.glb
    candidate = os.path.join(asset_root or TOOL_ASSET_ROOT, src.lstrip("/"))
    if os.path.exists(candidate):
        return candidate
    return None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = sys.argv[1:]
    asset_root = TOOL_ASSET_ROOT
    asset_store = None
    if "--asset-store" in flags:
        asset_store = os.path.abspath(flags[flags.index("--asset-store") + 1])
        args = [a for a in args if a != flags[flags.index("--asset-store") + 1]]
    if "--asset-root" in flags:
        asset_root = os.path.abspath(flags[flags.index("--asset-root") + 1])
        args = [a for a in args if a != flags[flags.index("--asset-root") + 1]]
    if not args:
        print(__doc__)
        sys.exit(1)
    src_json = os.path.abspath(args[0])
    root = os.path.abspath(args[1]) if len(args) > 1 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "out")
    project = json.load(open(src_json, encoding="utf-8"))["project"]

    out_dir = root if "--flat" in flags else os.path.join(root, slug(project.get("name", "project")))
    assets_dir = os.path.join(out_dir, "assets")
    os.makedirs(assets_dir, exist_ok=True)

    objects = []
    for o in project.get("objects", []):
        if o.get("type") != "model":
            continue
        rel = decode_src(o.get("modelSrc"), o["id"], assets_dir, asset_root, asset_store)
        if not rel:
            print(f"[warn] 跳过模型 {o['id']}：找不到资产 {str(o.get('modelSrc'))[:60]}")
            continue
        objects.append({
            "id": o["id"],
            "name": o.get("name", o["id"]),
            "src": rel,
            "modelSize": o.get("modelSize") or 1.0,
            "colorMode": o.get("modelColorMode", "original"),
            "tint": o.get("modelTint") or o.get("color") or "#b8b8b8",
            "hidden": bool(o.get("hidden")),
            "modelClip": o.get("modelClip", ""),
            "actions": o.get("actions", []),
            "keys": o.get("keys", []),
            "channels": o.get("channels", {}),
            "position": o.get("position", [0, 0, 0]),
            "rotation": o.get("rotation", 0),
            "rotationX": o.get("rotationX", 0),
            "rotationZ": o.get("rotationZ", 0),
            "scale": o.get("scale", 1),
        })

    cameras = []
    for o in project.get("objects", []):
        if o.get("type") != "camera":
            continue
        cameras.append({
            "id": o["id"],
            "name": o.get("name", o["id"]),
            "position": o.get("position", [0, 2, 8]),
            "target": o.get("target", [0, 1, 0]),
            "roll": o.get("roll", 0),
            "fov": o.get("fov", 45),
            "aspect": o.get("aspect", "16:9"),
            "keys": o.get("keys", []),
            "channels": o.get("channels", {}),
        })

    scene = {
        "source": src_json,
        "project": {
            "name": project.get("name", ""),
            "duration": project.get("duration", 0),
            "fps": project.get("fps", 24),
            "groundColor": project.get("groundColor") or "#41494c",
            "width": 1280,
            "height": 720,
        },
        "objects": objects,
        "cameras": cameras,
        "shots": project.get("shots", []),
    }
    scene_path = os.path.join(out_dir, "scene.json")
    with open(scene_path, "w", encoding="utf-8") as f:
        json.dump(scene, f, ensure_ascii=False, indent=1)

    total = sum(os.path.getsize(os.path.join(out_dir, o["src"])) for o in objects)
    print(f"项目：{scene['project']['name']}")
    print(f"模型 {len(objects)} 个（{total / 1e6:.1f} MB）、机位 {len(cameras)} 个、镜头 {len(scene['shots'])} 个")
    print(f"时长 {scene['project']['duration']}s @ {scene['project']['fps']}fps")
    print(f"输出：{out_dir}")
    print(f"场景描述：{scene_path}")
    return out_dir


if __name__ == "__main__":
    main()
