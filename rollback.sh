#!/usr/bin/env bash
set -Eeuo pipefail
PACKAGE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${1:-}"
BACKUP="${2:-}"
if [[ -z "$ROOT" || -z "$BACKUP" ]]; then
  printf '用法: %s /path/to/LukePanel /path/to/.lukepanel-v2-backup-YYYYMMDD-HHMMSS\n' "$0" >&2
  exit 2
fi
python3 "$PACKAGE_DIR/tools/migrate.py" "$ROOT" --rollback "$BACKUP"
printf '已恢复备份。\n'
