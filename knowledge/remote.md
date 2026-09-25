---
id: remote
title: Remote（远程仓库）
aliases: [远程仓库, origin, git remote, push, pull, fetch]
category: git
level: 1
summary: 托管在别处的同一仓库副本；`origin/main` 是你本地缓存的「上次看到的远程状态」。
related: [branch, webhook]
appearsIn: [git.remote]
quiz:
  - q: fetch 与 pull 的区别？
    options: [没有区别, fetch 只更新远程跟踪分支，pull 还会合并到当前分支, pull 更安全, fetch 会推送]
    answer: 1
sources:
  - { title: "Pro Git: Working with Remotes", url: https://git-scm.com/book/en/v2/Git-Basics-Working-with-Remotes }
---
## 为什么重要
`origin/main` 落后于真正的远程是常态；PixelWeb 显示的远程分支只是本地缓存。

## 在 PixelWeb 里出现在哪
带 `origin/` 前缀的分支标签；ahead/behind 数字。

## 动手试试
`git fetch` 后观察 `origin/main` 标签是否移动。
