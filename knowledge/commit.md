---
id: commit
title: Commit
aliases: [提交, git commit]
category: git
level: 1
summary: 仓库某一刻的完整快照 + 作者 + 说明 + 指向父提交的指针；哈希由这些内容算出。
related: [branch, head, diff, staging-area]
appearsIn: [git.commit]
quiz:
  - q: 一个 merge commit 有几个父提交？
    options: [0 个, 1 个, 2 个或更多, 不确定]
    answer: 2
sources:
  - { title: "Pro Git: Git Basics", url: https://git-scm.com/book/en/v2/Getting-Started-What-is-Git%3F }
---
## 为什么重要
Git 图里的每个圆点都是 commit，边就是父指针。理解「commit 是快照不是差异」，rebase、cherry-pick 就都好懂了。

## 在 PixelWeb 里出现在哪
Git 面板的节点；点击可见哈希、作者、时间。

## 动手试试
找一个有两个父节点的圆点，那就是一次 merge。
