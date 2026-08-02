<p align="center">
  <img src="web/assets/lukepanel-icon-192.png" width="112" height="112" alt="LukePanel 图标">
</p>

<h1 align="center">LukePanel</h1>

<p align="center">
  轻量、移动端优先的单服务器 Linux 管理面板
</p>

<p align="center">
  当前版本：<code>v2.0.5</code>
</p>

LukePanel 面向需要维护单台 Debian 或 Ubuntu 服务器的个人用户和小型团队。它提供系统、Docker、文件、SSH、安全与审计管理，同时避免把浏览器变成任意 root WebShell。

Web 服务以普通系统用户运行；需要 root 权限的操作由独立 Agent 通过本地 Unix Socket 执行。Agent 只接受经过校验的固定动作，不接收浏览器传入的任意 Shell 命令。


## v2.0.5 安全与 GitHub 上传体验增强

- 官方 Release 使用 Go 1.26.5 构建，并显式启用 X25519MLKEM768、SecP256r1MLKEM768 与 SecP384r1MLKEM1024 后量子混合密钥交换；是否实际采用仍由 TLS 对端共同协商。
- 密码存储升级为 PBKDF2-HMAC-SHA-512（750,000 次迭代、24 字节随机盐、64 字节摘要）；旧 PBKDF2-HMAC-SHA-256 哈希会在完成密码与第二因素验证后自动迁移。
- 会话签名与恢复码校验升级为 HMAC-SHA-512，同时继续兼容并一次性迁移旧恢复码。
- 文件管理、GitHub ZIP 差异导入和 Release 附件上传显示真实字节进度、速度、预计剩余时间、服务端处理阶段，并支持取消。
- GitHub 助手可读取当前账号有权限访问的仓库并快速选择；设备登录在 iOS Safari 中预先创建授权窗口，降低弹窗被拦截的概率。
- GitHub API 大文件操作使用独立长超时传输客户端，避免旧版 30 秒总超时导致上传或 Release 操作中断。
- “抗 AI 加密”不是正式密码学算法名称；本版通过强密码派生、登录限速、TOTP、Passkey、会话保护和可审计高风险验证抵抗自动化猜测与凭据攻击。
- 前端使用 React 18 + TypeScript 离线构建，运行资源由 Go `embed` 内嵌且不依赖 CDN。

## 主要特点

- 适配手机、平板和桌面浏览器
- 实时 CPU、内存、Swap、磁盘和网络概览
- systemd 服务、进程、网络、存储和计划任务管理
- 带预检、快照和后台任务的 APT 软件管理
- Docker 容器、镜像、网络、存储卷和 Compose 管理
- 从 `/` 开始的文件管理、回收站和历史版本
- SSH 用户、公钥和安全设置管理
- Passkey、TOTP、恢复码、会话和登录保护
- UFW、Fail2ban、安全体检和审计日志
- 可选 GitHub 仓库、Actions、Pull Request 和 Release 工作流，支持真实上传进度与取消
- React 18 + TypeScript 前端，构建产物随 Go 单二进制内嵌；服务器运行时不依赖 Node.js、CDN、Redis 或外部数据库

## 支持范围

主要支持：

- Debian 12 / 13
- 使用 systemd 与 APT 的 Ubuntu
- AMD64 / ARM64

LukePanel 只管理当前服务器，不是多节点控制中心，也不提供 Kubernetes、Docker Swarm、网站托管、邮件托管或浏览器任意 root Shell。

## 安装

使用安装器前，请确认 GitHub Releases 中已经发布对应版本。

以 `root` 执行：

```bash
curl -fsSL https://raw.githubusercontent.com/Luke-Lab666/LukePanel/main/install.sh | bash
```

首次安装会要求设置：

- 管理员用户名
- 管理员密码
- 本地监听端口

密码留空时，安装器会生成随机强密码，并且只在首次安装终端中显示一次。升级安装会保留已有账号、端口、配置和数据。

### 非交互安装

不要把密码直接写进命令行参数或 Shell 历史。可以使用仅 root 可读的密码文件：

```bash
curl -fsSL https://raw.githubusercontent.com/Luke-Lab666/LukePanel/main/install.sh \
  -o /tmp/lukepanel-install.sh

printf '%s\n' '请替换为强密码' > /root/.lukepanel-password
chmod 600 /root/.lukepanel-password

bash /tmp/lukepanel-install.sh \
  --non-interactive \
  --username admin \
  --port 6767 \
  --password-file /root/.lukepanel-password

rm -f /root/.lukepanel-password
```

## 网络部署

默认监听：

```text
127.0.0.1:6767
```

建议通过 Nginx、Caddy 或 Nginx Proxy Manager 提供 HTTPS：

```text
浏览器 ── HTTPS ── 反向代理 ── 127.0.0.1:6767
                                      │
                                      └── Unix Socket ── root Agent
```

不要把 Agent Socket 或 Docker Socket 暴露到网络。公网部署时，应使用防火墙、VPN、IP 允许列表或其他可信访问层限制面板入口。

## 功能概览

### 系统概览与管理

- CPU、负载、内存、Swap、磁盘和网络实时状态
- systemd 服务搜索、日志、启动、停止和重启
- 进程 CPU / 内存排行与 TERM / KILL 操作
- 网卡、IP、累计流量和监听端口
- 文件系统和挂载点空间使用
- 基于固定动作的安全计划任务
- 主机名、时区、DNS、NTP、Swap 和受控 sysctl 预设

### 软件管理

- APT 升级模拟与风险预检
- 下载、升级、安装和删除后台任务
- 软件包搜索
- 软件源添加、启用、停用和删除
- 关键操作前自动创建配置快照

### Docker

- Docker Engine 检测与发行版软件包安装
- 容器状态、日志、资源统计和生命周期操作
- 容器可视化编辑与事务式重建
- 镜像搜索、拉取、构建和删除
- 网络与存储卷管理
- 存储卷占用、备份和恢复
- Compose 项目识别、编辑、校验和部署
- 清理前预览未使用资源

### 文件管理

- 从文件系统根目录浏览
- 文件、文件夹和 ZIP 上传
- 文件和目录下载
- 创建、编辑、复制、移动、重命名和权限修改
- ZIP / TAR.GZ 压缩与安全解压
- 图片、PDF 和 Markdown 预览
- 回收站与永久删除
- 自动备份、版本对比与恢复

`/proc`、`/sys`、`/dev` 和 `/run` 等虚拟文件系统不会开放普通写入。敏感文件操作需要近期密码验证，并写入审计日志。

### SSH 与安全

- SSH 服务状态与端口管理
- 登录用户和 `authorized_keys` 管理
- ED25519 密钥生成与一次性私钥下载
- 密码登录、Root 登录与转发设置
- Passkey / WebAuthn 登录
- TOTP、一次性恢复码和无用户名 Passkey
- 活跃会话管理
- 带限时恢复入口的 IP 允许列表
- UFW 规则与受保护的首次启用流程
- Fail2ban 状态、解封和白名单管理
- Telegram 登录通知

### 日志与备份

- JSONL 持久审计日志与可选 SQLite 查询索引
- 按用户、IP、动作、结果和时间筛选
- systemd Journal 查看
- 面板配置和数据备份
- 定时备份与保留策略

### GitHub 助手

GitHub 助手是内置的可选功能，可以在“常用工具”中显示或隐藏入口。它支持：

- GitHub Device Flow 登录和 Fine-grained Token 登录
- 自动读取当前账号可访问仓库并快速选择
- 仓库、分支、提交和 Actions 状态查看
- ZIP 差异预览与 Commit / Push，上传阶段显示真实进度、速度、剩余时间并支持取消
- Pull Request 创建与合并
- Tag、Release 和附件管理，附件上传显示真实传输与服务端处理状态
- Actions Job 日志读取

访问令牌只保存在 LukePanel 当前服务会话中，不显示在页面和审计日志里。服务重启或主动断开后，授权会被清除。

## 安全模型

LukePanel 将浏览器服务和高权限操作分离：

- `lukepanel.service` 使用普通 `lukepanel` 用户运行
- `lukepanel-agent.service` 使用 root 运行，只监听受保护的 Unix Socket
- Agent 只提供固定、可校验的管理动作
- 密码使用 PBKDF2-HMAC-SHA-512（750,000 次、随机盐、64 字节摘要）保存；旧 SHA-256 配置在完整登录后自动迁移
- 会话令牌与恢复码使用 HMAC-SHA-512 校验
- 官方 Go 1.26.5 Release 的出站 HTTPS 支持传统算法与 ML-KEM 后量子混合密钥交换；入站 HTTPS 仍由反向代理、浏览器和证书链共同决定
- 会话 Cookie 使用 HttpOnly、SameSite 与 Secure 属性
- 修改操作使用 CSRF 校验
- 高风险操作需要短时有效的当前密码验证；启用 TOTP 时还必须验证 TOTP 或恢复码
- 密码、Cookie、私钥和访问令牌不会写入审计内容

公网部署前请阅读 [SECURITY.md](SECURITY.md)。

## 配置与数据位置

```text
配置文件： /etc/lukepanel/config.json
数据目录： /var/lib/lukepanel
Agent：    /run/lukepanel/agent.sock
Web 服务： lukepanel.service
Agent 服务：lukepanel-agent.service
```

手动修改配置后：

```bash
systemctl restart lukepanel-agent.service lukepanel.service
```

## 升级

再次执行安装命令即可：

```bash
curl -fsSL https://raw.githubusercontent.com/Luke-Lab666/LukePanel/main/install.sh | bash
```

安装器会校验 Release 文件、更新二进制和 systemd 单元，并保留已有配置与数据。

## 卸载

保留配置和数据：

```bash
lukepanel-uninstall
```

删除程序及全部 LukePanel 数据：

```bash
lukepanel-uninstall --purge
```

## 排查

```bash
systemctl status lukepanel.service lukepanel-agent.service --no-pager
journalctl -u lukepanel.service -u lukepanel-agent.service -n 100 --no-pager
ss -lntp | grep 6767
ls -l /run/lukepanel/agent.sock
```

提交问题时，请提供 LukePanel 版本、操作系统、架构、相关服务日志和可复现步骤。分享日志前应删除 Token、密码、私钥、Cookie 和公网 IP 等敏感信息。

## 本地开发

要求：

- Go 1.23 或更高版本可进行兼容开发；正式安全 Release 固定使用 Go 1.26.5
- Node.js 20 或更高版本；执行 `npm --prefix frontend install` 安装固定版本的 TypeScript 编译器
- 完整系统集成测试需要 Linux

React 前端运行时已固定随仓库提交，正式构建不访问 CDN。开发机首次构建先安装固定版本的 TypeScript；目标 VPS 使用发行版二进制，不需要 Node.js：

```bash
npm --prefix frontend install --ignore-scripts --no-audit --no-fund
make frontend
make test
make verify
make build
```

`make frontend` 会严格编译 `frontend/src/app.tsx`，生成 `web/`，再同步到 `internal/server/webdist`。Go 二进制只嵌入这份经过校验的 React 成品。

## 项目状态

LukePanel v2.0.5 的页面、路由、状态、API 调用和弹窗均使用 React 18 + TypeScript。React 与 ReactDOM 固定版本随仓库内嵌，生产运行不依赖 CDN；旧版手写 DOM 与过渡前端均不进入正式资源链路。

执行软件升级、防火墙、SSH、Docker 和文件系统操作前，仍应保留服务器级备份。项目会尽量使用验证、快照和回滚降低风险，但任何具备 root 管理能力的面板都无法消除错误操作和系统差异带来的风险。

## 许可证

参见 [LICENSE](LICENSE)。
