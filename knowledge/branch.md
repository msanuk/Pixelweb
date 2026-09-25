---
id: branch
title: Branch（分支）
aliases: [分支, git branch]
category: git
level: 1
summary: 一个会随新提交自动前移的、指向某个 commit 的可变指针，仅 41 字节。
related: [commit, head, merge, rebase, remote]
appearsIn: [git.branch]
quiz:
  - q: 创建一个新分支的成本大约是？
    options: [复制整个仓库, 复制所有文件, 写一个 40 字符的文件, 与仓库大小成正比]
    answer: 2
sources:
  - { title: "Pro Git: Branches in a Nutshell", url: https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell }
---
## 为什么重要
coding agent 常在独立分支上工作（如 `claude/xxx`）。分支便宜，所以「每个任务一个分支」是零成本的安全网。

## 在 PixelWeb 里出现在哪
Git 面板节点旁的标签；当前分支高亮；远程分支显示为 `origin/…`。

## 动手试试
找到当前分支与 `origin/` 同名分支的距离（ahead/behind）。
