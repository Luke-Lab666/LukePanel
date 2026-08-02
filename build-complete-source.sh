#!/usr/bin/env bash
set -Eeuo pipefail

PACKAGE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BASE_COMMIT="38ca96f1971e5a53359076022b7154329481e4ad"
OUTPUT_DIR="${1:-$PWD}"
ARCHIVE_URL="https://codeload.github.com/Luke-Lab666/LukePanel/tar.gz/${BASE_COMMIT}"

for command in curl tar python3 node go gofmt; do
  command -v "$command" >/dev/null 2>&1 || {
    printf '缺少必要命令: %s\n' "$command" >&2
    exit 1
  }
done

mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR="$(cd -- "$OUTPUT_DIR" && pwd)"
WORK="$(mktemp -d -t lukepanel-v2-source-XXXXXX)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

printf '[1/5] 下载固定基线 %s\n' "$BASE_COMMIT"
curl --fail --location --retry 3 --connect-timeout 15 \
  "$ARCHIVE_URL" -o "$WORK/source.tar.gz"

printf '[2/5] 解压源码\n'
tar -xzf "$WORK/source.tar.gz" -C "$WORK"
ROOT="$(find "$WORK" -mindepth 1 -maxdepth 1 -type d -name 'LukePanel-*' | head -n 1)"
[[ -n "$ROOT" && -d "$ROOT" ]] || { echo '无法定位源码目录' >&2; exit 1; }

printf '[3/5] 应用 v2.0.0 完整迁移并运行仓库测试\n'
"$PACKAGE_DIR/apply.sh" "$ROOT"

# 完整源码发行包不携带迁移前备份；原始基线可随时通过固定提交重新取得。
find "$ROOT" -maxdepth 1 -type d -name '.lukepanel-v2-backup-*' -exec rm -rf {} +
python3 - "$ROOT/.lukepanel-v2-migration.json" <<'PY'
import json, pathlib, sys
p = pathlib.Path(sys.argv[1])
if p.exists():
    data = json.loads(p.read_text(encoding='utf-8'))
    data['backup'] = 'not included in source release archive'
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
PY

DEST="$WORK/LukePanel-v2.0.0"
mv "$ROOT" "$DEST"

printf '[4/5] 生成完整源码压缩包\n'
tar -czf "$OUTPUT_DIR/LukePanel-v2.0.0-source.tar.gz" -C "$WORK" LukePanel-v2.0.0
python3 - "$DEST" "$OUTPUT_DIR/LukePanel-v2.0.0-source.zip" <<'PY'
import pathlib, sys, zipfile
root = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for path in sorted(root.rglob('*')):
        if path.is_file():
            z.write(path, pathlib.Path(root.name) / path.relative_to(root))
PY

printf '[5/5] 校验文件\n'
python3 - "$OUTPUT_DIR/LukePanel-v2.0.0-source.tar.gz" "$OUTPUT_DIR/LukePanel-v2.0.0-source.zip" <<'PY'
import hashlib, pathlib, sys
for name in sys.argv[1:]:
    p = pathlib.Path(name)
    h = hashlib.sha256(p.read_bytes()).hexdigest()
    print(f'{h}  {p.name}  ({p.stat().st_size} bytes)')
PY
