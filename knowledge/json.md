---
id: json
title: JSON
aliases: [JavaScript Object Notation]
category: web
level: 1
summary: 用花括号、方括号和引号表示结构化数据的文本格式，是 API 与 LLM 工具调用的通用语言。
related: [rest-api, tool-call]
appearsIn: [timeline.tool.input]
quiz:
  - q: JSON 中合法的键是？
    options: [单引号字符串, 双引号字符串, 裸标识符, 数字]
    answer: 1
sources:
  - { title: "json.org", url: https://www.json.org/json-zh.html }
---
## 为什么重要
工具调用的 input/output、SSE 事件、WebSocket 消息全部是 JSON。

## 在 PixelWeb 里出现在哪
展开任何工具卡片。

## 动手试试
数一数一个 edit 调用的 input 有几个键。
