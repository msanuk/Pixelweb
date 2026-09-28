---
id: observability
title: 可观测性
aliases: [observability]
keywords: [trace, span, 追踪, 轨迹回放, OpenTelemetry, 日志]
category: ai
level: 2
summary: 不打开系统内部，只靠它吐出来的日志、指标和调用记录，推断它做了什么、为什么这么做。
related: [agent, harness, event-driven, react-loop]
appearsIn: [timeline.session]
quiz:
  - q: agent 做错了一件事，最先该看什么？
    options: [模型的参数量, 它那次运行的完整轨迹：读了什么、调了什么、拿到什么, 系统提示的字数, 同类任务的平均耗时]
    answer: 1
    why: 同样的输入 agent 也可能走出不同的路，只有回放那一次的轨迹，才知道是哪一步开始偏的。
sources:
  - { title: "OpenTelemetry: Traces", url: https://opentelemetry.io/docs/concepts/signals/traces/ }
  - { title: "李博杰《深入理解 AI Agent》第 6 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
agent 的执行路径每次都可能不一样，只看最终回答判断不了它哪里出了问题。可观测性的做法是把一次运行记成一棵树：每次模型调用、每次工具调用都是一个节点，带输入输出、耗时、token 和错误。

## 在 PixelWeb 里出现在哪
PixelWeb 本身就是给 OpenCode 做的可观测性：时间线是轨迹回放，step 行上的 token 和缓存是指标，权限和错误是事件。

## 动手试试
找一个失败的会话，从最后一步往前倒着看，找到第一个「这里就已经不对了」的节点。
