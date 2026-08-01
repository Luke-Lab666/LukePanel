# LukePanel

一个面向 Debian 12/13 的轻量系统管理面板。目标是移动端优先、桌面端增强，并尽量减少常驻资源占用。

> 当前状态：`v0.1.0-alpha` 基础骨架。已提供安全登录、系统概览、响应式导航和受限只读文件浏览。Docker、systemd、日志审计界面与写入型文件操作仍在开发。

## 已实现

- Go 单二进制后端，前端静态资源嵌入程序
- 零前端运行依赖的现代简约响应式界面
- 手机底部导航、桌面侧栏
- PBKDF2-HMAC-SHA256 密码哈希（600,000 次迭代）
- HttpOnly + SameSite=Strict 会话 Cookie
- CSRF Token
- 登录失败限速与临时锁定
- CPU、内存、磁盘、负载、网络、运行时间概览
- 文件目录安全只读浏览
- Allowed Roots 与符号链接越界检查
- JSONL 基础审计日志
- 深色/浅色主题
- PWA Manifest 基础

## 安装

发布首个 Release 后，可直接执行：

```bash
curl -fsSL https://raw.githubusercontent.com/Luke-Lab666/LukePanel/main/install.sh | bash
```

安装器只下载 Release 二进制和校验文件，不安装 Git，也不会克隆仓库。

## 本地开发

要求：Go 1.23+。前端无需 Node.js 或 npm。

```bash
make build
```

使用普通用户目录测试：

```bash
mkdir -p .dev/data
LUKEPANEL_CONFIG="$PWD/.dev/config.json" ./dist/lukepanel
```

首次启动或执行 `--init` 会在终端打印随机初始密码。登录后可在“我的与安全”中立即修改。测试 HTTP 环境请将生成配置中的 `secure_cookie` 临时改为 `false`；生产环境必须通过 HTTPS 反代并保持为 `true`。

## 默认监听

```text
127.0.0.1:6767
```

推荐通过 Nginx Proxy Manager 反向代理，不要直接将面板端口暴露到公网。

## 安全边界

文件管理首版仅开放目录浏览。写入、上传、删除、权限修改与在线编辑会在 root agent 权限隔离完成后开放，避免把 Web 进程直接做成 root 文件管理器。

## 目录

```text
cmd/lukepanel          程序入口
internal/auth          密码、会话与登录限速
internal/config        配置创建与加载
internal/system        /proc 系统指标采集
internal/files         安全目录浏览
internal/server        HTTP API、审计与前端嵌入
web                    原生 ES 模块前端
packaging/systemd      systemd 单元草案
```
