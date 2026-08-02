# LukePanel v2.0.0 完整升级包

该包面向 `Luke-Lab666/LukePanel` 的 v1.0.0 基线（提交 `38ca96f1971e5a53359076022b7154329481e4ad`），完成 UI 体系重构与防火墙链路修复，同时保留原项目已有的真实业务能力：登录与二次验证、Passkey/TOTP、Docker、文件管理、SSH、软件源、快照与备份、GitHub 助手、审计等。

这不是把新样式追加在旧 CSS 后面的覆盖补丁。迁移器会完整替换 `web/styles.css`，使用 Cascade Layers、统一设计令牌、组件级布局规则和明确响应式断点；现有业务 JavaScript 与 Go/Agent 安全架构继续保留，避免为了换框架而把真实功能退化成占位页面。

## 已完成

- 修复 Web 与 Agent 防火墙协议：统一为 `{ operation, number, rule }`。
- 修复 UFW 参数顺序：由错误的 `ufw in allow ...` 改为 `ufw allow in ...`。
- UFW 命令拼装抽成 `buildUFWRuleArgs`，并加入可编译的 Go 表驱动测试。
- 新增端口范围顺序校验，限制 `limit` 仅用于 TCP。
- 添加和删除规则后立即重新读取安全中心状态。
- 错误弹窗保留完整命令与真实 UFW 标准输出/错误输出，多行显示不被压平。
- 防火墙表单改为独立响应式卡片，支持动作、方向、协议、端口、来源和备注。
- 防火墙规则列表改为卡片式，手机和桌面均保持完整信息，不截断端口。
- 全站样式系统重构，覆盖登录、概览、系统、Docker、文件、SSH、安全、设置和弹窗。
- 兼容浅色/深色、iOS 安全区、软键盘、横屏、小屏和桌面宽屏。
- 自动备份、失败自动回滚、源码契约测试、Go 全量测试和静态检查。

## 使用方式

### 1. 先验证升级包

```bash
cd LukePanel-v2.0.0-complete-upgrade
./verify.sh
```

### 2. 应用到完整 LukePanel 源码

```bash
./apply.sh /path/to/LukePanel
```

迁移器只接受符合目标 v1.0.0 基线特征的源码。任何关键锚点不匹配都会停止，不会盲目替换。

`apply.sh` 会依次执行：

1. 校验基线并备份原文件；
2. 迁移前端与防火墙代码；
3. `gofmt`；
4. `node --check web/app.js`；
5. `go test ./...`；
6. `go vet ./...`；
7. 校验 `web/` 与内嵌前端资源一致。

任意一步失败都会自动恢复备份。

### 3. 手动回滚

升级完成后终端会显示备份目录，例如：

```text
/path/to/LukePanel/.lukepanel-v2-backup-20260802-103700
```

回滚：

```bash
./rollback.sh /path/to/LukePanel \
  /path/to/LukePanel/.lukepanel-v2-backup-20260802-103700
```

## 从固定基线生成完整 v2 源码包

有 GitHub 网络访问的 Linux/macOS 环境可直接执行：

```bash
./build-complete-source.sh
```

脚本会下载固定提交、应用迁移、执行完整测试，并在当前目录生成：

```text
LukePanel-v2.0.0-source.tar.gz
LukePanel-v2.0.0-source.zip
```

## 目录说明

```text
assets/styles.css                     全新完整 UI 样式系统
tools/migrate.py                      严格基线迁移器
generated-tests/                      注入原仓库的 Go 契约测试
tests/test_migration.py               迁移、回滚、JS、Go 编译测试
tests/browser/                        Chromium 多设备回归工具
reports/browser-report.json           88 次渲染的机器报告
reports/screenshots/                  每个设备与场景的实际截图
reports/TEST-REPORT.md                 测试范围、结果与边界
reports/visual-contact-sheet.png       关键手机/桌面截图总览
apply.sh / verify.sh / rollback.sh    应用、验证与恢复入口
```

## 环境要求

应用升级需要：

- Python 3
- Node.js（仅用于 JavaScript 语法检查）
- Go 1.23+
- `gofmt`

运行浏览器回归还需要 Chromium 或 Google Chrome。

## 重要边界

- 测试环境不会实际修改宿主机 UFW，因此没有在当前沙箱执行真实的放行/拒绝命令；UFW 参数生成、接口契约、错误传递和 Go 编译测试已经覆盖。
- GitHub App 对该仓库的内容写入返回 403，因此本次结果未直接提交到仓库。升级包、验证脚本和回滚能力均已完整交付。
- `build-complete-source.sh` 需要运行环境能够访问 GitHub；离线环境请把该升级包与现有完整源码放在同一设备上，再执行 `apply.sh`。
