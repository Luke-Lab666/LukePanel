# LukePanel

面向 Debian 12/13 的轻量系统管理面板。移动端优先、桌面端增强，核心服务使用 Go 单二进制，不依赖 Node.js、Redis、外部数据库或 Prometheus。

> 当前版本：`v0.2.0-alpha`。已经具备日常单机 VPS 管理的核心能力，但仍处于 Alpha 阶段，建议通过 HTTPS 反向代理并限制访问来源。

## 已实现

### 系统与监控

- CPU、内存、Swap、系统盘、负载和运行时间
- 实时网络上传/下载速率与累计流量
- 系统概览自动刷新，可设为 2–60 秒
- 页面进入后台时自动暂停刷新，回到前台立即同步
- systemd 服务列表、启动、停止、重启和日志
- 进程 CPU/内存排行，支持 SIGTERM / SIGKILL
- 网络接口、地址、累计流量和监听端口
- 文件系统、挂载点与空间占用
- systemd timer 查看
- APT 可升级软件包模拟检查

### Docker

- Docker Engine 状态和版本
- 容器列表、状态、镜像、端口
- 启动、停止和重启容器
- 容器日志
- 镜像列表、拉取和删除
- Docker 网络与存储卷查看、删除

### 文件管理

- 受限根目录浏览
- 上传、下载、新建文件和目录
- 文本文件预览与编辑（最大 2MB）
- 保存前自动备份
- 重命名
- 删除到 LukePanel 回收站
- 符号链接越界防护
- 私钥、证书私钥和系统密码文件保护

### 工具、日志与安全

- Ping、DNS、TCP 端口、HTTP 检查
- systemd 日志与面板操作审计
- PBKDF2-HMAC-SHA256 密码哈希（600,000 次迭代）
- HttpOnly + SameSite=Strict Cookie
- CSRF 防护与登录失败限速
- 会话查看和退出其他设备
- 高风险操作二次验证，验证后 5 分钟内免重复输入
- Web 服务普通用户运行，root 权限由本地 Unix Socket Agent 隔离

## 安装或升级

先在 GitHub Releases 发布最新版本，然后以 root 执行：

```bash
curl -fsSL https://raw.githubusercontent.com/Luke-Lab666/LukePanel/main/install.sh | bash
```

安装器会：

1. 自动识别 AMD64 / ARM64。
2. 下载 Release 二进制并校验 SHA256。
3. 创建 `lukepanel` 系统用户。
4. 安装 Web 服务和本地 root Agent。
5. 首次安装输出随机管理员密码；升级保留原密码和配置。

默认访问链路：

```text
浏览器 → HTTPS / Nginx Proxy Manager → 127.0.0.1:6767
                                      ↓ Unix Socket
                              /run/lukepanel/agent.sock
```

不要直接将 `6767` 端口开放到公网。

## 登录

默认用户名：

```text
admin
```

初始密码仅在首次安装终端显示。配置文件只保存密码哈希，无法反查明文。

## 配置

配置路径：

```text
/etc/lukepanel/config.json
```

主要字段：

```json
{
  "listen": "127.0.0.1:6767",
  "data_dir": "/var/lib/lukepanel",
  "agent_socket": "/run/lukepanel/agent.sock",
  "secure_cookie": true,
  "auto_refresh_seconds": 5,
  "allowed_roots": ["/home", "/opt", "/srv", "/var/www", "/etc"]
}
```

修改配置后执行：

```bash
systemctl restart lukepanel-agent lukepanel
```

## 服务排查

```bash
systemctl status lukepanel lukepanel-agent --no-pager
journalctl -u lukepanel -u lukepanel-agent -n 100 --no-pager
ss -lntp | grep 6767
ls -l /run/lukepanel/agent.sock
```

## 本地开发

要求 Go 1.23+，前端无需 npm：

```bash
make test
make build VERSION=dev
```

## 当前限制

- Docker Compose 项目编排尚未接入；镜像、网络和存储卷已提供基础管理。
- SSH 配置编辑、Cron 写入、APT 实际升级尚未开放。
- TOTP 与 Passkey 仍在规划中。
- 回收站跨文件系统移动暂不支持。
- 当前审计使用 JSONL，后续再迁移 SQLite 检索。
