---
id: hallucination
title: 幻觉（Hallucination）
aliases: [hallucination, 编造, 一本正经地胡说]
category: ai
level: 1
summary: 模型自信地输出不存在的 API、文件或事实；根源是它在预测「像真的」而不是「是真的」。
related: [llm, tool-call]
appearsIn: [timeline.part.text]
quiz:
  - q: 降低 coding agent 幻觉最有效的手段？
    options: [换更大模型, 让它先用工具读真实代码/文档再回答, 加感叹号, 用英文]
    answer: 1
sources:
  - { title: "Survey of Hallucination in NLG", url: https://arxiv.org/abs/2202.03629 }
---
## 为什么重要
agent 说「测试通过了」不等于测试通过了。PixelWeb 把工具输出摆在旁边，就是为了让你核对。

## 在 PixelWeb 里出现在哪
任何 text 部分旁都能看到它之前的工具结果。

## 动手试试
找一句 agent 的断言，往上翻找到支撑它的工具输出。
