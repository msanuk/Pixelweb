---
id: session
title: Session（会话）
aliases: [会话, opencode session]
category: ai
level: 1
summary: 一段连续对话的容器：消息、工具调用、token 统计都挂在它下面；子任务会成为子 session。
related: [context-window, tool-task, compaction]
appearsIn: [timeline.session]
quiz:
  - q: 开一个新 session 而不是继续旧 session 的主要理由？
    options: [省钱, 让上下文干净、不被旧任务干扰, 更快, 必须如此]
    answer: 1
sources:
  - { title: "OpenCode Server docs", url: https://opencode.ai/docs/server }
---
## 为什么重要
session 边界就是上下文边界。PixelWeb 的「深入解释」每次都开新 session，正是为了不污染你正在做的任务。

## 在 PixelWeb 里出现在哪
左侧列表；标题带 📖 的是教学会话。

## 动手试试
对比一个教学会话和一个干活会话的 token 用量。
