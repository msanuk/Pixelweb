---
id: diff
title: Diff / Patch
aliases: [diff, patch, 差异, 补丁]
category: git
level: 1
summary: 两个版本之间的逐行差异；`+` 新增 `-` 删除。patch 是可应用的 diff 文件。
related: [commit, tool-read-edit]
appearsIn: [timeline.part.patch, git.status]
quiz:
  - q: OpenCode 的 session.summary 里 additions/deletions 统计的是？
    options: [消息数, 该会话改动的新增/删除行数, token 数, 文件数]
    answer: 1
sources:
  - { title: "git diff", url: https://git-scm.com/docs/git-diff }
---
## 为什么重要
审查 agent 工作最可靠的方式就是看 diff，而不是看它的总结。

## 在 PixelWeb 里出现在哪
左侧 session 上的 `+N −M`，时间线里的 `patch` 节点。

## 动手试试
对比一个 session 的 +/− 与 `git diff --stat`。
