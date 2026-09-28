---
id: context-window
title: Context Window
aliases: [上下文窗口]
keywords: [上下文, context]
category: ai
level: 1
summary: 模型一次能「看见」的 token 上限；超出的历史要么被压缩，要么被丢掉。
related: [token, compaction, system-prompt, context-rot, context-engineering]
appearsIn: [timeline.compaction, timeline.part.step-finish]
quiz:
  - q: 上下文快满时 OpenCode 通常会做什么？
    options: [直接报错退出, 触发 compaction 压缩历史, 换一个更大的模型, 清空所有消息]
    answer: 1
sources:
  - { title: "Anthropic: Context windows", url: https://docs.anthropic.com/en/docs/build-with-claude/context-windows }
  - { title: "李博杰《深入理解 AI Agent》第 2 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
agent 不是「记得」项目，而是每一步都把相关内容重新塞进窗口。窗口越满，越贵、越慢、越容易忘掉早先的约定；还没满也可能「找不到」，见上下文腐化。

## 在 PixelWeb 里出现在哪
时间线里出现 `compaction` 节点，就说明窗口逼近上限，OpenCode 把前文总结成了一段摘要。

## 动手试试
找到一次 compaction，看看它之后的第一条 assistant 消息 input token 掉了多少。
