#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/frontend"
WEB="$ROOT/web"
EMBED="$ROOT/internal/server/webdist"
VERSION="$(tr -d '[:space:]' < "$ROOT/VERSION")"
[[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([._-][A-Za-z0-9.-]+)?$ ]] || { echo "Invalid VERSION: $VERSION" >&2; exit 1; }
if [[ -x "$FRONTEND/node_modules/.bin/tsc" ]]; then
  TSC="$FRONTEND/node_modules/.bin/tsc"
elif command -v tsc >/dev/null 2>&1; then
  TSC="$(command -v tsc)"
else
  echo "TypeScript compiler is required. Run: npm --prefix frontend install" >&2
  exit 1
fi

# Never destroy the last known-good web bundle before compilation succeeds.
rm -rf "$FRONTEND/dist"
mkdir -p "$FRONTEND/dist"
"$TSC" -p "$FRONTEND/tsconfig.json"

STAGE="$(mktemp -d "$ROOT/.frontend-stage.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
STAGE_WEB="$STAGE/web"
mkdir -p "$STAGE_WEB/assets"
cp "$FRONTEND/index.html" "$STAGE_WEB/index.html"
sed -i "s/window.__LUKEPANEL_VERSION__='[^']*'/window.__LUKEPANEL_VERSION__='$VERSION'/" "$STAGE_WEB/index.html"
cp "$FRONTEND/src/app.css" "$STAGE_WEB/assets/app.css"
cp "$FRONTEND/dist/app.js" "$STAGE_WEB/assets/app.js"
cp "$FRONTEND/vendor/webpack-runtime.js" "$STAGE_WEB/assets/vendor-runtime.js"
cp "$FRONTEND/vendor/react-18.2.0.chunk.js" "$STAGE_WEB/assets/react-18.2.0.js"
cp "$FRONTEND/vendor/react-dom-18.2.0.chunk.js" "$STAGE_WEB/assets/react-dom-18.2.0.js"
cp "$FRONTEND/vendor/react-bootstrap.js" "$STAGE_WEB/assets/react-bootstrap.js"
cp -a "$FRONTEND/public/." "$STAGE_WEB/"
python3 - "$STAGE_WEB" "$VERSION" <<'PY'
import hashlib, json, pathlib, sys
root=pathlib.Path(sys.argv[1]); version=sys.argv[2]
files={}
for path in sorted(p for p in root.rglob('*') if p.is_file()):
    rel=path.relative_to(root).as_posix()
    files[rel]={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
(root/'build-meta.json').write_text(json.dumps({'version':version,'framework':'React','react':'18.2.0','files':files},ensure_ascii=False,indent=2)+'\n')
PY

# Publish only after every stage above completed successfully.
rm -rf "$WEB" "$EMBED"
mv "$STAGE_WEB" "$WEB"
mkdir -p "$EMBED"
cp -a "$WEB/." "$EMBED/"
diff -qr "$WEB" "$EMBED" >/dev/null
printf 'Built LukePanel %s React frontend (%s files)\n' "$VERSION" "$(find "$WEB" -type f | wc -l)"
