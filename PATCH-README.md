# LukePanel v2.0.0 React 完整迁移包

## 适用基线

- 仓库：`Luke-Lab666/LukePanel`
- 基线提交：`e992a3194dd6c24178bd6a0dac20b0ae20e01ba8`
- 目标版本：`v2.0.0`

这不是几个零散页面，而是当前仓库的前端、构建链路、CI 和前端契约测试整体替换。后端 Go/Agent 安全模型保留。

## 应用

```bash
unzip LukePanel-v2.0.0-react-rebuild.zip
cd LukePanel-v2.0.0-react-rebuild-package
bash verify-package.sh
bash apply-react-rebuild.sh /path/to/LukePanel
```

默认要求仓库位于精确基线提交且工作区干净。脚本会：

1. 备份所有将被覆盖或删除的路径；
2. 删除旧原生 JavaScript 前端、旧嵌入资源、历史二进制和旧 UI 报告；
3. 写入 React + TypeScript + Vite 源码；
4. 安装锁定版本依赖并运行 TypeScript 检查；
5. 构建 React，重新生成 Go 嵌入资源；
6. 运行 `go test ./...`；
7. 构建当前 Linux 架构的 LukePanel 二进制；
8. 任一步失败，自动恢复应用前文件。

## 主要实现

- React 19、TypeScript、Vite，运行时仍是 Go 单二进制；
- 一级页面不显示返回按钮，二级页面按父级路由返回；
- 登录、CSRF、密码二次验证、Passkey、TOTP 与恢复码；
- 系统、APT、Docker、文件、SSH、安全、审计、备份和 GitHub 助手；
- 所有可见操作调用仓库现有后端 API；未得到后端支持的任意 Shell、任意容器命令等能力不展示；
- 手机安全区、16px 表单字号、软键盘、横向溢出和桌面布局统一处理；
- GitHub Actions 在 Go 构建前真实执行 npm 安装、TypeScript 检查和 Vite 构建。

## 删除内容

详见 `delete-paths.txt`。品牌图标和 `web/manifest.webmanifest` 仍作为静态源文件保留；`web/app.js`、`web/index.html`、`web/styles.css` 不再存在。

## 已完成的离线验证

- TypeScript 源码静态检查通过；
- Go 测试文件已执行 `gofmt`；
- API 路径与关键请求字段完成静态契约核对；
- 迁移脚本通过 `bash -n`；
- 临时 `.tsbuildinfo`、离线类型 shim 和编译残留已清除。

完整 npm/Vite/Go 构建需要可访问 npm registry 的环境，应用脚本与 GitHub Actions 会把这些检查作为硬性步骤，失败即停止，不会产出伪成功包。
