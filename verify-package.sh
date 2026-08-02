#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
for file in apply-react-rebuild.sh delete-paths.txt PATCH-README.md overlay/Makefile overlay/frontend/package.json overlay/frontend/src/App.tsx overlay/internal/server/frontend_contract_test.go; do
  [[ -f "$ROOT/$file" ]] || { echo "缺少：$file" >&2; exit 1; }
done
bash -n "$ROOT/apply-react-rebuild.sh"
if find "$ROOT/overlay/frontend" -type f \( -name '*.tsbuildinfo' -o -name '__offline-shim.d.ts' -o -name 'vite.config.js' -o -name 'vite.config.d.ts' \) | grep -q .; then
  echo "包含不应交付的 TypeScript 临时产物" >&2
  exit 1
fi
if grep -RInE 'web/app\.js|web/styles\.css|internal/server/webdist/app\.js' "$ROOT/overlay/Makefile" "$ROOT/overlay/.github"; then
  echo "构建链路仍引用旧前端" >&2
  exit 1
fi
echo "迁移包结构检查通过"
