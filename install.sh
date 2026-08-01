#!/usr/bin/env bash
set -Eeuo pipefail

REPO="Luke-Lab666/LukePanel"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/lukepanel"
DATA_DIR="/var/lib/lukepanel"
SERVICE_FILE="/etc/systemd/system/lukepanel.service"

log() { printf '[LukePanel] %s\n' "$*"; }
die() { printf '[LukePanel] 错误：%s\n' "$*" >&2; exit 1; }

[[ ${EUID:-$(id -u)} -eq 0 ]] || die "请使用 root 运行安装器"
command -v curl >/dev/null || die "缺少 curl"
command -v sha256sum >/dev/null || die "缺少 sha256sum"
command -v systemctl >/dev/null || die "当前系统不支持 systemd"

case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) die "暂不支持的架构：$(uname -m)" ;;
esac

BINARY="lukepanel-linux-${ARCH}"
BASE_URL="https://github.com/${REPO}/releases/latest/download"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

log "下载最新版本（${ARCH}）"
curl -fL --retry 3 --connect-timeout 15 "${BASE_URL}/${BINARY}" -o "${TMP_DIR}/${BINARY}"
curl -fL --retry 3 --connect-timeout 15 "${BASE_URL}/SHA256SUMS" -o "${TMP_DIR}/SHA256SUMS"
(
  cd "$TMP_DIR"
  grep "  ${BINARY}$" SHA256SUMS | sha256sum -c -
) || die "二进制校验失败"

if ! id lukepanel >/dev/null 2>&1; then
  useradd --system --home-dir "$DATA_DIR" --shell /usr/sbin/nologin lukepanel
fi
install -m 0755 "${TMP_DIR}/${BINARY}" "${INSTALL_DIR}/lukepanel"
install -d -o lukepanel -g lukepanel -m 0750 "$CONFIG_DIR" "$DATA_DIR"

cat > "$SERVICE_FILE" <<'UNIT'
[Unit]
Description=LukePanel lightweight system management panel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=lukepanel
Group=lukepanel
ExecStart=/usr/local/bin/lukepanel --config /etc/lukepanel/config.json
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=read-only
ProtectSystem=strict
ReadWritePaths=/var/lib/lukepanel /etc/lukepanel
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
LockPersonality=true
MemoryDenyWriteExecute=true

[Install]
WantedBy=multi-user.target
UNIT

INITIAL_OUTPUT=""
if [[ ! -f "${CONFIG_DIR}/config.json" ]]; then
  INITIAL_OUTPUT="$(runuser -u lukepanel -- /usr/local/bin/lukepanel --init --config "${CONFIG_DIR}/config.json")"
fi

systemctl daemon-reload
systemctl enable --now lukepanel.service

log "安装完成"
printf '监听地址：127.0.0.1:6767\n'
printf '配置文件：%s/config.json\n' "$CONFIG_DIR"
printf '请通过 Nginx Proxy Manager 使用 HTTPS 反向代理。\n'
if [[ -n "$INITIAL_OUTPUT" ]]; then
  printf '\n%s\n' "$INITIAL_OUTPUT"
fi
