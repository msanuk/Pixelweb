---
id: head
title: HEAD
aliases: [git HEAD, 当前提交]
category: git
level: 1
summary: 指向「你当前所在」的指针，通常指向一个分支，分支再指向 commit。
related: [branch, detached-head, commit]
appearsIn: [git.head]
quiz:
  - q: 正常情况下 HEAD 指向什么？
    options: [一个文件, 一个分支名, 远程仓库, 暂存区]
    answer: 1
sources:
  - { title: "Pro Git: Reset Demystified", url: https://git-scm.com/book/en/v2/Git-Tools-Reset-Demystified }
---
## 为什么重要
所有「切换」「回退」命令本质上都是在移动 HEAD 或它指向的分支。

## 在 PixelWeb 里出现在哪
Git 面板中带 `HEAD` 标记的节点，顶栏显示当前分支名。

## 动手试试
在 OpenCode 里 `git checkout <hash>`，观察 PixelWeb 提示「detached」。
