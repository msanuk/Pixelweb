---
id: detached-head
title: Detached HEAD
aliases: [分离头指针, detached]
category: git
level: 2
summary: HEAD 直接指向一个 commit 而不是分支；此时新提交不属于任何分支，容易丢。
related: [head, branch]
appearsIn: [git.detached]
quiz:
  - q: 在 detached HEAD 下提交后想保住成果应该？
    options: [直接 checkout main, 先建一个分支指向当前 commit, 删除 .git, 什么也不用做]
    answer: 1
sources:
  - { title: "git checkout --detach", url: https://git-scm.com/docs/git-checkout#_detached_head }
---
## 为什么重要
CI 和 agent 有时会处于这种状态；不理解它就可能丢提交。

## 在 PixelWeb 里出现在哪
顶栏会显示「detached @ 哈希」的警告色。

## 动手试试
`git switch -c rescue` 即可把当前 commit 挂回分支。
