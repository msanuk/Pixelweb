---
id: agent
title: Agent
aliases: [智能体, AI agent, agentic]
category: ai
level: 1
summary: 让 LLM 在「思考 → 调用工具 → 看结果」的循环里自主推进任务的程序。
related: [coding-agent, tool-call, llm, permission, react-loop, harness]
appearsIn: [timeline.session]
quiz:
  - q: agent 与单次聊天最本质的区别是？
    options: [用了更大的模型, 能循环调用工具并读结果, 回复更长, 支持中文]
    answer: 1
sources:
  - { title: "Anthropic: Building effective agents", url: https://www.anthropic.com/research/building-effective-agents }
  - { title: "李博杰《深入理解 AI Agent》第 1 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
拆开看，Agent = 模型 + 上下文 + 工具：模型决定下一步做什么，上下文决定它看得到什么，工具决定它能动什么。三样缺一样都跑不起来。

PixelWeb 本身**不是** agent：它不调用工具、不写代码，只观察和引导下层 agent（OpenCode）。分清这两层，才知道该找谁负责。

## 在 PixelWeb 里出现在哪
每个 session 就是一次 agent 运行；时间线的「工具调用 → 结果 → 再思考」就是 agent 循环本身。

## 动手试试
数一数一条 assistant 消息里有几个 `step-start`，那就是循环跑了几圈。
