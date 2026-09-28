---
id: rag
title: RAG
aliases: [检索增强生成, Retrieval-Augmented Generation, Agentic RAG, 智能体化 RAG]
keywords: [向量检索, embedding, 嵌入, 知识库检索, BM25]
category: ai
level: 2
summary: 先从知识库里找出相关片段，再连同问题一起交给模型回答，让模型用上训练数据以外的资料。
related: [tool-search, context-engineering, prompt-injection, hallucination]
appearsIn: [timeline.tool.grep]
quiz:
  - q: 「智能体化 RAG」和传统 RAG 的主要区别是？
    options: [用了更大的向量库, 检索变成 agent 可以反复调用的工具，查不够就换个词再查, 不再需要知识库, 只检索一次但检索得更准]
    answer: 1
  - q: OpenCode 这类终端 coding agent 为什么不给代码库建向量索引？
    options: [向量检索完全没用, 现场 grep 就够用，又省掉索引过期和代码外发的麻烦, 终端里跑不了向量模型, 代码不能被切块]
    answer: 1
sources:
  - { title: "Lewis et al. Retrieval-Augmented Generation (2020)", url: https://arxiv.org/abs/2005.11401 }
  - { title: "李博杰《深入理解 AI Agent》第 3、5 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
coding agent 天天在做 RAG，只是检索工具换成了 grep 和 glob：搜一次，读几个文件，不够再搜。Cursor 走另一条路，建语义索引，能找到「意思相近但用词不同」的代码。两边的取舍是：索引要维护、代码要外发，换来跨文件的语义召回。

## 在 PixelWeb 里出现在哪
时间线里一串 `grep → read → grep → read`，就是 agent 在一轮轮检索。

## 动手试试
看 agent 第一次 grep 用的关键词，和它最后真正改的那个文件，中间换了几次搜法。
