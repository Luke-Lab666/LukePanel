# v2.0.6 最终验证结果

验证日期：2026-08-02

本结果来自 v2.0.6 最终源码重新构建与执行，不沿用旧版本的浏览器缓存、静态资源或测试报告。

## 安全实现边界

- 官方 GitHub Actions 构建固定使用 Go 1.26.5；Release 运行时支持 `X25519MLKEM768`、`SecP256r1MLKEM768` 与 `SecP384r1MLKEM1024` 出站 TLS 混合密钥交换。
- 后量子能力按实际 Go 运行时和 `GODEBUG` 状态显示；旧 Go 自行构建或显式关闭 ML-KEM 时，安全中心会显示警告，不会伪报已启用。
- LukePanel 通常位于 Nginx Proxy Manager、Caddy 或其他反向代理之后，因此浏览器到面板的入站 HTTPS 算法由反向代理与浏览器协商，不由 LukePanel Go 进程单方面决定。
- “抗 AI 加密”不是密码学标准名称。本版实际增强的是密码离线破解成本、自动化登录攻击防护、第二因素、会话完整性、恢复码保护以及后量子混合 TLS。

## 认证与密码学

- 新密码哈希：PBKDF2-HMAC-SHA-512，750,000 次迭代、24 字节随机盐、64 字节摘要。
- 旧 PBKDF2-HMAC-SHA-256 哈希：完成密码和第二因素验证后自动迁移；验证失败不会修改配置。
- 会话签名：HMAC-SHA-512。
- 新恢复码：HMAC-SHA-512；旧 HMAC-SHA-256 恢复码仍可一次性消费。
- 密码登录：启用 TOTP 后始终要求 TOTP 或恢复码。
- Passkey：独立登录，要求 WebAuthn 本地用户验证，不追加 TOTP。

## GitHub 与上传

- GitHub 助手可读取当前账号有权访问的最近仓库，并标注私有仓库和只读权限。
- iOS 设备登录在请求开始前同步打开授权窗口，避免异步弹窗被 Safari 拦截。
- 文件管理、GitHub ZIP 差异导入和 Release 附件上传均使用真实 XHR 字节事件显示百分比、已传容量、速度、预计剩余时间与取消操作。
- 浏览器上传完成后切换为“服务端处理中”。GitHub API 未向当前链路提供服务端到 GitHub 的逐字节回调，因此该阶段不伪造百分比。
- Web、Agent 上传读写超时为 35 分钟；GitHub API 客户端总超时为 10 分钟，响应头超时为 30 秒。

## UI 修正与专项回归

- Passkey 登录、添加与凭据列表均显示新的环形密钥图标，旧指纹 SVG 已隐藏。
- Docker、文件管理等页面的 `ghost` 操作按钮在默认状态即显示边框、底色与轻阴影。
- 手机端 Passkey/SSH 凭据操作按钮独占整行，桌面端保持图标、内容、操作三列稳定布局。
- `python3 tests/browser/ui_regression.py`：5 / 5，通过登录页、设置页、Docker 与文件管理的专项可见性检查。
- 最终 CSS 已直接合入 `app.css`；浏览器矩阵加载的就是正式发布样式，不存在独立样式文件漏测。

## 构建与后端

- React 18.2 + TypeScript 离线构建：通过。
- `web/` 与 `internal/server/webdist/`：逐文件一致。
- `python3 tests/static/validate.py`：通过，18 条正式路由。
- `go test ./...`：通过。
- `go vet ./...`：通过。
- `bash -n install.sh uninstall.sh`：通过。
- Release 契约测试：Go 1.26.5、`VERSION=v2.0.6` 和 ML-KEM systemd 环境变量均通过。

## Race 检查

- `go test -race ./internal/auth`：通过。
- `go test -race ./internal/githubhelper`：通过。
- Config 默认值、校验与深拷贝定向 Race：通过。
- Server 加密运行时、SPA 与 Release 契约定向 Race：通过。
- 未将高成本密码派生覆盖下的整个 Config 包 Race 超时误报为通过。

## 浏览器与交互

- 11 种视口 × 18 条正式路由：198 / 198。
- 字段级交互与 API 契约：51 / 51。
- 可见控件真实性审计：149 / 149。
- 两种代表性视口 × 18 路由无障碍检查：0 个问题。
- 上传进度定向测试：真实字节进度、速度、处理阶段与完成状态通过。
- 320、360、375、390、430 px 手机宽度均通过。
- 手机横屏、平板、1280、1440、1920 px 桌面均通过。

## 本地构建说明

最终验收环境自带 Go 1.23.2，可用于源码兼容性、测试和普通编译验证，但不具备 Go 1.26 的完整 ML-KEM TLS 默认组。因此本源码包不附带该环境构建的二进制，以免把它误当作后量子 Release。请由仓库内 GitHub Actions 使用固定的 Go 1.26.5 生成正式 AMD64/ARM64 Release。

## 完整包结构

- React 源码：`frontend/`
- 正式静态资源：`web/`
- Go 嵌入资源：`internal/server/webdist/`
- GitHub Actions：`.github/workflows/`
- systemd 模板：`packaging/systemd/`
- 验证脚本：`tests/`
- 完整包不包含 `.git`、`node_modules`、Python 缓存、临时前端目录、旧报告或本地旧 Go 二进制。
