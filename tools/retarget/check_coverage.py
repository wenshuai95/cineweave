#!/usr/bin/env python3
"""只读检查：目标角色骨架 与 动作库骨架 的映射覆盖度（不需要 Blender）。

用法：
  python3 check_coverage.py <目标角色.glb> <动作库.glb> [--source-rig ual2]
输出 JSON：mapped / unmatchedTarget / unusedSource / pairs
"""
import json
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bone_map  # noqa: E402


def glb_json(path):
    with open(path, "rb") as f:
        data = f.read()
    length = struct.unpack_from("<I", data, 12)[0]
    return json.loads(data[20:20 + length])


def joints(path):
    doc = glb_json(path)
    nodes = doc.get("nodes", [])
    skins = doc.get("skins", [])
    if not skins:
        return []
    return [nodes[i].get("name", "") for i in skins[0]["joints"]]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    rig = "ual2"
    if "--source-rig" in sys.argv:
        rig = sys.argv[sys.argv.index("--source-rig") + 1]
    if len(args) < 2:
        raise SystemExit(__doc__)
    target_bones = joints(args[0])
    source_bones = joints(args[1])
    result = bone_map.coverage(rig, target_bones, source_bones)
    result["targetBones"] = len(target_bones)
    result["sourceBones"] = len(source_bones)
    print(json.dumps(result, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
