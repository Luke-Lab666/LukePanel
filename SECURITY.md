# Security Policy

LukePanel 仍处于 Alpha 阶段，不建议在没有 HTTPS、强密码、访问控制和可信反向代理的情况下暴露到公网。

## 权限模型

- `lukepanel.service`：普通 `lukepanel` 用户，处理 Web、登录、会话和系统概览。
- `lukepanel-agent.service`：root 用户，仅监听本地 Unix Socket。
- Web 与 Agent 使用随机 Agent Secret 认证。
- Agent 只接受固定 API，不提供任意 Shell 或 `sh -c`。
- 文件访问受 `allowed_roots` 和符号链接解析双重限制。

## 默认安全措施

- 仅监听 `127.0.0.1:6767`
- PBKDF2-HMAC-SHA256，600,000 次迭代
- HttpOnly、SameSite=Strict、Secure Cookie
- CSRF Token
- 登录失败 5 次后锁定 15 分钟
- CSP、X-Frame-Options、nosniff
- 配置文件和审计日志权限 `0600`
- 高风险操作要求再次输入当前密码
- 二次验证授权窗口仅 5 分钟
- `/etc/shadow`、`/etc/gshadow`、SSH 私钥和常见私钥文件禁止预览、编辑或下载
- 在线编辑保存前自动备份

## 部署建议

- 使用 Nginx Proxy Manager 或其他反向代理提供 HTTPS。
- 面板端口只监听回环地址。
- 在防火墙或反向代理层限制可信 IP。
- 不要将 Docker Socket 或 Agent Socket 暴露到网络。
- 定期检查 `/var/lib/lukepanel/audit.jsonl`。

## 漏洞报告

请不要在公开 Issue 中提交密码、Token、服务器地址、Cookie 或完整日志。先提交不含敏感信息的复现说明。
