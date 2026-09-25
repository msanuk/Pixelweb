---
id: prompt
title: Prompt
aliases: [提示词, 提示, prompting]
category: ai
level: 1
summary: 你发给模型的输入文本；写得越具体、越有上下文，输出越可控。
related: [system-prompt, context-window]
appearsIn: [timeline.message.user]
quiz:
  - q: 让 agent 少走弯路最有效的做法是？
    options: [多说「请」, 在 prompt 里给出目标、约束和验收标准, 用英文, 缩短句子]
    answer: 1
sources:
  - { title: "Anthropic Prompt Engineering", url: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview }
---
## 为什么重要
prompt 是你和 agent 的接口。PixelWeb 让你看见「一句 prompt 引发了多少工具调用」。

## 在 PixelWeb 里出现在哪
时间线里的 user 消息。

## 动手试试
对比两条 prompt 引发的步数：哪条更省？为什么？
