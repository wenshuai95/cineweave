"""骨架映射表：把动作库骨架的骨骼名映射到角色骨架。

已覆盖两套来源（都来自 Quaternius，CC0）：
  ual2       Universal Animation Library 2（85 片段，如 female-anatomy-mannequin.glb）
  adult      成年男女角色骨架（adult-female-casual 等，24 片段）

目标骨架统一用成年角色那套（Root/Hips/Abdomen/...）；新增来源时在 SOURCES 里加表。
纯 Python，无 Blender 依赖，方便单独测试覆盖度。
"""
import json
import sys

TARGET = "adult"

# 成年角色骨骼 → 各来源骨骼。大小写与分隔符按 glTF 导出原样保留。
SOURCES = {
    "ual2": {
        "Root": "root",
        "Hips": "pelvis",
        "Abdomen": "spine_01",
        "Torso": "spine_02",
        "Chest": "spine_03",
        "Neck": "neck_01",
        "Head": "Head",
        "Shoulder.L": "clavicle_l",
        "UpperArm.L": "upperarm_l",
        "LowerArm.L": "lowerarm_l",
        "Wrist.L": "hand_l",
        "Shoulder.R": "clavicle_r",
        "UpperArm.R": "upperarm_r",
        "LowerArm.R": "lowerarm_r",
        "Wrist.R": "hand_r",
        "UpperLeg.L": "thigh_l",
        "LowerLeg.L": "calf_l",
        "Foot.L": "foot_l",
        "PT.L": "ball_l",
        "UpperLeg.R": "thigh_r",
        "LowerLeg.R": "calf_r",
        "Foot.R": "foot_r",
        "PT.R": "ball_r",
    },
    # performer 骨架（DEF- 前缀）结构相近，先给一张初版表，实测后再校正
    "performer": {
        "Root": "root",
        "Hips": "DEF-hips",
        "Abdomen": "DEF-spine.001",
        "Torso": "DEF-spine.002",
        "Chest": "DEF-spine.003",
        "Neck": "DEF-neck",
        "Head": "DEF-head",
        "Shoulder.L": "DEF-shoulder.L",
        "UpperArm.L": "DEF-upper_arm.L",
        "LowerArm.L": "DEF-forearm.L",
        "Wrist.L": "DEF-hand.L",
        "Shoulder.R": "DEF-shoulder.R",
        "UpperArm.R": "DEF-upper_arm.R",
        "LowerArm.R": "DEF-forearm.R",
        "Wrist.R": "DEF-hand.R",
        "UpperLeg.L": "DEF-thigh.L",
        "LowerLeg.L": "DEF-shin.L",
        "Foot.L": "DEF-foot.L",
        "Toe.L": "DEF-toe.L",
        "UpperLeg.R": "DEF-thigh.R",
        "LowerLeg.R": "DEF-shin.R",
        "Foot.R": "DEF-foot.R",
        "Toe.R": "DEF-toe.R",
    },
}

# 手指：最多 4 节，按序号直连；来源骨骼数不足时只映射前 n 节。
FINGER_GROUPS = {
    "Index": "index",
    "Middle": "middle",
    "Ring": "ring",
    "Pinky": "pinky",
}
THUMB = "thumb"


def _finger_pairs(source):
    """按来源命名规则补齐手指映射（ual2 / performer 都在这里生成）。"""
    pairs = {}
    for finger, prefix in FINGER_GROUPS.items():
        for hand, side in (("L", "l"), ("R", "r")):
            for i in range(1, 5):
                target = f"{finger}{i}.{hand}"
                if source == "ual2":
                    src = f"{prefix}_0{i}_{side}" if i < 4 else f"{prefix}_04_leaf_{side}"
                else:
                    src = f"DEF-{prefix}.0{i}.{hand}" if i < 4 else f"DEF-{prefix}.04.{hand}"
                pairs[target] = src
    for hand, side in (("L", "l"), ("R", "r")):
        for i in range(1, 4):
            target = f"Thumb{i}.{hand}"
            if source == "ual2":
                pairs[target] = f"thumb_0{i}_{side}"
            else:
                pairs[target] = f"DEF-thumb.0{i}.{hand}"
    return pairs


def mapping(source):
    """返回 {目标骨骼: 来源骨骼}；未收录的来源抛错。"""
    if source not in SOURCES:
        raise KeyError(f"不支持的来源骨架：{source}（可用：{', '.join(SOURCES)}）")
    pairs = dict(SOURCES[source])
    pairs.update(_finger_pairs(source))
    return pairs


def coverage(source, target_bones, source_bones):
    """报告映射覆盖：哪些目标骨没映射、哪些来源骨被用到。"""
    pairs = mapping(source)
    target_bones = list(target_bones)
    source_bones = set(source_bones)
    mapped = {t: s for t, s in pairs.items() if t in target_bones and s in source_bones}
    unmatched_target = [b for b in target_bones if b not in mapped]
    matched_sources = set(mapped.values())
    unused_source = sorted(b for b in source_bones if b not in matched_sources)
    return {
        "source": source,
        "declared": len(pairs),
        "mapped": len(mapped),
        "unmatchedTarget": unmatched_target,
        "unusedSource": unused_source,
        "pairs": mapped,
    }


def main(argv=None):
    argv = argv or sys.argv[1:]
    if len(argv) >= 2:
        result = coverage(argv[0], json.loads(argv[1]), json.loads(argv[2]))
    else:
        result = {"sources": {name: len(mapping(name)) for name in SOURCES}}
    print(json.dumps(result, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
