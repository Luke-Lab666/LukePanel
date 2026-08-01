#!/usr/bin/env bash
set -Eeuo pipefail

REPO="Luke-Lab666/LukePanel"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/lukepanel"
DATA_DIR="/var/lib/lukepanel"
WEB_SERVICE="/etc/systemd/system/lukepanel.service"
AGENT_SERVICE="/etc/systemd/system/lukepanel-agent.service"
UNINSTALL_COMMAND="/usr/local/sbin/lukepanel-uninstall"

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
curl -fL --retry 3 --connect-timeout 15 "${BASE_URL}/uninstall.sh" -o "${TMP_DIR}/uninstall.sh"
(
  cd "$TMP_DIR"
  grep "  ${BINARY}$" SHA256SUMS | sha256sum -c -
  grep "  uninstall.sh$" SHA256SUMS | sha256sum -c -
) || die "二进制校验失败"

if ! getent group lukepanel >/dev/null 2>&1; then
  groupadd --system lukepanel
fi
if ! id lukepanel >/dev/null 2>&1; then
  useradd --system --gid lukepanel --home-dir "$DATA_DIR" --shell /usr/sbin/nologin lukepanel
else
  usermod --gid lukepanel lukepanel
fi
install -d -o lukepanel -g lukepanel -m 0750 "$CONFIG_DIR" "$DATA_DIR"
systemctl stop lukepanel.service lukepanel-agent.service 2>/dev/null || true
install -m 0755 "${TMP_DIR}/${BINARY}" "${INSTALL_DIR}/lukepanel"
install -m 0755 "${TMP_DIR}/uninstall.sh" "$UNINSTALL_COMMAND"

cat > "$AGENT_SERVICE" <<'UNIT'
[Unit]
Description=LukePanel privileged local agent
After=local-fs.target docker.service
Before=lukepanel.service

[Service]
Type=simple
User=root
Group=lukepanel
RuntimeDirectory=lukepanel
RuntimeDirectoryMode=0750
ExecStart=/usr/local/bin/lukepanel --agent --config /etc/lukepanel/config.json
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK
LockPersonality=true
MemoryDenyWriteExecute=true

[Install]
WantedBy=multi-user.target
UNIT

cat > "$WEB_SERVICE" <<'UNIT'
[Unit]
Description=LukePanel lightweight system management panel
After=network-online.target lukepanel-agent.service
Wants=network-online.target
Requires=lukepanel-agent.service

[Service]
Type=simple
User=lukepanel
Group=lukepanel
ExecStart=/usr/local/bin/lukepanel --config /etc/lukepanel/config.json
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/lib/lukepanel /etc/lukepanel
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK
LockPersonality=true
MemoryDenyWriteExecute=true

[Install]
WantedBy=multi-user.target
UNIT

# 首次安装生成凭据；升级时完成配置迁移，避免 Web 与 Agent 并发迁移。
INITIAL_OUTPUT="$(runuser -u lukepanel -- /usr/local/bin/lukepanel --init --config "${CONFIG_DIR}/config.json")"
chown -R lukepanel:lukepanel "$CONFIG_DIR" "$DATA_DIR"
chmod 0750 "$CONFIG_DIR" "$DATA_DIR"
chmod 0600 "${CONFIG_DIR}/config.json" "${CONFIG_DIR}/config.json.lock" 2>/dev/null || true

systemctl daemon-reload
systemctl enable --now lukepanel-agent.service lukepanel.service

log "安装或升级完成"
printf '监听地址：127.0.0.1:6767\n'
printf '配置文件：%s/config.json\n' "$CONFIG_DIR"
printf 'Agent：/run/lukepanel/agent.sock\n'
printf '卸载命令：lukepanel-uninstall（保留数据）\n'
printf '彻底卸载：lukepanel-uninstall --purge\n'
printf '请通过 Nginx Proxy Manager 使用 HTTPS 反向代理。\n'
if [[ "$INITIAL_OUTPUT" == *"initial credentials"* ]]; then
  printf '\n%s\n' "$INITIAL_OUTPUT"
fi
