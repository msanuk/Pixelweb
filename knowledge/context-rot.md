---
id: context-rot
title: 上下文腐化
aliases: [context rot, lost in the middle, 迷失在中间]
keywords: [长上下文, 注意力分散, 大海捞针]
category: ai
level: 2
summary: 上下文还没满，但内容一多，模型就越来越难找到关键信息，决策悄悄变差。
related: [context-window, compaction, tool-task, context-engineering]
appearsIn: [timeline.compaction]
quiz:
  - q: 上下文腐化和上下文溢出有什么区别？
    options: [没有区别, 溢出是装不下了，腐化是装得下但找不到, 腐化只发生在小模型上, 溢出不会影响回答质量]
    answer: 1
  - q: 同一条关键约定，放在长上下文的哪里最容易被忽略？
    options: [最开头, 最末尾, 中间, 位置没有影响]
    answer: 2
    why: 模型对开头和结尾关注得多，中间的内容最容易被略过。
sources:
  - { title: "Chroma: Context Rot", url: https://research.trychroma.com/context-rot }
  - { title: "Liu et al. Lost in the Middle (2023)", url: https://arxiv.org/abs/2307.03172 }
  - { title: "李博杰《深入理解 AI Agent》第 2 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
agent 突然忘了早先说好的事，或者反复纠结一个已经解决的问题，不一定是窗口满了。几十个文件的原文堆在那里，真正要用的那几行被淹没了。

## 在 PixelWeb 里出现在哪
上下文仪表还远没到压缩线、agent 却开始犯糊涂，多半就是这个。大量读文件的探索交给子任务，只带结论回来，能避开它。

## 动手试试
长会话里 agent 忘了约定时，与其继续追问，不如开一个新会话，只带上结论和约定。
