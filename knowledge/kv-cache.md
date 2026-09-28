---
id: kv-cache
title: KV Cache
aliases: [KV 缓存, 键值缓存]
keywords: [prefill, 首 token 延迟, TTFT, 注意力]
category: ai
level: 3
summary: 模型把已经算过的每个 token 的中间结果（Key、Value）存下来，后面的 token 直接复用；前面任何一个 token 变了，从那里往后都得重算。
related: [prompt-cache, token, llm, context-window]
appearsIn: [timeline.cache]
quiz:
  - q: 系统提示开头多了一个空格，会怎样？
    options: [只有那个空格要重算, 从空格往后全部重算, 什么都不影响, 只影响最后一条消息]
    answer: 1
    why: 模型是一层层叠起来的，每个 token 的结果都依赖它前面的所有 token，前面一动，后面全变。
  - q: KV Cache 和服务商的提示缓存（prompt cache）是什么关系？
    options: [完全无关, 提示缓存就是跨请求保存、复用 KV Cache, KV Cache 是计费规则, 提示缓存只存最后一条消息]
    answer: 1
sources:
  - { title: "Hugging Face: KV Caching Explained", url: https://huggingface.co/blog/kv-cache }
  - { title: "李博杰《深入理解 AI Agent》第 2 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
它解释了提示缓存为什么只认「从开头起一字不差」。书里的例子：有人在系统提示里加了一行 `Current time: {{now}}`，每次请求开头都不一样，首 token 延迟从 0.5 秒涨到 3–5 秒，账单差不多翻倍。会变的东西要放到最后。

## 在 PixelWeb 里出现在哪
「缓存命中」那一行里读到的部分，就是服务商复用的 KV Cache；「写」是这次新算、存下来给下次用的。

## 动手试试
在 AGENTS.md 里改一个字再追问，看下一步的缓存读数是不是掉到接近 0。
