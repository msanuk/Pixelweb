---
id: context-engineering
title: 上下文工程
aliases: [context engineering]
keywords: [提示工程, 上下文管理]
category: ai
level: 2
summary: 决定模型每一步能看到什么：放哪些信息、按什么顺序、什么时候删。比挑模型更影响结果。
related: [context-window, prompt, system-prompt, compaction, context-rot, agents-md]
appearsIn: [timeline.session]
quiz:
  - q: agent 把一个 bug 修得风格和项目格格不入，最先该补的是？
    options: [换一个更大的模型, 把项目约定写进它能读到的地方, 把温度调低, 让它多试几次]
    answer: 1
    why: 模型不知道你们的约定，就只能按通用写法来。缺的是信息，不是智力。
sources:
  - { title: "Anthropic: Effective context engineering for AI agents", url: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents }
  - { title: "李博杰《深入理解 AI Agent》第 2 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
agent 像一个很聪明、但第一天入职的同事。代码规范、测试命令、哪些目录不能碰，你不写下来它就不知道。它能做到什么程度，取决于它看到的东西。

## 在 PixelWeb 里出现在哪
时间线里每个 `read`、`grep`、`webfetch` 都在往上下文里加东西；compaction 是在删东西；上下文仪表显示现在装了多少。

## 动手试试
找一次 agent 做偏了的任务，回头看它当时读过哪些文件，缺的那条信息在不在里面。
