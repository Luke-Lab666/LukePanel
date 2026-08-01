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
      ├── JSONL 审计、可重建 SQLite 索引与嵌入式前端
      │
      │ /run/lukepanel/agent.sock + Agent Secret
      ▼
lukepanel-agent.service（root）
      ├── Docker Engine Unix Socket / Compose CLI
      ├── systemctl / journalctl
      ├── 进程信号、网络、存储、timer、APT 与后台任务
      ├── 文件写入、复制、备份与回收站
      ├── SSH、UFW、Fail2ban 与主机安全管理
      └── 文件、快照、完整备份恢复与回收站
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

- 公开仓库信息可无凭据读取；私有仓库和写操作使用用户主动完成的 OAuth Device Flow。
- OAuth App Client ID 是公开标识，可保存在浏览器本地；不需要向 LukePanel 提供 Client Secret。
- GitHub Access Token 只保存在当前 Web 会话对应的内存中，不写磁盘、不写审计、不写应用日志；退出或服务重启后清除。
- ZIP 导入先解压到 `/var/lib/lukepanel/github-imports` 临时目录，并限制压缩包、展开体积、单文件大小和文件数量。
- ZIP 中的 `.git`、macOS 元数据、符号链接和越界路径会被忽略或拒绝。
- 推送通过 GitHub Git Data API 创建 Blob、Tree、Commit，再非强制更新分支 Ref；预览后分支变化会拒绝提交。
- 默认只新增或覆盖 ZIP 中存在的文件，不删除仓库其他文件，也不开放历史改写或 Force Push。

## 数据存储

- `/etc/lukepanel/config.json`：配置、密码哈希、会话密钥和 Agent Secret。
- `/etc/lukepanel/config.json.lock`：配置迁移锁。
- `/var/lib/lukepanel/audit.jsonl`：追加式操作审计；20MB 自动轮转并保留 3 份。
- `/var/lib/lukepanel/backups/files/`：在线编辑备份。
- `/var/lib/lukepanel/backups/ssh/`：SSH 公钥文件备份。
- `/var/lib/lukepanel/recycle/`：回收站对象与元数据。
- `/var/lib/lukepanel/github-imports/`：GitHub ZIP 预览临时文件，30 分钟过期或会话结束后清理。
- `/run/lukepanel/agent.sock`：临时 Unix Socket。

## 后台任务

APT 下载/升级、软件安装删除和 Docker 镜像构建通过 Agent 内的固定任务注册表执行。任务 ID、状态、开始/结束时间和输出保存在 Agent 内存中，浏览器关闭或反向代理连接断开不影响子进程；Agent 重启会结束正在运行的任务。任务类型和参数均经过白名单校验，不接受 Shell 字符串。

## 面板备份与恢复

- 导出包含配置、JSONL 审计、快照、文件备份、文件偏好和回收站。
- SQLite 仅是查询索引，不进入备份；恢复后从 JSONL 重建。
- 上传限制 512MB、最多 10,000 个条目和 2GB 展开体积，拒绝绝对路径、路径穿越、符号链接和特殊文件。
- 恢复不会导入其他机器的监听地址、DataDir、Agent Socket、Agent Secret、Session Secret、Secure Cookie 和 Trusted Proxy。
- 数据目录先安装到临时位置再原子切换，失败会回滚。

## 主机安全边界

UFW、SSH 端口、密码登录、IP 允许列表和 Fail2ban 都采用“保留当前访问路径 → 校验 → 应用 → 确认 → 取消恢复”的策略。不能证明新路径可用时，不自动删除旧登录路径。
