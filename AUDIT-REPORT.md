# React 重构审计结论

## 不保留的旧架构

- 删除 `web/app.js` 单文件原生 JavaScript 应用；
- 删除旧 `web/index.html` 与 `web/styles.css`；
- 删除仓库内历史 `internal/server/webdist` 生成副本并由构建重新生成；
- 删除已提交的历史二进制、测试日志、截图和旧浏览器审计脚本。

## 真实功能约束

- 每个可见业务入口都对应现有 `/api/v1/*` 后端路由；
- API 层统一处理 Cookie 会话、CSRF、401 退出、403 密码二次验证、JSON 与 Blob；
- 容器诊断仅展示后端固定白名单命令，不提供伪终端；
- Compose 编辑按后端要求提交项目的全部配置文件并支持校验/部署；
- SSH 端口切换保留旧端口，只有确认新端口后才关闭旧端口；
- UFW 使用后端真实 `enabled` 与 `recovery_pending` 状态；
- 敏感文件预览通过授权请求获取 Blob，不使用绕过二次验证的裸 iframe；
- 不显示后端未实现的任意 Shell、任意 Docker exec、Kubernetes 或多节点能力。

## 完整模块

- 仪表盘与实时概览；
- 系统服务、进程、网络、存储、systemd 定时器、安全计划任务；
- APT 预检、下载、升级、软件包和软件源；
- 主机名、时区、DNS、NTP、Swap、内核预设和配置快照；
- Docker 容器、镜像、构建、Compose、网络、卷、归档和清理；
- 文件浏览、搜索、上传、编辑、预览、压缩、回收站、收藏、版本差异和恢复；
- SSH 用户、sudo、公钥、密钥生成、登录策略和防失联端口切换；
- Passkey、TOTP、恢复码、会话、可信设备、IP 允许列表、UFW、Fail2ban；
- 审计日志、Journal、面板备份、定时备份、工具和 GitHub 助手。

## 验证边界

当前执行环境不能访问 npm registry，因此没有伪造 Vite 构建成功。已完成离线 TypeScript 静态检查、源码契约核对、Go 测试文件格式化、脚本语法和包结构检查。最终应用脚本与 CI 会强制执行真实 npm 安装、TypeScript 检查、Vite 构建、Go 全量测试和二进制构建；任何一步失败都会终止并回滚。
