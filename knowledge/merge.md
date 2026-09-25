---
id: merge
title: Merge
aliases: [合并, git merge, merge commit]
category: git
level: 1
summary: 把两条历史汇合，生成一个有两个父提交的新 commit；历史保留原样。
related: [rebase, branch, commit, conflict]
appearsIn: [git.commit.merge]
quiz:
  - q: merge 与 rebase 对历史的最大区别？
    options: [merge 更快, merge 保留分叉、rebase 把历史改成一条线, 没有区别, rebase 更安全]
    answer: 1
sources:
  - { title: "Pro Git: Basic Merging", url: https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging }
---
## 为什么重要
Git 图里的「汇合点」就是 merge。它是团队协作中最常见、也最安全的整合方式。

## 在 PixelWeb 里出现在哪
两条线汇入同一个节点。

## 动手试试
找到最近一次 merge，看它合并了哪两条分支。
