---
id: tool-task
title: 子任务 / subagent
aliases: [subtask, subagent, 子代理, 子任务]
keywords: [task]
category: ai
level: 2
summary: agent 派生一个独立的子 agent 去完成一个子目标，只把结论带回主上下文，隔离噪音。
related: [agent, context-window, session, context-rot, compaction, worktree]
appearsIn: [timeline.tool.task, timeline.part.subtask]
quiz:
  - q: 用子任务最大的好处是？
    options: [更快, 不消耗 token, 隔离大量中间输出、保持主上下文干净, 不需要权限]
    answer: 2
sources:
  - { title: "OpenCode agents", url: https://opencode.ai/docs/agents }
  - { title: "李博杰《深入理解 AI Agent》第 2 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
大型搜索/研究会产生海量输出。放在子任务里，主会话只拿到结论。这比事后再压缩省事：噪音从一开始就没进主上下文，主会话的缓存前缀也不受影响。

代价是子 agent 看不到主会话的历史，任务描述必须自己把话说全。

## 在 PixelWeb 里出现在哪
时间线 `subtask` 节点；OpenCode 中子 session 带 `parentID`，左侧列表会缩进显示。

## 动手试试
点开一个子 session，看看它读了多少东西却只回了一段话。
