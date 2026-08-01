# Security Policy

LukePanel 仍处于 Alpha 阶段，不建议在没有 HTTPS 反向代理、强密码和访问控制的情况下暴露到公网。

## 默认安全措施

- 仅监听 `127.0.0.1:6767`
- PBKDF2-HMAC-SHA256，600,000 次迭代
- HttpOnly、SameSite=Strict Cookie
- CSRF Token
- 登录失败限速与 15 分钟锁定
- CSP、X-Frame-Options、nosniff
- 配置文件 0600
- Web 服务使用普通系统用户
- 文件目录 Allowed Roots 与符号链接越界检查

## 漏洞报告

请不要在公开 Issue 中提交密码、Token、服务器地址或完整日志。可以先创建不含敏感信息的安全问题说明。
