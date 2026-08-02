# v2.0.3 最终验证结果

验证日期：2026-08-02

本结果来自当前完整源码包重新构建与执行，不沿用旧前端或迁移补丁的结论。

## 构建与后端

- React 18.2 + TypeScript 离线构建：通过
- `web/` 与 `internal/server/webdist/` 嵌入资源逐文件一致：通过
- `go test ./...`：通过
- `go vet ./...`：通过
- `go test -race ./internal/auth ./internal/config`：通过
- 本次认证关键链路由 `internal/server/auth_flow_test.go` 在全仓库 Go 测试中通过；未把超时的全量 server Race 伪报为通过
- Linux AMD64 静态二进制构建：通过
- Linux ARM64 静态二进制构建：通过
- AMD64 二进制 `-version`：`v2.0.3`

## 本次定向回归

- 页头刷新按钮默认边框：通过（未点击状态为 1px solid）
- 真实 Go Collector Swap 字段 `memory.SwapTotal` / `memory.SwapUsed`：通过
- 未配置 Swap 不绘制进度条：通过
- 登录页重复 Passkey 提示文案：已清除
- Passkey 指纹图标、内存芯片图标、磁盘图标与刷新图标：已同步到正式构建资源

## 浏览器与交互

- 11 种视口 × 18 条正式路由：198 / 198 通过
- 包含 320、360、375、390、430 px 手机宽度
- 包含手机横屏、平板、1280、1440、1920 px 桌面
- 真实交互/API 契约：51 / 51 通过
- 可见控件真实性审计：151 / 151 通过
- 两种代表性视口 × 18 路由无障碍检查：0 个问题

## 结构检查

- 完整 Go Web 服务与 root Agent 均在仓库根目录正式路径中
- React 源码位于 `frontend/`
- 正式静态资源位于 `web/` 并同步嵌入 `internal/server/webdist/`
- 不包含 `overlay/`、迁移脚本、删除清单或补丁包结构
- 不包含历史测试截图、日志、旧二进制和 Node.js 依赖目录
