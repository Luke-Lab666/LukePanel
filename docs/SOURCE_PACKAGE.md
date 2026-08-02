# 完整源码包说明

本目录是可直接作为 GitHub 仓库根目录上传的 LukePanel v2.0.3 完整源码。

它不是补丁包，不包含 `overlay/`、`apply-react-rebuild.sh` 或删除清单。根目录已经同时包含：

- Go Web 服务与 root Agent 全部源码；
- React 18.2 + TypeScript 前端源码；
- 已构建并与 Go `embed` 同步的正式前端资源；
- 安装器、卸载器、systemd 单元、GitHub Actions、测试与文档。

上传仓库后，GitHub Actions 会重新构建前端、执行 Go 测试与静态检查，再生成 AMD64/ARM64 二进制。
