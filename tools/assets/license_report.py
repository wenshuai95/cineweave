#!/usr/bin/env python3
"""从 public/assets/manifest.json 生成 docs/ASSET-LICENSE.md（可重复运行）。"""
import json, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
doc = json.load(open(os.path.join(ROOT, 'public/assets/manifest.json'), encoding='utf-8'))
assets = doc['assets']

def source_key(a):
    src = a.get('source') or ''
    return '本地程序化构建' if not src.startswith('http') else src.split('/')[2]

by = collections.Counter()
for a in assets:
    by[(source_key(a), a.get('license'))] += 1

lines = ['# 内置 3D 资产许可清单', '',
         f"清单版本：{doc.get('version')} · 核对日期：{doc.get('checkedAt')} · 资产数：{len(assets)}", '',
         '全部内置资产均为 **CC0-1.0**（公有领域），可随软件分发、可商用，无需署名。原始作者与来源见下表。', '',
         '| 来源 | 许可 | 数量 |', '|---|---|---|']
for (key, lic), n in sorted(by.items()):
    lines.append(f'| {key} | {lic} | {n} |')

groups = collections.defaultdict(list)
for a in assets:
    groups[source_key(a)].append(a)
lines += ['', '## 按来源分组', '']
for key in sorted(groups):
    lines.append(f'### {key}（{len(groups[key])} 个）')
    lines.append('')
    lines.append('| ID | 名称 | 动作数 | 许可文件 |')
    lines.append('|---|---|---|---|')
    for a in sorted(groups[key], key=lambda x: x['id']):
        lines.append(f"| {a['id']} | {a.get('name','')} | {len(a.get('animations') or [])} | `{a.get('licenseFile','')}` |")
    lines.append('')

lines += ['## 重定向衍生资产', '',
          '`adult-*-actions.glb` 由本机把 Universal Animation Library 2 的 85 段动作重定向到角色骨架上生成，',
          '来源与角色同为 Quaternius（CC0-1.0），片段以 `RT_` 前缀命名；许可说明见',
          '`public/assets/licenses/quaternius-retarget-derivative.txt`。', '',
          '## 随包分发的其他第三方代码', '',
          '- three.js r180 — MIT（`THIRD-PARTY-LICENSES.txt`，打包时复制 `LICENSE.three.txt`）',
          '- Electron / Chromium — 随 Electron 发行包附带 `LICENSE` 与 `LICENSES.chromium.html`', '',
          '## 已移出发行包的历史文件（`legacy-assets/`）', '',
          '以下文件不在资产清单中，只有工程内的骨骼/权重与程序化动作验证记录，**没有可追溯的资产来源与许可声明**；',
          '为避免发行风险，移到源码目录 `legacy-assets/`，**不随安装包分发**：', '',
          '- `adult-female-rigged.glb`、`adult-male-rigged.glb`：骨骼命名接近通用人形绑定，来源待查；旧工程若引用，需重新导入自己的 GLB。',
          '- `geometry-floor-square.glb`：早期 UnityGLTF 导出的地板，已被程序化地面取代。', '']

out = os.path.join(ROOT, 'docs/ASSET-LICENSE.md')
open(out, 'w', encoding='utf-8').write('\n'.join(lines))
print('wrote', out, 'assets', len(assets))
