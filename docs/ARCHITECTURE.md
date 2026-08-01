# 架构设计

## 进程模型

```text
Browser / PWA
      │ HTTPS（NPM）
      ▼
lukepanel.service（普通用户）
      ├── 登录、会话、CSRF、限速
      ├── /proc 实时概览与 SSE
      ├── GitHub HTTPS API（仅用户主动调用）
      ├── 审计与嵌入式前端
      │
      │ /run/lukepanel/agent.sock + Agent Secret
      ▼
lukepanel-agent.service（root）
      ├── Docker Engine Unix Socket / Compose CLI
      ├── systemctl / journalctl
      ├── 进程信号、网络、存储、timer、APT 检查
      ├── 文件写入、复制、备份与回收站
      └── SSH authorized_keys 管理
```

Agent 不监听 TCP，不接收通用 Shell 字符串。Compose 命令只从 Docker 容器可信标签重新发现项目路径和配置文件，再以固定 argv 调用 `docker compose`。

## 实时概览

- 浏览器进入概览后建立单条同源 SSE 连接。
- 服务端每 2 秒读取 `/proc`、`statfs` 和网络计数器。
- 前端只更新对应数值与进度条，不重建页面。
- 页面隐藏、切换路由、会话失效时立即关闭连接。
- 反向代理不支持 SSE 时自动降级为设置中的兼容轮询间隔。

这比在服务器常驻 Prometheus/Grafana 更适合小规格单机 VPS。

## 文件权限边界

- 文件根目录由 `allowed_roots` 控制。
- 所有路径经过绝对化、清理、符号链接解析和二次范围检查。
- 授权根目录本身禁止复制、移动、改权限或删除。
- 写入型操作由 root Agent 完成并要求 Web 会话二次验证。
- 文本编辑原子替换；修改前自动备份。
- 删除先移动至 `/var/lib/lukepanel/recycle`，支持跨文件系统复制后删除。

## GitHub 边界

- 仓库公开信息使用无凭据 GET 请求，仅在用户打开 GitHub 页面时执行。
- 写操作必须使用用户当次输入的 Fine-grained Token。
- Token 不写磁盘、不写审计、不写应用日志；请求完成后前端清空输入框。
- 面板仅开放创建版本 Tag 和重试失败 Actions，不提供任意仓库文件写入。

## 数据存储

- `/etc/lukepanel/config.json`：配置、密码哈希、会话密钥和 Agent Secret。
- `/etc/lukepanel/config.json.lock`：配置迁移锁。
- `/var/lib/lukepanel/audit.jsonl`：追加式操作审计；20MB 自动轮转并保留 3 份。
- `/var/lib/lukepanel/backups/files/`：在线编辑备份。
- `/var/lib/lukepanel/backups/ssh/`：SSH 公钥文件备份。
- `/var/lib/lukepanel/recycle/`：回收站对象与元数据。
- `/run/lukepanel/agent.sock`：临时 Unix Socket。
