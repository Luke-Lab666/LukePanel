# Security Policy

LukePanel v1.0.0 已进入稳定维护阶段。即使如此，也不要在没有 HTTPS、强密码、访问控制和可信反向代理的情况下暴露到公网。

## 权限模型

- `lukepanel.service` 以普通 `lukepanel` 用户运行。
- `lukepanel-agent.service` 以 root 运行，仅监听本地 Unix Socket。
- Web 与 Agent 使用随机 Agent Secret 和固定时序比较认证。
- Agent 只接受固定 API，不提供任意 Shell 或 `sh -c`。
- 文件访问经过路径规范化、符号链接解析、虚拟文件系统写保护和敏感文件二次验证。

## 默认安全措施

- 仅监听 `127.0.0.1:6767`
- PBKDF2-HMAC-SHA256，600,000 次迭代
- HttpOnly、SameSite=Strict、Secure Cookie
- CSRF Token
- 登录失败 5 次锁定 15 分钟
- CSP、X-Frame-Options、nosniff
- 配置和审计权限 `0600`
- 高风险操作再次验证当前密码，授权仅 5 分钟
- `/etc/shadow`、`/etc/gshadow`、SSH 私钥和常见私钥禁止预览、编辑或下载
- 在线编辑和 SSH 公钥修改前自动备份
- 文件删除先进入隔离回收站
- GitHub OAuth Token 仅保存在当前会话内存，不持久化、不审计；退出或重启后清除
- GitHub ZIP 推送不 Force Push，并在提交前检查远端分支是否变化


## 防失联设计

- UFW 首次启用自动保留 SSH 端口、当前访问 IP，并创建 5 分钟自动关闭恢复任务；确认连接后才取消恢复。
- SSH 端口变更先同时监听新旧端口，配置校验和新端口确认通过后再关闭旧端口。
- SSH 关闭密码登录前要求存在公钥，并在重载后读取实际生效配置；未生效或失败会自动回滚。
- 面板 IP 允许列表保存时保留当前地址并生成限时恢复 URL。
- Fail2ban 白名单始终保留回环和 RFC1918 网段，禁止从当前会话移除覆盖自身的 IP/CIDR。

## 账号与凭据

- 支持 TOTP、一次性恢复码、Passkey / WebAuthn 和可信设备。
- Passkey 挑战短时有效，凭据只保存公钥和计数器，不保存生物信息。
- GitHub OAuth Token 只存在 Web 进程内存；Telegram Bot Token 存于 0600 配置文件且不会返回页面。
- 完整备份会包含账号和安全配置，因此备份文件等同于高敏感凭据，必须加密保存并限制下载。

## 审计与恢复

- `audit.jsonl` 是持久审计来源，SQLite 仅为可重建查询索引。
- 面板恢复使用受限 TAR.GZ、路径穿越/链接拒绝、大小与文件数限制以及临时目录原子切换。
- 系统、SSH、UFW、Fail2ban、Compose 和 APT 高风险变更前创建配置快照。

## GitHub 授权建议

- 为 LukePanel 单独创建 GitHub OAuth App，并开启 Device Flow。
- OAuth 授权只使用当前需要的账号；不在其他人共享的面板上连接 GitHub。
- 仓库写入需要 `repo` 权限；修改 `.github/workflows` 还需要 `workflow` 权限。
- LukePanel 断开连接只清除本机内存 Token；需要彻底撤销授权时，在 GitHub Applications 设置中撤销 OAuth App。
- 上传 ZIP 前先核对目标仓库、分支和差异预览，提交后通过 GitHub Actions 检查结果。

## 部署建议

- 使用 Nginx Proxy Manager 或其他反向代理提供 HTTPS。
- 面板端口仅监听回环地址。
- 在防火墙或反向代理层限制可信 IP。
- 不要暴露 Docker Socket 或 Agent Socket。
- 定期检查审计日志、备份和回收站占用。

## 漏洞报告

不要在公开 Issue 中提交密码、Token、服务器地址、Cookie、私钥或完整日志。先提供不含敏感信息的复现步骤。
