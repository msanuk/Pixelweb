---
id: permission
title: 权限确认（Permission）
aliases: [permission, 权限, 授权, 审批]
category: ai
level: 1
summary: agent 执行高风险工具前暂停等待你批准的机制，是「人在回路」的最后闸门。
related: [tool-call, tool-bash, sandbox]
appearsIn: [timeline.permission]
quiz:
  - q: 权限请求出现时 agent 处于什么状态？
    options: [继续执行, 阻塞等待回复, 已完成, 已崩溃]
    answer: 1
sources:
  - { title: "OpenCode permissions", url: https://opencode.ai/docs/permissions }
---
## 为什么重要
理解权限模型，你才能决定「哪些交给 agent 自动跑，哪些必须看一眼」。

## 在 PixelWeb 里出现在哪
时间线顶部的黄色横幅（`permission.updated` 事件），回复在 OpenCode 里完成。

## 动手试试
看一次被拒绝的权限之后 agent 如何改变策略。
