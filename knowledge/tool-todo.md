---
id: tool-todo
title: todowrite 工具
aliases: [todowrite, todoread, 任务清单]
keywords: [todo]
category: ai
level: 1
summary: agent 用来维护自己的待办列表，把长任务拆成可勾选的步骤。
related: [agent, tool-call]
appearsIn: [timeline.tool.todowrite, timeline.todo]
quiz:
  - q: todo 列表对 agent 的主要作用？
    options: [向用户炫耀, 在长任务里防止遗漏步骤, 减少 token, 触发权限]
    answer: 1
sources:
  - { title: "OpenCode tools", url: https://opencode.ai/docs/tools }
---
## 为什么重要
它是 agent 的「外置记忆」，也是你判断任务进度最直观的窥孔。

## 在 PixelWeb 里出现在哪
时间线右上角的任务清单，随 `todo.updated` 事件实时刷新。

## 动手试试
对照 todo 完成顺序与工具调用顺序。
