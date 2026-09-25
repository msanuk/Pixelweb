---
id: tool-call
title: Tool Call
aliases: [工具调用, function calling, 函数调用, tool use]
category: ai
level: 1
summary: 模型输出一段结构化 JSON 请求「帮我执行某个函数」，宿主程序执行后把结果塞回上下文。
related: [agent, permission, mcp]
appearsIn: [timeline.tool.bash, timeline.tool.read, timeline.tool.edit, timeline.tool.write, timeline.tool.grep, timeline.tool.glob, timeline.tool.webfetch, timeline.tool.task, timeline.tool.todowrite]
quiz:
  - q: 工具真正被「执行」的是谁？
    options: [模型本身, 宿主程序（如 OpenCode）, 浏览器, GitHub]
    answer: 1
    why: 模型只能产生文本；执行副作用永远在宿主程序里。
sources:
  - { title: "Anthropic: Tool use", url: https://docs.anthropic.com/en/docs/build-with-claude/tool-use }
---
## 为什么重要
理解「模型只是提议，程序才执行」，你就明白为什么权限控制加在宿主层，也明白 PixelWeb 能在不碰模型的情况下看到所有动作。

## 在 PixelWeb 里出现在哪
时间线里每个带工具名的卡片（`bash` / `read` / `edit` …）。状态从 pending → running → completed/error。

## 动手试试
展开一个 `edit` 调用，对照 input 里的 oldString/newString 和 git 面板里的 diff。
