#!/usr/bin/env bash
set -Eeuo pipefail

PURGE=false
ASSUME_YES=false
for arg in "$@"; do
  case "$arg" in
    --purge) PURGE=true ;;
    --yes|-y) ASSUME_YES=true ;;
    --help|-h)
      cat <<'EOF'
LukePanel 卸载工具

用法：
  lukepanel-uninstall          卸载程序和服务，保留配置与数据
  lukepanel-uninstall --purge  彻底删除程序、配置、审计、备份与面板用户
  lukepanel-uninstall --yes    跳过交互确认
EOF
      exit 0
      ;;
    *) printf '未知参数：%s\n' "$arg" >&2; exit 2 ;;
  esac
done

log(){ printf '[LukePanel] %s\n' "$*"; }
die(){ printf '[LukePanel] 错误：%s\n' "$*" >&2; exit 1; }
[[ ${EUID:-$(id -u)} -eq 0 ]] || die '请使用 root 运行卸载工具'

if [[ "$ASSUME_YES" != true && -t 0 ]]; then
  if [[ "$PURGE" == true ]]; then
    printf '将彻底删除 LukePanel、配置、审计和备份数据。输入 PURGE 继续：'
    read -r answer
    [[ "$answer" == 'PURGE' ]] || die '已取消'
  else
    printf '将卸载 LukePanel 程序和服务，配置与数据会保留。继续？[y/N] '
    read -r answer
    [[ "$answer" =~ ^[Yy]$ ]] || die '已取消'
  fi
fi

log '停止并禁用服务'
systemctl disable --now lukepanel.service lukepanel-agent.service 2>/dev/null || true
rm -f /etc/systemd/system/lukepanel.service /etc/systemd/system/lukepanel-agent.service
systemctl daemon-reload
systemctl reset-failed lukepanel.service lukepanel-agent.service 2>/dev/null || true

log '删除程序文件'
rm -f /usr/local/bin/lukepanel /usr/local/sbin/lukepanel-uninstall
rm -rf /run/lukepanel

if [[ "$PURGE" == true ]]; then
  log '删除配置、审计、备份和回收站'
  rm -rf /etc/lukepanel /var/lib/lukepanel
  if id lukepanel >/dev/null 2>&1; then userdel lukepanel 2>/dev/null || true; fi
  if getent group lukepanel >/dev/null 2>&1; then groupdel lukepanel 2>/dev/null || true; fi
  log '彻底卸载完成'
else
  log '卸载完成，已保留 /etc/lukepanel 和 /var/lib/lukepanel'
  printf '重新安装后会继续使用原有密码和数据。\n'
fi
