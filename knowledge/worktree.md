---
id: worktree
title: Worktree
aliases: [工作树, git worktree]
category: git
level: 2
summary: 同一个仓库同时检出多个目录，各在不同分支上工作，互不干扰。
related: [branch, detached-head]
appearsIn: [git.root]
quiz:
  - q: worktree 相比 clone 两份的优势？
    options: [更安全, 共享同一个对象库、省空间且分支互通, 更快下载, 没有优势]
    answer: 1
sources:
  - { title: "git worktree", url: https://git-scm.com/docs/git-worktree }
---
## 为什么重要
并行跑多个 agent 时，worktree 让它们各改各的目录而共用历史。

## 在 PixelWeb 里出现在哪
顶栏项目路径；OpenCode 的 `project.worktree` 字段。

## 动手试试
`git worktree list`。
