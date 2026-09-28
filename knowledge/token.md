---
id: token
title: Token
aliases: [tokens, 词元, input token, output token]
category: ai
level: 1
summary: LLM 处理文本的最小单位，大致 1 token ≈ 3–4 个英文字符或 1–2 个汉字；计费和上下文长度都按它算。
related: [context-window, llm, compaction, prompt-cache]
appearsIn: [timeline.part.step-finish]
quiz:
  - q: 下面哪项最直接决定一次调用的费用？
    options: [消息条数, 输入与输出 token 数, 会话标题长度, 工具调用次数]
    answer: 1
sources:
  - { title: "OpenAI Tokenizer", url: https://platform.openai.com/tokenizer }
---
## 为什么重要
token 是 AI 世界的「字节」。上下文窗口装不下、账单变高、回复被截断，根源都是 token。

## 在 PixelWeb 里出现在哪
时间线每个 `step-finish` 节点显示 input / output / cache read 三个数字，悬停能看到费用。

## 动手试试
让 agent 读一个大文件，观察下一步 input token 的跳升。
