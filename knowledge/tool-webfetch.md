---
id: tool-webfetch
title: webfetch 工具
aliases: [webfetch, 抓网页]
keywords: [fetch]
category: ai
level: 1
summary: 让 agent 抓取一个 URL 的内容读进上下文，常用于查文档。
related: [tool-call, http, rest-api]
appearsIn: [timeline.tool.webfetch]
quiz:
  - q: webfetch 抓回的内容会去哪？
    options: [保存到磁盘, 进入模型上下文, 发送到 GitHub, 被丢弃]
    answer: 1
sources:
  - { title: "OpenCode tools", url: https://opencode.ai/docs/tools }
---
## 为什么重要
网页内容进入上下文后与你的指令「平级」，所以要警惕网页里的指令注入。

## 在 PixelWeb 里出现在哪
时间线卡片，展开能看 URL。

## 动手试试
看看 PixelWeb 的 explain 会话里，导师查了哪些文档。
