# LukePanel

面向 Debian 12/13 的轻量系统管理面板。移动端优先、桌面端增强；核心由 Go 单二进制构成，不依赖 Node.js 运行时、Redis、外部数据库、Prometheus 或 Grafana。

> 当前版本：`v0.8.0-alpha`。已经覆盖单机 VPS 的高频日常管理，但仍处于 Alpha 阶段。生产使用必须放在 HTTPS 反向代理后，并限制访问来源。

## 设计目标

- **低占用**：Web 和 root Agent 按需工作，概览离开前台后停止实时采集。
- **手机好用**：底部导航、卡片式操作、触控尺寸、完整安全区留白。
- **不藏风险**：停止服务、删除文件、修改 SSH、公有仓库写入等操作需要再次验证。
- **不做 WebShell**：Agent 只开放固定动作，不接受浏览器传入的通用 `sh -c`。

## 已实现

### 实时系统概览

- CPU、内存、Swap、系统盘、负载和运行时间
- 实时上传/下载速率与累计流量
- Server-Sent Events 每 2 秒推送，不刷新整个页面
- 页面不可见或离开概览后立即断开实时流
- SSE 不可用时自动切回低频兼容刷新

### 系统管理

- systemd 服务搜索、运行/异常筛选、启动、停止、重启和日志
- 进程 CPU/内存排行，支持 SIGTERM / SIGKILL
- 网络接口、地址、累计流量和监听端口
- 存储分区与空间占用；默认隐藏 overlay、netns、BPF、重复绑定挂载等虚拟项目
- 安全计划任务：重启 systemd 服务、重启 Docker 容器、安全清理 Docker；不接受任意 Shell
- 原生 systemd timer 查看
- APT 升级预检、下载、执行、软件包搜索/安装/删除；升级前自动创建快照并尝试修复 dpkg 中断
- 主机名、时区、系统 DNS、Swap 和固定 sysctl 优化预设
- 自动配置快照列表、内容查看、恢复和删除
- SSH Server 状态、可登录用户与 `authorized_keys` 公钥管理
- SSH ED25519 密钥生成与一次性私钥下载；可选私钥口令
- SSH 端口、Root 登录、TCP/Agent/X11 转发可视化设置；端口变更采用双端口确认避免失联
- 密钥登录确认后可安全关闭密码登录，配置校验失败自动回滚

### Docker

- Docker Engine 状态和版本；未安装时可使用 Debian/Ubuntu 软件源快捷安装
- 概览页每 10 秒低频同步容器数量
- 运行容器 CPU、内存、网络和块设备 I/O 按需实时统计
- 容器列表、状态、镜像、端口、启停、重启、删除和日志
- 非 Compose 容器全可视化编辑：镜像、环境变量、命令、端口、挂载、网络、特权模式和重启策略
- 编辑采用安全重建事务；新容器失败时自动恢复旧容器
- Compose YAML 多文件在线编辑、语法校验、保存前快照、失败回滚和可选立即部署
- Compose 容器引导编辑对应 YAML，避免面板配置与 Compose 漂移
- 镜像列表、拉取、可视化构建和删除
- 网络与存储卷查看、创建和删除
- 安全/深度清理预览，按需清理停止容器、未使用镜像、网络和存储卷
- 自动识别 Docker Compose 项目
- Compose 拉取、启动、停止、重启和下线

### 文件管理

- 允许目录浏览，默认包含 `/home`、`/root`、`/opt`、`/srv`、`/var/www`、`/etc`、`/usr/local`
- 可点击面包屑路径与一键复制完整路径
- 当前目录筛选、授权目录递归搜索、多文件上传、文件夹上传和下载
- 图片/PDF 预览、ZIP 内容浏览，ZIP/TAR.GZ 在线压缩
- ZIP 安全解压，支持 iPhone 大批量文件导入，并阻止路径穿越与符号链接
- 新建文件/文件夹、在线文本编辑（最大 2MB）
- 重命名、复制、移动、八进制权限修改
- 删除进入 LukePanel 回收站
- 回收站查看、恢复到原位置/新位置、永久清理
- 跨文件系统复制、移动和回收
- 编辑前自动备份；文件备份总量自动限制为 500MB / 500 份
- 单文件历史版本列表、差异对比和一键恢复；恢复前再次备份当前版本
- 授权根目录保护、符号链接越界防护
- 系统密码文件、SSH 私钥和常见私钥文件禁止在线读取或下载

### 工具、日志与审计

- Ping、DNS、TCP 端口、HTTP 检查
- 固定模板一键系统诊断：负载、内存、Swap、磁盘、异常服务和监听端口；不接受任意命令
- systemd 系统日志
- 操作审计搜索、单条复制、当前结果一键复制、JSON/文本导出
- 审计文件 20MB 自动轮转，最多保留 3 个历史文件
- 审计不记录密码、GitHub Token 或 Cookie

### GitHub 新手助手（可选）

- 默认关闭且不预设任何用户或仓库；从常用工具按需启用
- GitHub OAuth Device Flow 网页登录；不需要在面板保存用户名、密码或 Client Secret
- 授权 Token 只保存在当前 LukePanel 会话内存，退出或服务重启后清除
- 检查仓库默认分支、最新提交、Tag、Release 和最近 Actions
- 上传源码 ZIP，自动去掉外层目录并忽略 `.git`、macOS 元数据
- 提交前预览新增、修改和未变化文件
- 使用 Git Trees / Commit / Ref API 直接 Commit + Push，不依赖服务器安装 Git
- 默认增量覆盖，不删除 ZIP 中缺失的仓库文件，不 Force Push
- 预览后远端分支发生变化时拒绝提交，避免覆盖新提交
- 创建分支和 Pull Request，支持“新建分支 → ZIP 推送 → PR 合并”的小白流程
- 创建版本 Tag、触发 Release、重试失败 Actions
- 修改 `.github/workflows` 需要 GitHub 授权包含 workflow 权限

### 导航与账户体验

- 所有非首页页面提供明确返回按钮，子模块返回系统管理，顶级模块返回概览
- 当前页面写入浏览器会话状态；刷新或重新登录后回到原页面，而不是强制跳转概览
- 登录、修改密码和二次验证统一使用英文键盘提示，关闭自动大写、纠错和拼写检查
- 移动端“我的与安全”提供顶部退出和独立退出当前账号按钮
- 内置 `lukepanel-uninstall` 命令；默认保留数据，`--purge` 可彻底卸载

### 安全

- PBKDF2-HMAC-SHA256 密码哈希（600,000 次迭代）
- HttpOnly、SameSite=Strict、Secure Cookie
- CSRF 防护与登录失败限速
- 会话查看和退出其他设备
- TOTP 身份验证器与一次性恢复码；未开启时登录页完全不渲染验证码框，密码验证通过且已开启时才出现
- 恢复码只保存哈希并在使用后立即作废
- 用户名修改、两次新密码一致性校验与服务端弱密码拒绝
- 主机安全体检、安全分、Fail2ban 防暴力破解和自动安全更新快捷启用
- Fail2ban 自动忽略当前网页访问 IP、内网网段和现有 SSH 连接 IP，降低误封自己的风险
- 高风险操作二次验证，授权窗口 5 分钟
- Web 普通用户与 root Agent 通过本地 Unix Socket 隔离
- Agent Secret 固定时序比较，Agent 不监听 TCP

## 安装或升级

先确保最新版本已经出现在 GitHub Releases，然后以 root 执行：

```bash
curl -fsSL https://raw.githubusercontent.com/Luke-Lab666/LukePanel/main/install.sh | bash
```

安装器会自动识别 AMD64 / ARM64，下载并校验二进制，安装或升级两个 systemd 服务。升级保留现有密码、配置、审计、备份和回收站，并安装 `lukepanel-uninstall` 卸载命令。

默认链路：

```text
浏览器 → HTTPS / Nginx Proxy Manager → 127.0.0.1:6767
                                      ↓ Unix Socket
                              /run/lukepanel/agent.sock
```

不要直接把 `6767`、Docker Socket 或 Agent Socket 暴露到公网。

## 卸载

保留配置、密码、审计、备份和回收站：

```bash
lukepanel-uninstall
```

彻底删除程序与全部数据：

```bash
lukepanel-uninstall --purge
```

默认卸载后重新运行安装命令，会继续使用原有账号和数据。

## 登录

默认用户名：

```text
admin
```

随机初始密码只在首次安装终端显示，配置文件中只保存密码哈希，无法反查明文。

## 配置

配置路径：

```text
/etc/lukepanel/config.json
```

示例：

```json
{
  "listen": "127.0.0.1:6767",
  "data_dir": "/var/lib/lukepanel",
  "agent_socket": "/run/lukepanel/agent.sock",
  "secure_cookie": true,
  "auto_refresh_seconds": 5,
  "allowed_roots": ["/home", "/root", "/opt", "/srv", "/var/www", "/etc", "/usr/local"]
}
```

`auto_refresh_seconds` 只用于 SSE 不可用时的兼容刷新。实时模式固定为 2 秒，并且只在概览页面可见时运行。

修改配置后：

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

- Docker 镜像构建和交互式容器终端仍未开放；浏览器任意 WebShell 不在项目范围内。
- GitHub ZIP 推送支持分支和 PR，但不执行自动 Rebase、复杂冲突解决或历史改写；检测到远端变化会停止推送。
- GitHub 网页登录首次需要用户自己创建 OAuth App 并启用 Device Flow；Client ID 可保存在浏览器本地。
- 计划任务只提供经过参数校验的固定模板，不允许用户输入任意 Shell。
- APT 支持模拟检查，并可启用 unattended-upgrades 自动安全更新；手动全量升级仍会先实现下载、快照提示和可恢复流程。
- Passkey、IP 白名单、安全通知与 SQLite 大规模审计检索仍在后续阶段。
