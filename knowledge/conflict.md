---
id: conflict
title: 合并冲突（Merge Conflict）
aliases: [merge conflict, 解决冲突]
keywords: [冲突, conflict]
category: git
level: 2
summary: 两条历史改了同一处代码，Git 无法自动决定保留谁，把两个版本都留在文件里等你裁决。
related: [merge, rebase, diff]
appearsIn: [git.status]
quiz:
  - q: 冲突标记 <<<<<<< HEAD 与 >>>>>>> 之间夹着的是？
    options: [只有你的版本, 只有对方的版本, 两个版本，中间用 ======= 分开, 编译错误]
    answer: 2
sources:
  - { title: "Pro Git: Basic Merge Conflicts", url: https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging#_basic_merge_conflicts }
---
## 为什么重要
agent 解决冲突时最容易「两边都留」或「随手删一边」。看懂冲突标记，你才能审查它的选择。

## 在 PixelWeb 里出现在哪
工作区状态里出现 `UU` 状态码即为冲突文件；Git 图里两条线即将汇合却没有 merge 节点。

## 动手试试
`git diff --name-only --diff-filter=U` 列出所有冲突文件。
