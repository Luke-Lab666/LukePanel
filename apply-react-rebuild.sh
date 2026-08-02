#!/usr/bin/env bash
set -Eeuo pipefail

BASE_SHA="e992a3194dd6c24178bd6a0dac20b0ae20e01ba8"
VERSION="v2.0.0"
PACKAGE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
OVERLAY_DIR="$PACKAGE_DIR/overlay"
DELETE_LIST="$PACKAGE_DIR/delete-paths.txt"
FORCE=0
REPO=""

usage() {
  cat <<USAGE
用法：
  bash apply-react-rebuild.sh [--force] /path/to/LukePanel

未填写仓库路径时使用当前目录。
默认只允许应用到基线提交：$BASE_SHA
--force 会跳过提交与工作区检查，不建议在有未提交改动时使用。
USAGE
}

while (($#)); do
  case "$1" in
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      if [[ -n "$REPO" ]]; then
        echo "只能提供一个仓库路径" >&2
        usage >&2
        exit 2
      fi
      REPO="$1"
      shift
      ;;
  esac
done
REPO="${REPO:-$PWD}"
REPO="$(cd -- "$REPO" && pwd)"

for required in go.mod cmd/lukepanel internal/server web/assets web/manifest.webmanifest; do
  [[ -e "$REPO/$required" ]] || {
    echo "不是完整 LukePanel 仓库，缺少：$required" >&2
    exit 1
  }
done
[[ -d "$OVERLAY_DIR/frontend" && -f "$OVERLAY_DIR/Makefile" ]] || {
  echo "迁移包不完整：overlay 缺失" >&2
  exit 1
}
[[ -f "$DELETE_LIST" ]] || {
  echo "迁移包不完整：delete-paths.txt 缺失" >&2
  exit 1
}

if command -v git >/dev/null 2>&1 && git -C "$REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  CURRENT_SHA="$(git -C "$REPO" rev-parse HEAD)"
  if ((FORCE == 0)) && [[ "$CURRENT_SHA" != "$BASE_SHA" ]]; then
    echo "仓库提交不匹配。" >&2
    echo "期望：$BASE_SHA" >&2
    echo "当前：$CURRENT_SHA" >&2
    echo "请在对应基线应用，或确认风险后使用 --force。" >&2
    exit 1
  fi
  if ((FORCE == 0)) && [[ -n "$(git -C "$REPO" status --porcelain --untracked-files=all)" ]]; then
    echo "工作区存在未提交改动。请先提交或备份；也可确认风险后使用 --force。" >&2
    exit 1
  fi
else
  if ((FORCE == 0)); then
    echo "无法读取 Git 提交，默认拒绝覆盖。确认目录正确后使用 --force。" >&2
    exit 1
  fi
fi

for command_name in tar cp find sort awk npm node go make; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "缺少命令：$command_name" >&2
    exit 1
  }
done

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
NODE_MINOR="$(node -p 'Number(process.versions.node.split(".")[1])')"
if (( NODE_MAJOR < 22 || (NODE_MAJOR == 22 && NODE_MINOR < 12) )); then
  echo "需要 Node.js 22.12 或更高版本，当前：$(node --version)" >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$REPO/.migration-backups"
BACKUP="$BACKUP_DIR/lukepanel-before-react-$TIMESTAMP.tar.gz"
AFFECTED="$(mktemp)"
EXISTING="$(mktemp)"
ROLLBACK_NEEDED=0
mkdir -p "$BACKUP_DIR"

cleanup_temp() {
  rm -f "$AFFECTED" "$EXISTING"
}

collect_paths() {
  {
    sed -e 's/[[:space:]]*$//' -e '/^[[:space:]]*#/d' -e '/^[[:space:]]*$/d' "$DELETE_LIST"
    (cd "$OVERLAY_DIR" && find . -mindepth 1 -maxdepth 1 -printf '%P\n')
  } | awk 'NF && !seen[$0]++' | sort > "$AFFECTED"
  while IFS= read -r path; do
    [[ -e "$REPO/$path" || -L "$REPO/$path" ]] && printf '%s\n' "$path"
  done < "$AFFECTED" > "$EXISTING"
}

rollback() {
  local exit_code=$?
  if (( ROLLBACK_NEEDED == 1 )); then
    echo
    echo "迁移失败，正在恢复应用前文件……" >&2
    while IFS= read -r path; do
      [[ -n "$path" ]] && rm -rf -- "$REPO/$path"
    done < "$AFFECTED"
    if [[ -s "$EXISTING" && -f "$BACKUP" ]]; then
      tar -xzf "$BACKUP" -C "$REPO"
    fi
    echo "已恢复。备份保留在：$BACKUP" >&2
  fi
  cleanup_temp
  exit "$exit_code"
}
trap rollback ERR INT TERM
trap cleanup_temp EXIT

collect_paths
if [[ -s "$EXISTING" ]]; then
  tar -czf "$BACKUP" -C "$REPO" -T "$EXISTING"
else
  tar -czf "$BACKUP" --files-from /dev/null
fi
ROLLBACK_NEEDED=1

while IFS= read -r path; do
  [[ -n "$path" ]] && rm -rf -- "$REPO/$path"
done < <(sed -e 's/[[:space:]]*$//' -e '/^[[:space:]]*#/d' -e '/^[[:space:]]*$/d' "$DELETE_LIST")

cp -a "$OVERLAY_DIR/." "$REPO/"
rm -rf "$REPO/internal/server/webdist"
mkdir -p "$REPO/internal/server/webdist"
touch "$REPO/internal/server/webdist/.gitkeep"

cd "$REPO"
printf '\n[1/5] 安装锁定版本的前端依赖\n'
make frontend-install
printf '\n[2/5] TypeScript 类型检查\n'
make frontend-check
printf '\n[3/5] 构建并暂存 React 前端\n'
make frontend
printf '\n[4/5] Go 全量测试\n'
go test ./...
printf '\n[5/5] 构建 Linux 当前架构二进制\n'
make build VERSION="$VERSION"

ROLLBACK_NEEDED=0
trap - ERR INT TERM
cleanup_temp
trap - EXIT

echo
echo "React 重构已完整应用。"
echo "版本：$VERSION"
echo "备份：$BACKUP"
echo "新二进制：$REPO/dist/lukepanel"
rm -rf "$REPO/frontend/node_modules" "$REPO/frontend/dist"
echo "已清理 npm 依赖目录与前端中间产物。"
echo
echo "建议检查：git -C '$REPO' status --short"
