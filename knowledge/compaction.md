---
id: compaction
title: Compaction
aliases: [上下文压缩, compact, 总结压缩]
category: ai
level: 2
summary: 把长对话历史总结成一段摘要，腾出上下文空间，代价是丢失细节。
related: [context-window, token]
appearsIn: [timeline.compaction]
quiz:
  - q: compaction 之后哪类信息最容易丢？
    options: [系统提示, 最近一条消息, 早期讨论过的细枝末节, 模型名称]
    answer: 2
sources:
  - { title: "OpenCode docs", url: https://opencode.ai/docs }
---
## 为什么重要
如果 agent 在长会话后突然「忘了」某个约定，先看是不是刚发生过 compaction。

## 在 PixelWeb 里出现在哪
时间线中的 `compaction` 分隔条，标注 `auto`（自动触发）或手动。

## 动手试试
在 compaction 之后再问一个依赖早期细节的问题，观察 agent 是否需要重新读文件。
