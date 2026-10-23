#!/usr/bin/env bash
set -euo pipefail
version="${1:?用法: scripts/release.sh 1.21.1 \"更新说明\"}"
notes="${2:-"发布 v$version"}"
asset="${ASSET_ZIP:-}"

cd "$(dirname "$0")/.."

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "版本号格式应为 x.y.z" >&2
  exit 1
fi
if ! grep -q "\"version\": \"$version\"" package.json; then
  echo "请先修改 package.json 的 version 为 $version" >&2
  exit 1
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "工作区有未提交改动，请先 commit" >&2
  exit 1
fi

git tag "v$version"
git push origin main --tags

if [[ -n "$asset" && -f "$asset" ]]; then
  gh release create "v$version" "$asset" --title "v$version" --notes "$notes"
else
  gh release create "v$version" --title "v$version" --notes "$notes"
fi
echo "已发布 v$version"
