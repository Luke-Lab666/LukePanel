#!/usr/bin/env bash
set -Eeuo pipefail

PACKAGE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${1:-}"

if [[ -z "$ROOT" ]]; then
  printf '用法: %s /path/to/LukePanel\n' "$0" >&2
  exit 2
fi
ROOT="$(cd -- "$ROOT" && pwd)"

for command in python3 node go gofmt; do
  command -v "$command" >/dev/null 2>&1 || {
    printf '缺少必要命令: %s\n' "$command" >&2
    exit 1
  }
done

printf '\n[1/6] 校验并迁移源码\n'
RESULT="$(python3 "$PACKAGE_DIR/tools/migrate.py" "$ROOT")"
printf '%s\n' "$RESULT"
BACKUP="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["backup"])' <<<"$RESULT")"
MIGRATED=1

rollback_on_error() {
  local code=$?
  if [[ ${MIGRATED:-0} -eq 1 ]]; then
    printf '\n[失败] 验证未通过，正在自动恢复备份: %s\n' "$BACKUP" >&2
    python3 "$PACKAGE_DIR/tools/migrate.py" "$ROOT" --rollback "$BACKUP" || true
  fi
  exit "$code"
}
trap rollback_on_error ERR INT TERM

printf '\n[2/6] 格式化 Go 测试文件\n'
gofmt -w \
  "$ROOT/internal/hostadmin/firewall.go" \
  "$ROOT/internal/hostadmin/firewall_contract_test.go" \
  "$ROOT/internal/server/frontend_contract_test.go"

printf '\n[3/6] 检查前端 JavaScript 语法\n'
node --check "$ROOT/web/app.js"

printf '\n[4/6] 运行 Go 全量测试\n'
(
  cd "$ROOT"
  go test ./...
)

printf '\n[5/6] 运行 Go 静态检查\n'
(
  cd "$ROOT"
  go vet ./...
)

printf '\n[6/6] 校验嵌入资源一致性\n'
cmp -s "$ROOT/web/app.js" "$ROOT/internal/server/webdist/app.js"
cmp -s "$ROOT/web/styles.css" "$ROOT/internal/server/webdist/styles.css"

MIGRATED=0
trap - ERR INT TERM
printf '\n迁移完成。\n版本: v2.0.0\n备份: %s\n下一步: 在仓库根目录执行现有构建/发布流程。\n' "$BACKUP"
