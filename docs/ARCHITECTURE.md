# 架构设计

## 进程模型

```text
Browser / PWA
      │ HTTPS（NPM）
      ▼
lukepanel.service（普通用户）
      ├── 登录、会话、CSRF、限速
      ├── /proc 系统概览
      ├── 工具调用与审计
      └── 嵌入式 HTML / CSS / ES Module
      │
      │ /run/lukepanel/agent.sock
      ▼
lukepanel-agent.service（root）
      ├── Docker Engine Unix Socket
      ├── systemctl / journalctl
      ├── 进程信号
      ├── 文件写入、备份与回收站
      └── 网络、存储、timer、APT 检查
```

Agent 不监听 TCP，不接受任意命令字符串，只开放固定方法和参数白名单。

## 数据存储

- `/etc/lukepanel/config.json`：配置、密码哈希、会话签名密钥和 Agent Secret。
- `/etc/lukepanel/config.json.lock`：配置迁移和并发写入锁。
- `/var/lib/lukepanel/audit.jsonl`：操作审计。
- `/var/lib/lukepanel/backups/files/`：在线编辑前备份。
- `/var/lib/lukepanel/recycle/`：文件回收站。
- `/run/lukepanel/agent.sock`：临时 Unix Socket。

## 前端刷新策略

- 系统概览默认 5 秒刷新。
- 只在概览路由且页面可见时轮询。
- 页面进入后台立即停止定时器。
- 回到前台立即刷新一次。
- 更新指标时只修改 DOM 数值，不重建整个页面。
