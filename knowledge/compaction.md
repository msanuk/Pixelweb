---
id: compaction
title: Compaction
aliases: [上下文压缩, compact, 总结压缩]
category: ai
level: 2
summary: 把长对话历史总结成一段摘要，腾出上下文空间，代价是丢失细节。
related: [context-window, token, prompt-cache, context-rot, agents-md, tool-task]
appearsIn: [timeline.compaction]
quiz:
  - q: compaction 之后哪类信息最容易丢？
    options: [系统提示, 最近一条消息, 早期讨论过的细枝末节, 模型名称]
    answer: 2
sources:
  - { title: "OpenCode docs", url: https://opencode.ai/docs }
  - { title: "李博杰《深入理解 AI Agent》第 2 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
如果 agent 在长会话后突然「忘了」某个约定，先看是不是刚发生过 compaction。摘要最容易丢的是早先的决定和背后的理由，文件名、commit hash 这类标识符也可能被改错；要长期遵守的约定写进 AGENTS.md，它不参与压缩。

压缩改写了历史，之后第一次请求的缓存基本要重建，所以压缩宜少不宜勤。

## 在 PixelWeb 里出现在哪
时间线中的 `compaction` 分隔条，标注 `auto`（自动触发）或手动。

## 动手试试
在 compaction 之后再问一个依赖早期细节的问题，观察 agent 是否需要重新读文件。
