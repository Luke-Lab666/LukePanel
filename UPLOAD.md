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
v2.0.0 complete React rebuild
```

推送后等待 GitHub Actions 的 Build 工作流通过，再创建 `v2.0.0` 标签或 Release。
