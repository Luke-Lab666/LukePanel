# Roadmap

## v0.1 基础骨架

- [x] 单二进制服务
- [x] 响应式应用框架
- [x] 登录、会话、CSRF、登录限速
- [x] 面板内修改密码
- [x] 系统概览
- [x] 受限只读文件浏览
- [x] JSONL 基础审计
- [x] amd64 / arm64 CI 与 Release
- [x] 无 Git 安装器

## v0.2 系统与 Docker

- [ ] Docker Engine Unix Socket 客户端
- [ ] 容器列表、启停、重启与日志
- [ ] systemd 服务列表与控制
- [ ] journald 分页读取
- [ ] 实时网络速率
- [ ] Docker 磁盘空间分析

## v0.3 root agent 与文件管理

- [ ] Unix Socket root agent
- [ ] 文件上传、下载、新建、移动和回收站
- [ ] 文本编辑、差异对比与自动备份
- [ ] 敏感文件保护
- [ ] systemd / SSH / Docker 配置保存前校验

## v0.4 安全与审计

- [ ] TOTP
- [ ] Passkey / WebAuthn
- [ ] 会话设备管理
- [ ] SQLite 审计检索与导出
- [ ] IP 白名单与临时封禁页面
- [ ] 敏感操作五分钟授权窗口

## 不在近期范围

- Kubernetes / Swarm
- 多服务器控制中心
- 应用商店
- 网站托管和数据库面板
- 邮件服务器
- 任意 WebShell
