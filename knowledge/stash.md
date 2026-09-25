---
id: stash
title: Stash
aliases: [储藏, git stash]
category: git
level: 2
summary: 把当前未提交的改动临时收起来，让工作区变干净，之后再取回。
related: [staging-area, branch]
appearsIn: [git.stash]
quiz:
  - q: stash 的典型使用场景？
    options: [删除改动, 临时切分支处理紧急事务, 推送到远程, 合并分支]
    answer: 1
sources:
  - { title: "Pro Git: Stashing", url: https://git-scm.com/book/en/v2/Git-Tools-Stashing-and-Cleaning }
---
## 为什么重要
agent 有时会 stash 你的改动再操作；不知道这个机制会以为改动丢了。

## 在 PixelWeb 里出现在哪
Git 面板顶部的 stash 计数。

## 动手试试
`git stash list` 看看有没有被遗忘的储藏。
