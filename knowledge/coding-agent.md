---
id: coding-agent
title: Coding Agent
aliases: [编程智能体, OpenCode, Claude Code, 代码 agent]
category: ai
level: 1
summary: 专门面向软件开发的 agent，工具集是读写文件、跑命令、搜代码，直接在你的仓库里干活。
related: [agent, tool-call, permission, session, harness, agents-md]
appearsIn: [timeline.session]
quiz:
  - q: PixelWeb 通过什么方式连接 OpenCode？
    options: [读取它的日志文件, 它的 HTTP API 与 SSE 事件流, 截屏识别终端, 直接调用模型 API]
    answer: 1
sources:
  - { title: "OpenCode Server docs", url: https://opencode.ai/docs/server }
  - { title: "李博杰《深入理解 AI Agent》第 5 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
coding agent 的动作对仓库有真实副作用（改文件、跑命令）。可视化这些动作，是安全地把工作交出去的前提。

它是目前最成熟的一类 agent，靠的不全是模型：写代码有测试、类型检查、lint 当自动裁判，有 git 可以回退。所以「测试通过」才算做完，「代码写完」不算。

## 在 PixelWeb 里出现在哪
顶栏的连接状态指向 `opencode serve`；左侧列表就是它的所有 session。

## 动手试试
在 OpenCode 里发一句话，看 PixelWeb 时间线里几乎同时冒出的事件。
