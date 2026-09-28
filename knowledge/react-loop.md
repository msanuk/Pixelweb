---
id: react-loop
title: ReAct 循环
aliases: [ReAct loop, 思考-行动-观察, 轨迹, trajectory]
keywords: [ReAct, reasoning and acting, 循环]
category: ai
level: 1
summary: agent 的基本节拍：想一步、调一次工具、看结果，再想下一步，直到不再调用工具为止。每一圈都会追加到轨迹里。
related: [agent, tool-call, reasoning, prompt-cache, harness]
appearsIn: [timeline.part.step-finish]
quiz:
  - q: 每一圈循环里，模型看到的上下文是什么？
    options: [只有最新一条工具结果, 系统提示 + 工具定义 + 到目前为止的全部轨迹, 只有用户最初的问题, 上一圈的思考过程]
    answer: 1
    why: 模型本身不记事，每一圈都要把固定的开头和不断变长的轨迹整段重新发一遍。
  - q: 下面哪种情况最可能让 agent 在同一个操作上反复打转？
    options: [工具结果没有回到上下文里, 系统提示写得太长, 模型输出速度太慢, 用户消息里有错别字]
    answer: 0
    why: 看不到上一次的结果，模型就不知道自己做过了，只能再做一遍。
sources:
  - { title: "Yao et al. ReAct (2022)", url: https://arxiv.org/abs/2210.03629 }
  - { title: "李博杰《深入理解 AI Agent》第 1 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
每次请求 = 静态前缀（系统提示、工具定义）+ 轨迹（用户消息、模型回复、工具结果）。前缀不变、轨迹只往后加，所以提示缓存才能命中；轨迹越长，每一圈越贵。

## 在 PixelWeb 里出现在哪
一条 assistant 消息里的每个 `step-start … step-finish` 就是一圈。某一圈没有工具调用、只有文字，循环就结束了。

## 动手试试
数一个会话跑了多少圈，再看最后几圈的 input token 比第一圈多了多少。
