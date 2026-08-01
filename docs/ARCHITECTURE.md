# 架构设计

## 当前阶段

LukePanel v0.1 使用单进程 Go 服务：

```text
Browser / PWA
      │ HTTPS（NPM）
      ▼
127.0.0.1:6767
      │
      ├── Auth / Session / CSRF
      ├── /proc 系统指标
      ├── 受限文件目录浏览
      ├── JSONL 审计日志
      └── 嵌入式 HTML / CSS / ES Module
```

没有 Node.js 运行时、外部数据库、Redis、Prometheus 或独立前端服务。

## 权限边界

当前 Web 服务以 `lukepanel` 普通系统用户运行。首版文件管理只读，是刻意限制，不是功能遗漏。

后续写入型操作使用独立 root agent：

```text
lukepanel-web（普通用户）
      │ /run/lukepanel/agent.sock
      ▼
lukepanel-agent（root）
      ├── 固定 Action 白名单
      ├── 参数验证
      ├── 二次验证授权
      └── 全量审计
```

Agent 不接受 Shell 字符串，不提供通用 `sh -c` 接口。

## 数据存储

- `/etc/lukepanel/config.json`：0600，原子替换写入。
- `/var/lib/lukepanel/audit.jsonl`：0600，追加写入。
- 会话当前保存在内存，服务重启后全部失效。

SQLite 会在审计查询、持久会话和配置版本功能接入时再引入，避免首版提前增加复杂度。

## 前端原则

- 移动端优先，桌面端增强。
- 手机常用操作不依赖 hover 或右键。
- 手机采用底部导航，桌面采用固定侧栏。
- 无第三方前端运行依赖，静态资源嵌入 Go 二进制。
- 页面不可见时停止周期刷新。
