# Security Policy

LukePanel 仍处于 Alpha 阶段。不要在没有 HTTPS、强密码、访问控制和可信反向代理的情况下暴露到公网。

## 权限模型

- `lukepanel.service` 以普通 `lukepanel` 用户运行。
- `lukepanel-agent.service` 以 root 运行，仅监听本地 Unix Socket。
- Web 与 Agent 使用随机 Agent Secret 和固定时序比较认证。
- Agent 只接受固定 API，不提供任意 Shell 或 `sh -c`。
- 文件访问受 `allowed_roots`、符号链接解析和授权根保护三层限制。

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
