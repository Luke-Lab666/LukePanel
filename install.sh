#!/usr/bin/env bash
set -Eeuo pipefail

REPO="Luke-Lab666/LukePanel"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/lukepanel"
DATA_DIR="/var/lib/lukepanel"
WEB_SERVICE="/etc/systemd/system/lukepanel.service"
AGENT_SERVICE="/etc/systemd/system/lukepanel-agent.service"
UNINSTALL_COMMAND="/usr/local/sbin/lukepanel-uninstall"

PORT=""
ADMIN_USER=""
PASSWORD_FILE=""
NON_INTERACTIVE=0

log() { printf '[LukePanel] %s\n' "$*"; }
die() { printf '[LukePanel] 错误：%s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'USAGE'
LukePanel 安装器

用法：
  install.sh [选项]

选项：
  --port PORT              首次安装的面板端口（默认 6767）
  --username USER          首次安装的管理员用户名（默认 admin）
  --password-file FILE     从文件读取首次安装密码（推荐自动化使用）
  --non-interactive        不询问；未提供密码时自动生成
  -h, --help               显示帮助

升级安装会保留现有端口、用户名和密码。
USAGE
}

while (($#)); do
  case "$1" in
    --port) [[ $# -ge 2 ]] || die "--port 缺少参数"; PORT="$2"; shift 2 ;;
    --username) [[ $# -ge 2 ]] || die "--username 缺少参数"; ADMIN_USER="$2"; shift 2 ;;
    --password-file) [[ $# -ge 2 ]] || die "--password-file 缺少参数"; PASSWORD_FILE="$2"; shift 2 ;;
    --non-interactive) NON_INTERACTIVE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "未知参数：$1" ;;
  esac
done

[[ ${EUID:-$(id -u)} -eq 0 ]] || die "请使用 root 运行安装器"
command -v curl >/dev/null || die "缺少 curl"
command -v sha256sum >/dev/null || die "缺少 sha256sum"
command -v systemctl >/dev/null || die "当前系统不支持 systemd"

FIRST_INSTALL=0
[[ -s "${CONFIG_DIR}/config.json" ]] || FIRST_INSTALL=1
TEMP_PASSWORD_FILE=""
INIT_PASSWORD_COPY=""
cleanup() {
  [[ -z "$TEMP_PASSWORD_FILE" ]] || rm -f "$TEMP_PASSWORD_FILE"
  [[ -z "$INIT_PASSWORD_COPY" ]] || rm -f "$INIT_PASSWORD_COPY"
  [[ -z "${TMP_DIR:-}" ]] || rm -rf "$TMP_DIR"
}
trap cleanup EXIT

validate_port() {
  [[ "$1" =~ ^[0-9]+$ ]] && ((10#$1 >= 1 && 10#$1 <= 65535))
}
port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "(^|[:.])${port}$"
  else
    return 1
  fi
}
read_tty() {
  local prompt="$1" default="${2:-}" value
  if [[ -r /dev/tty ]]; then
    if [[ -n "$default" ]]; then
      read -r -p "$prompt [$default]: " value </dev/tty || true
      printf '%s' "${value:-$default}"
    else
      read -r -p "$prompt: " value </dev/tty || true
      printf '%s' "$value"
    fi
  else
    printf '%s' "$default"
  fi
}
read_password_tty() {
  local first second
  while true; do
    read -r -s -p "管理员密码（至少 12 位，留空自动生成）: " first </dev/tty || true
    printf '\n' >/dev/tty
    [[ -z "$first" ]] && { printf ''; return; }
    read -r -s -p "再次输入管理员密码: " second </dev/tty || true
    printf '\n' >/dev/tty
    [[ "$first" == "$second" ]] || { printf '两次密码不一致，请重新输入。\n' >/dev/tty; continue; }
    ((${#first} >= 12)) || { printf '密码至少需要 12 个字符。\n' >/dev/tty; continue; }
    printf '%s' "$first"
    return
  done
}

INIT_PASSWORD=""
CUSTOM_PASSWORD=0
if ((FIRST_INSTALL)); then
  [[ -n "$ADMIN_USER" ]] || ADMIN_USER="admin"
  [[ -n "$PORT" ]] || PORT="6767"
  if ((NON_INTERACTIVE == 0)) && [[ -r /dev/tty ]]; then
    printf '\nLukePanel 首次安装设置\n' >/dev/tty
    ADMIN_USER="$(read_tty "管理员用户名" "$ADMIN_USER")"
    PORT="$(read_tty "面板端口" "$PORT")"
    if [[ -z "$PASSWORD_FILE" ]]; then
      INIT_PASSWORD="$(read_password_tty)"
    fi
  fi
  [[ "$ADMIN_USER" =~ ^[A-Za-z][A-Za-z0-9_.-]{2,31}$ ]] || die "用户名必须以字母开头，只能包含字母、数字、点、下划线或连字符，长度 3-32"
  validate_port "$PORT" || die "端口必须是 1-65535 的整数"
  port_in_use "$PORT" && die "端口 ${PORT} 已被占用，请更换端口"
  if [[ -n "$PASSWORD_FILE" ]]; then
    CUSTOM_PASSWORD=1
    [[ -r "$PASSWORD_FILE" ]] || die "无法读取密码文件：$PASSWORD_FILE"
  elif [[ -n "$INIT_PASSWORD" ]]; then
    CUSTOM_PASSWORD=1
    TEMP_PASSWORD_FILE="$(mktemp)"
    chmod 0600 "$TEMP_PASSWORD_FILE"
    printf '%s' "$INIT_PASSWORD" > "$TEMP_PASSWORD_FILE"
    PASSWORD_FILE="$TEMP_PASSWORD_FILE"
    unset INIT_PASSWORD
  fi
else
  log "检测到现有配置，保留原端口、用户名和密码"
fi

if ! command -v sqlite3 >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
  log "安装轻量审计索引依赖 sqlite3"
  DEBIAN_FRONTEND=noninteractive apt-get update -qq || true
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq sqlite3 || log "警告：sqlite3 安装失败，将使用 JSONL 兼容检索"
fi

case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) die "暂不支持的架构：$(uname -m)" ;;
esac

BINARY="lukepanel-linux-${ARCH}"
BASE_URL="https://github.com/${REPO}/releases/latest/download"
TMP_DIR="$(mktemp -d)"

log "下载最新版本（${ARCH}）"
curl -fL --retry 3 --connect-timeout 15 "${BASE_URL}/${BINARY}" -o "${TMP_DIR}/${BINARY}"
curl -fL --retry 3 --connect-timeout 15 "${BASE_URL}/SHA256SUMS" -o "${TMP_DIR}/SHA256SUMS"
curl -fL --retry 3 --connect-timeout 15 "${BASE_URL}/uninstall.sh" -o "${TMP_DIR}/uninstall.sh"
(
  cd "$TMP_DIR"
  grep "  ${BINARY}$" SHA256SUMS | sha256sum -c -
  grep "  uninstall.sh$" SHA256SUMS | sha256sum -c -
) || die "二进制校验失败"

if ! getent group lukepanel >/dev/null 2>&1; then groupadd --system lukepanel; fi
if ! id lukepanel >/dev/null 2>&1; then
  useradd --system --gid lukepanel --home-dir "$DATA_DIR" --shell /usr/sbin/nologin lukepanel
else
  usermod --gid lukepanel lukepanel
fi
install -d -o lukepanel -g lukepanel -m 0750 "$CONFIG_DIR" "$DATA_DIR"
if ((FIRST_INSTALL)) && [[ -n "$PASSWORD_FILE" ]]; then
  INIT_PASSWORD_COPY="${CONFIG_DIR}/.initial-password.$$"
  install -o lukepanel -g lukepanel -m 0600 "$PASSWORD_FILE" "$INIT_PASSWORD_COPY"
  PASSWORD_FILE="$INIT_PASSWORD_COPY"
fi
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
Environment=GODEBUG=tlsmlkem=1,tlssecpmlkem=1
User=root
Group=lukepanel
RuntimeDirectory=lukepanel
RuntimeDirectoryMode=0750
ExecStart=/usr/local/bin/lukepanel --agent --config /etc/lukepanel/config.json
Restart=on-failure
RestartSec=3
NoNewPrivileges=false
CapabilityBoundingSet=~
RestrictSUIDSGID=false
PrivateTmp=false
ProtectKernelTunables=false
ProtectKernelModules=false
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
Environment=GODEBUG=tlsmlkem=1,tlssecpmlkem=1
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

INIT_ARGS=(--init --config "${CONFIG_DIR}/config.json")
if ((FIRST_INSTALL)); then
  INIT_ARGS+=(--init-user "$ADMIN_USER" --init-listen "127.0.0.1:${PORT}")
  [[ -z "$PASSWORD_FILE" ]] || INIT_ARGS+=(--init-password-file "$PASSWORD_FILE")
fi
if ! INITIAL_OUTPUT="$(runuser -u lukepanel -- /usr/local/bin/lukepanel "${INIT_ARGS[@]}")"; then
  if ((FIRST_INSTALL)); then
    rm -f "${CONFIG_DIR}/config.json" "${CONFIG_DIR}/config.json.lock"
    rm -f "$WEB_SERVICE" "$AGENT_SERVICE"
  fi
  die "初始化失败，请检查用户名、密码或端口设置"
fi
chown -R lukepanel:lukepanel "$CONFIG_DIR" "$DATA_DIR"
chmod 0750 "$CONFIG_DIR" "$DATA_DIR"
chmod 0600 "${CONFIG_DIR}/config.json" "${CONFIG_DIR}/config.json.lock" 2>/dev/null || true

systemctl daemon-reload
systemctl enable --now lukepanel-agent.service lukepanel.service

LISTEN="$(sed -n 's/^[[:space:]]*"listen":[[:space:]]*"\([^"]*\)".*/\1/p' "${CONFIG_DIR}/config.json" | head -n1)"
CURRENT_USER="$(sed -n 's/^[[:space:]]*"admin_user":[[:space:]]*"\([^"]*\)".*/\1/p' "${CONFIG_DIR}/config.json" | head -n1)"
log "安装或升级完成"
printf '监听地址：%s\n' "${LISTEN:-127.0.0.1:6767}"
printf '管理员：%s\n' "${CURRENT_USER:-admin}"
printf '配置文件：%s/config.json\n' "$CONFIG_DIR"
printf 'Agent：/run/lukepanel/agent.sock\n'
printf '卸载命令：lukepanel-uninstall（保留数据）\n'
printf '彻底卸载：lukepanel-uninstall --purge\n'
printf '请通过 Nginx Proxy Manager 使用 HTTPS 反向代理。\n'
if ((FIRST_INSTALL && CUSTOM_PASSWORD)); then
  printf '管理员密码：已按安装参数设置\n'
elif [[ "$INITIAL_OUTPUT" == *"initial credentials"* ]]; then
  printf '\n%s\n' "$INITIAL_OUTPUT"
fi
