---
id: mcp
title: MCP
aliases: [Model Context Protocol, MCP server, MCP 服务器]
category: ai
level: 2
summary: 一个开放协议，让任何外部服务以统一格式向 agent 暴露「工具」和「资源」。
related: [tool-call, sdk, client-server, prompt-injection, agent-skills, lethal-trifecta]
appearsIn: [timeline.tool.mcp]
quiz:
  - q: MCP 解决的核心问题是？
    options: [模型太慢, 工具接入方式各不相同, token 太贵, 没有中文支持]
    answer: 1
sources:
  - { title: "MCP 官方文档", url: https://modelcontextprotocol.io }
  - { title: "李博杰《深入理解 AI Agent》第 4 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
有了 MCP，给 agent 加一个新能力不需要改 agent 本身。PixelWeb 未来也可以做成一个 MCP server 提供「解释这个概念」工具。

代价有两个。每个工具的定义每次请求都要带上，接五个 server 就可能占掉几万 token，工具一多模型也更容易选错。工具描述原样进入上下文，恶意 server 可以在描述里夹带指令，接入前要像审代码一样看一遍。

## 在 PixelWeb 里出现在哪
工具名带前缀（如 `github_xxx`）的调用通常来自 MCP server。

## 动手试试
在 OpenCode 配置里看看接了哪些 MCP server。
