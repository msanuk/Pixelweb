---
id: rebase
title: Rebase
aliases: [变基, git rebase]
category: git
level: 2
summary: 把一串提交「搬」到新的基底上重放，得到直线历史；会改写提交哈希。
related: [merge, commit, branch]
appearsIn: [git.branch]
quiz:
  - q: 为什么不应 rebase 已推送给他人的分支？
    options: [太慢, 会改写哈希导致别人的历史对不上, Git 不允许, 会删除文件]
    answer: 1
sources:
  - { title: "Pro Git: Rebasing", url: https://git-scm.com/book/en/v2/Git-Branching-Rebasing }
---
## 为什么重要
agent 做 rebase 后，你会看到 Git 图里旧节点消失、新节点出现在别处——这不是 bug。

## 在 PixelWeb 里出现在哪
分支指针突然跳到另一条线上。

## 动手试试
rebase 前后对比同一 commit 的 subject 与 hash。
