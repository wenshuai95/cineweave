# 离线资产说明

本仓库的 `public/assets/` 只包含清单（manifest）与许可证文本；模型和缩略图因体积原因不随仓库提供。

## 目录约定

```text
public/assets/
  manifest.json        # 资产清单（名称、分类、动画、来源、许可证）
  README.txt           # 原资产库说明
  licenses/            # 每个来源的许可证全文（CC0）
  models/              # 需从 Release 资产包解压
  thumbnails/          # 需从 Release 资产包解压
```

## 来源与许可

清单中每个资产都记录了 `source`、`author`、`license`、`licenseFile`。目前全部为 **CC0-1.0**，主要来源：

- Kenney（mini characters、furniture、city kit、car kit、prototype 等）
- Quaternius（universal base characters、modular adults、animation library 等）
- 基础几何体

许可证全文位于 `public/assets/licenses/`。CC0 允许商用与再分发；如使用本资产库，请保留来源说明与许可证文件。

## 体积

- models：约 56MB
- thumbnails：约 9MB

如果只是二次开发界面或剪辑功能，可以不下载资产包。
