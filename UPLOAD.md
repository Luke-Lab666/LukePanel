# 直接上传到 GitHub

这个 ZIP 是完整仓库，不是补丁。

在 Working Copy 中操作时：

1. 先备份当前仓库。
2. 删除当前工作树中的残缺文件，但保留 `.git` 仓库信息。
3. 将本包全部内容解压到仓库根目录。
4. 确认根目录直接出现 `cmd/`、`internal/`、`frontend/`、`.github/`、`go.mod`、`Makefile` 和 `install.sh`。
5. 不应出现额外一层同名目录，也不应出现 `overlay/`。
6. 提交全部变化并推送。

建议提交信息：

```text
v2.0.7 security hardening
```

推送后等待 GitHub Actions 的 Build 工作流通过，再创建 `v2.0.7` 标签或 Release。


## GitHub 助手上传说明

- 浏览器到 LukePanel 的文件传输会显示真实字节进度、速度与预计剩余时间。
- 浏览器上传完成后，GitHub ZIP 导入或 Release 附件仍可能进入“服务器处理中”；此阶段是服务端校验、生成 Git Blob/Tree/Commit 或转发到 GitHub，不会伪造百分比。
- 上传阶段可以取消；一旦进入 GitHub 提交处理阶段，为避免产生不确定的远端状态，只显示处理状态而不提供假取消。
- ZIP 差异导入限制为 64 MiB；更大的仓库应使用本地 Git 或 Working Copy 正常推送。
