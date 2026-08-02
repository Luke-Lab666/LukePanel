#!/usr/bin/env bash
set -Eeuo pipefail
PACKAGE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${1:-}"

printf '[1/3] 迁移器单元测试\n'
python3 "$PACKAGE_DIR/tests/test_migration.py"

printf '\n[2/3] 真实 Chromium UI 回归\n'
python3 "$PACKAGE_DIR/tests/browser/audit.py"

if [[ -n "$ROOT" ]]; then
  ROOT="$(cd -- "$ROOT" && pwd)"
  printf '\n[3/3] 目标仓库测试\n'
  node --check "$ROOT/web/app.js"
  (cd "$ROOT" && go test ./... && go vet ./...)
else
  printf '\n[3/3] 未提供目标仓库，跳过仓库内 Go 测试。\n'
fi
