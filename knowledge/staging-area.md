---
id: staging-area
title: 暂存区（Staging Area）
aliases: [暂存区, git add, staged]
keywords: [index]
category: git
level: 1
summary: 工作区与仓库之间的缓冲：`git add` 把改动放进来，`git commit` 只提交这里的内容。
related: [commit, diff]
appearsIn: [git.status]
quiz:
  - q: 状态码 " M" 与 "M " 的区别？
    options: [没有区别, 前者已暂存、后者未暂存, 前者未暂存、后者已暂存, 前者是新文件]
    answer: 2
sources:
  - { title: "git status --porcelain", url: https://git-scm.com/docs/git-status#_short_format }
---
## 为什么重要
agent 改了文件≠提交了。看 status 才知道改动在哪一层。

## 在 PixelWeb 里出现在哪
Git 面板的「工作区状态」列表，两位状态码分别表示暂存区/工作区。

## 动手试试
对照 `??`（未跟踪）、`M`（修改）、`A`（新增）。
