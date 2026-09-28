---
id: harness
title: Harness
aliases: [harness 工程, Harness Engineering]
keywords: [约束, 验证, 纠正, 模型之外]
category: ai
level: 2
summary: 模型以外的那一整套程序：拼上下文、提供工具、管权限、检查结果、出错重试。Agent = 模型 + Harness。
related: [agent, coding-agent, permission, compaction, react-loop]
appearsIn: [timeline.session]
quiz:
  - q: 同一个模型接在两个不同的 coding agent 上，成绩差了一大截，最可能的原因是？
    options: [模型参数被偷偷换了, 两边的 harness 不一样, 两边的网速不一样, 提示词语言不一样]
    answer: 1
    why: 模型相同，差别只能出在模型外面：带了什么上下文、给了什么工具、出错后怎么处理。
sources:
  - { title: "李博杰《深入理解 AI Agent》第 1 章", url: https://github.com/bojieli/ai-agent-book }
  - { title: "Anthropic: Building effective agents", url: https://www.anthropic.com/research/building-effective-agents }
---
## 为什么重要
OpenCode 就是一个 harness。每次请求带哪些文件、开哪些工具、什么时候压缩历史、哪条命令要先问你，都由它决定。书里的例子：LangChain 的 coding agent 在 Terminal Bench 2.0 上从 52.8% 提到 66.5%，模型没换，改的全是这一层。

## 在 PixelWeb 里出现在哪
时间线上除了模型写的字，几乎都是 harness 在做事：执行工具、截断长输出、发权限请求、compaction、失败重试。

## 动手试试
挑一次任务，分两栏记：哪些是模型决定的（调哪个工具、传什么参数），哪些是 OpenCode 替它做的。
