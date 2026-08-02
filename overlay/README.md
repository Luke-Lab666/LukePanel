<p align="center">
  <img src="web/assets/lukepanel-icon-192.png" width="112" height="112" alt="LukePanel 图标">
</p>

<h1 align="center">LukePanel</h1>

<p align="center">轻量、移动端优先的单服务器 Linux 管理面板</p>
<p align="center">当前版本：<code>v2.0.0</code></p>

LukePanel 面向需要维护单台 Debian 或 Ubuntu 服务器的个人用户和小型团队。前端使用 React 19 + TypeScript，后端使用 Go；发布后仍以单二进制运行，服务器不需要安装 Node.js。

它不是把 root Shell 搬进浏览器。Web 服务以普通系统用户运行，高权限操作由独立 Agent 通过本地 Unix Socket 执行；Agent 只接受经过校验的固定动作。

## 核心能力

- 实时 CPU、负载、内存、Swap、磁盘和网络概览
- systemd 服务、进程、网络、存储、定时器和安全计划任务
- APT 预检、升级、软件包搜索与软件源管理
- Docker 容器、镜像构建、网络、存储卷、Compose 和安全清理
- 文件浏览、上传、编辑、搜索、压缩、回收站、版本对比与恢复
- SSH 用户、公钥、端口、Root 登录和转发策略
- Passkey、TOTP、恢复码、可信设备和会话管理
- UFW、Fail2ban、IP 允许列表、登录通知和审计日志
- 可选 GitHub Device Flow、仓库、Actions、PR、Tag 和 Release 工作流
- 手机、平板和桌面统一响应式界面；一级页面不显示无意义返回按钮

## 支持范围

- Debian 12 / 13
- 使用 systemd 与 APT 的 Ubuntu
- Linux AMD64 / ARM64

LukePanel 只管理当前服务器，不提供 Kubernetes、Docker Swarm、邮件托管、网站面板或浏览器任意 root Shell。

## 安装与升级

请先确认 GitHub Releases 已发布对应版本，然后以 `root` 执行：

```bash
curl -fsSL https://raw.githubusercontent.com/Luke-Lab666/LukePanel/main/install.sh | bash
```

首次安装会要求设置管理员用户名、强密码和本地监听端口。再次运行安装器会校验 Release 文件并保留现有配置和数据。

默认监听：

```text
127.0.0.1:6767
```

建议通过 Nginx、Caddy 或 Nginx Proxy Manager 提供 HTTPS。不要把 Agent Socket 或 Docker Socket 暴露到网络。

## 安全模型

- `lukepanel.service` 使用普通 `lukepanel` 用户运行
- `lukepanel-agent.service` 使用 root，仅监听受保护的 Unix Socket
- 修改请求使用 CSRF 校验
- 高风险操作需要短时密码二次验证
- 密码使用 PBKDF2-HMAC-SHA256 保存
- 会话 Cookie 使用 HttpOnly、SameSite 与 Secure 属性
- 密码、Cookie、私钥和访问令牌不会写入审计内容
- SSH 端口修改先保留旧端口，确认新端口可连接后再关闭旧端口
- 防火墙首次启用保留限时恢复入口，降低远程锁死风险

公网部署前请阅读 [SECURITY.md](SECURITY.md)。

## 配置与数据

```text
配置文件： /etc/lukepanel/config.json
数据目录： /var/lib/lukepanel
Agent：    /run/lukepanel/agent.sock
Web 服务： lukepanel.service
Agent 服务：lukepanel-agent.service
```

## 本地开发

要求：

- Node.js 22.12 或更高版本
- npm 10
- Go 1.23 或更高版本
- 完整系统集成测试需要 Linux

```bash
make frontend-install
make frontend-check
make test
make build VERSION=dev
```

构建流程：

1. `frontend/` 中的 React + TypeScript 源码由 Vite 构建到 `frontend/dist/`。
2. `make frontend` 将构建产物、PWA manifest 和品牌图标暂存到 `internal/server/webdist/`。
3. Go 使用 `go:embed` 将静态资源写入最终单二进制。

运行中的服务器不需要 Node.js。不要手工提交 `frontend/dist/` 或 `internal/server/webdist/` 的生成文件。

更多前端约束见 [docs/FRONTEND.md](docs/FRONTEND.md)。

## 常用排查

```bash
systemctl status lukepanel.service lukepanel-agent.service --no-pager
journalctl -u lukepanel.service -u lukepanel-agent.service -n 100 --no-pager
ss -lntp | grep 6767
ls -l /run/lukepanel/agent.sock
```

提交问题时请提供版本、操作系统、架构、相关日志和复现步骤。分享日志前删除 Token、密码、私钥、Cookie 和公网 IP 等敏感信息。

## 卸载

保留配置和数据：

```bash
lukepanel-uninstall
```

删除程序及全部 LukePanel 数据：

```bash
lukepanel-uninstall --purge
```

## 许可证

参见 [LICENSE](LICENSE)。
