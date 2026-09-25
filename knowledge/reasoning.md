---
id: reasoning
title: Reasoning（思考过程）
aliases: [reasoning, thinking, 思维链, chain of thought]
category: ai
level: 2
summary: 模型在给出答案前生成的中间推理文本，通常不算最终回复，但占 token。
related: [llm, token]
appearsIn: [timeline.part.reasoning]
quiz:
  - q: reasoning 部分对用户的主要价值？
    options: [可以直接复制执行, 帮助理解模型为何这么做, 节省费用, 提高网速]
    answer: 1
sources:
  - { title: "Anthropic: Extended thinking", url: https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking }
---
## 为什么重要
看 reasoning 能提前发现模型理解偏了，在它动手前打断。

## 在 PixelWeb 里出现在哪
时间线里灰色斜体的可折叠块。

## 动手试试
找一段 reasoning 与随后动作不一致的地方。
