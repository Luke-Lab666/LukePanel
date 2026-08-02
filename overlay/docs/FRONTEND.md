# LukePanel React 前端

## 技术栈

- React 19
- TypeScript
- Vite
- 原生 CSS 设计系统

不引入重量级组件库、运行时 CSS 框架或浏览器端全局状态框架。页面状态优先局部化，API、路由、对话框和通知由小型公共模块统一处理。

## 目录

```text
frontend/
├── src/App.tsx
├── src/components/
├── src/lib/
├── src/pages/
├── src/styles.css
├── index.html
├── package.json
└── vite.config.ts
```

## 真实功能原则

每个可见操作必须满足：

1. 对应已注册的 Go API。
2. 请求方法和 JSON 字段与后端结构一致。
3. 有加载、错误、空状态和成功反馈。
4. 高风险操作使用 `secureApi`，由后端决定是否要求二次验证。
5. 未实现或后端不支持的动作不显示。
6. 不在浏览器中执行任意 Shell，不通过 UI 绕过 Agent 白名单。

## 路由与返回逻辑

LukePanel 使用 History API 的轻量路由器：

- 一级入口不显示返回按钮。
- 二级系统页面返回 `/system`。
- GitHub 助手返回 `/tools`。
- 刷新保留当前合法路由。
- 未知路径由 Go SPA fallback 返回 React 首页，再回退到概览。

## 移动端规则

- 输入框、选择器和文本域在手机端至少 16px，避免 iOS 自动缩放。
- 使用 `100dvh`、安全区 inset 和固定底部导航。
- 禁止页面级横向溢出。
- 对话框在窄屏转为底部面板，并限制可视区域高度。
- 表格型数据在手机端使用资源卡片，不强行压缩桌面表格。

## 构建

```bash
make frontend-install
make frontend-check
make frontend
```

`make frontend` 会清空并重新生成 `internal/server/webdist/`。旧的 `web/app.js`、`web/styles.css` 与手写 DOM 前端不再参与构建。
