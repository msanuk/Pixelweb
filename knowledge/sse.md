---
id: sse
title: SSE（Server-Sent Events）
aliases: [SSE, Server-Sent Events, 服务器推送事件, event stream]
category: web
level: 1
summary: 基于普通 HTTP 的单向长连接：服务端持续往下发 `data:` 行，客户端只收不发。
related: [websocket, webhook, http]
appearsIn: [ui.sse, timeline.session]
quiz:
  - q: SSE 是几向通信？
    options: [双向, 服务端→客户端单向, 客户端→服务端单向, 不通信]
    answer: 1
sources:
  - { title: "MDN: Using server-sent events", url: https://developer.mozilla.org/docs/Web/API/Server-sent_events/Using_server-sent_events }
---
## 为什么重要
PixelWeb 之所以能「实时」看到 agent 的每个动作，就是因为 `opencode serve` 通过 `/global/event` 用 SSE 推事件。

## 在 PixelWeb 里出现在哪
顶栏连接指示灯；后端 `packages/server/src/opencode/client.ts` 解析 SSE。

## 动手试试
`curl -N http://127.0.0.1:4096/global/event` 直接看原始流。
