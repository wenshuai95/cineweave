# 动作库重定向（Retarget）

把一套骨架上的动画片段，烘焙到另一套角色的骨架上，并导出带全部片段的新 GLB。
用途：内置动作库的片段分布在不同骨架的模型里（85 段动作在 UAL2 人偶上、24 段在成年角色上），
重定向后同一套角色就能用上 100+ 段动作，不用 Mixamo、不用额外授权。

## 用法

```bash
BL=/Applications/Blender.app/Contents/MacOS/Blender
cd source

# 先看两套骨架能对上多少（不需要 Blender）
python3 tools/retarget/check_coverage.py \
  public/assets/models/adult-female-casual.glb \
  public/assets/models/female-anatomy-mannequin.glb

# 重定向全部片段（约 15 秒）
$BL -b --factory-startup --python tools/retarget/retarget_clips.py -- \
  --target public/assets/models/adult-female-casual.glb \
  --source public/assets/models/female-anatomy-mannequin.glb \
  --out /path/to/adult-female-casual-rt.glb \
  --report /path/to/report.json

# 只重定向部分片段
... --clips "Spell_Simple_Idle_Loop,Death01,Sitting_Talking_Loop"
```

输出 GLB 保留角色原有片段，新增片段统一以 `RT_` 前缀命名（可用 `--prefix` 改）。

## 实测结果（v1.22 源码，2026-10-19）

| 项目 | 结果 |
|---|---|
| 成年女性角色 ← UAL2 人偶 | 61/61 根骨骼映射，未匹配 1 根（辅助骨 `Body`） |
| 动作数 | 24 原有 + 85 重定向 = **109 段** |
| 导出体积 | 6.64 MB（原角色 1.67 MB） |
| 烘焙耗时 | **14.8 秒**（85 段，M1 Max） |
| 视觉验证 | 施法/坐下交谈/出拳/死亡/挥剑/受击六段抽查姿态正确 |

## 原理与映射

- 逐帧把来源骨骼的 `matrix_basis`（相对自身 rest 的局部变换）复制给同义目标骨骼，再烘焙成新 Action。
- 映射表在 `bone_map.py`：`adult` 骨架 ← `ual2` / `performer`；手指按序号自动配对。
- 目标骨架多出的辅助骨、来源骨架的 `*_leaf` 末端骨会被跳过。

## 已知边界

- 两套骨架 rest 姿态不同（A/T-pose、骨长比例），重定向后**脚底可能滑步或悬空**；
  正式使用建议在 Blender 里加一次脚锁地/根位移修正。
- 只复制局部旋转/位置/缩放，不做 IK、不处理接触；双人互动仍需手工对位。
- 来源片段的根位移会原样带过来；如果需要原地循环，要先在来源里去掉根位移。
- `RT_` 片段不会自动进资产清单（manifest）；要作为内置资产需要补 manifest 与缩略图。

## 测试

`tests/retarget-tool.test.mjs`：覆盖度检查（≥55 根、覆盖率 >85%）与映射表结构检查。
没有装 python3 时自动跳过覆盖度用例。
