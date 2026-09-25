---
id: llm
title: LLM
aliases: [大语言模型, Large Language Model, 大模型]
category: ai
level: 1
summary: 通过预测「下一个 token」学会语言规律的巨型神经网络，是 coding agent 的大脑。
related: [token, context-window, agent, hallucination]
appearsIn: [timeline.session, timeline.part.step-finish]
quiz:
  - q: LLM 在训练阶段学到的核心目标是什么？
    options: [预测下一个 token, 记住所有代码库, 执行 shell 命令, 编译 TypeScript]
    answer: 0
    why: 其余能力（写代码、调用工具）都是这一目标在大规模数据上的涌现结果。
sources:
  - { title: "Attention Is All You Need", url: https://arxiv.org/abs/1706.03762 }
  - { title: "Anthropic: How Claude works", url: https://www.anthropic.com/research }
---
## 为什么重要
你在时间线里看到的每一段回复、每一次工具调用，都是 LLM 根据「当前上下文」做出的预测。理解它「只看得到上下文里的东西」，能解释绝大多数 agent 的奇怪行为。

## 在 PixelWeb 里出现在哪
每条 assistant 消息上标着 `providerID/modelID`，那就是这次回复用的 LLM。`step-finish` 上的 token 数就是它这一步「读了多少、写了多少」。

## 动手试试
在时间线里对比两条消息的 input token：为什么后一条几乎总是更多？
