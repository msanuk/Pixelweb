---
id: prompt-cache
title: Prompt Caching
aliases: [提示缓存, prompt cache, 前缀缓存, prefix caching]
keywords: [缓存命中, 缓存中断, cache read, cache write, 缓存有效期]
category: ai
level: 2
summary: 模型服务商把请求开头那段不变的内容（工具、系统提示、历史）存起来，下次前缀一模一样时直接复用，更快也更便宜。
related: [token, system-prompt, compaction, context-window, kv-cache, agents-md, agent-skills]
appearsIn: [timeline.part.step-finish, timeline.cache]
quiz:
  - q: 下面哪种操作最不会让 agent 会话的缓存失效？
    options: [会话中途换模型, 在同一会话里继续追问, 从 build 切到 plan, 闲置半小时再回来]
    answer: 1
    why: 追问只是在末尾追加消息，前缀没变；其他三种都会改变前缀或让缓存过期。
  - q: 缓存按什么匹配？
    options: [消息的语义相似度, 从请求开头起逐字相同的前缀, 会话标题, 最后一条消息]
    answer: 1
sources:
  - { title: "Anthropic: Prompt caching", url: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching }
  - { title: "OpenAI: Prompt caching", url: https://platform.openai.com/docs/guides/prompt-caching }
  - { title: "DeepSeek: Context caching", url: https://api-docs.deepseek.com/guides/kv_cache }
  - { title: "李博杰《深入理解 AI Agent》第 2 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
agent 每一步都会把整段对话重新发一遍。命中缓存的部分按原价的一到五折计费（看服务商），还省去重新处理的时间；前缀里任何一个字变了，从那里往后都要重算。所以会变的内容（时间、状态）只能往末尾加，不能写进系统提示或 AGENTS.md。

## 在 PixelWeb 里出现在哪
时间线顶部的「缓存命中」是整个会话的命中率；每个 `step` 行的 cache 后面是这一步的命中率。命中量突然掉下来的那一步会标出「缓存中断」和可能原因：闲置超过有效期（常见是 5 分钟）、换了模型或 agent、上下文压缩、改了 AGENTS.md。

## 动手试试
在同一个会话里连问两句，看第二步的命中率；再闲置 6 分钟后追问，对比一下。
