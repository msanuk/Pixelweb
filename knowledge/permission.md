---
id: permission
title: 权限确认（Permission）
aliases: [审批]
keywords: [权限, 授权, permission]
category: ai
level: 1
summary: agent 执行高风险工具前暂停等待你批准的机制，是「人在回路」的最后闸门。
related: [tool-call, tool-bash, sandbox, doom-loop, lethal-trifecta, prompt-injection]
appearsIn: [timeline.permission]
quiz:
  - q: 权限请求出现时 agent 处于什么状态？
    options: [继续执行, 阻塞等待回复, 已完成, 已崩溃]
    answer: 1
sources:
  - { title: "OpenCode permissions", url: https://opencode.ai/docs/permissions }
  - { title: "李博杰《深入理解 AI Agent》第 1、4 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
理解权限模型，你才能决定「哪些交给 agent 自动跑，哪些必须看一眼」。被注入的 agent 自己察觉不到，只有这道在上下文之外的闸不受话术影响。书里主张默认全关、按需放开；OpenCode 正相反，大多数操作默认直接放行，只有 `doom_loop` 和项目外的目录会问，`.env` 默认不让读。想让 bash、webfetch 先问你，要在 opencode.json 的 `permission` 里设成 `ask`。

## 在 PixelWeb 里出现在哪
时间线顶部的黄色横幅（`permission.asked` 事件），可以直接在横幅上允许一次、总是允许或拒绝。类型是 `doom_loop` 的请求表示 agent 在原地打转。

## 动手试试
看一次被拒绝的权限之后 agent 如何改变策略。
