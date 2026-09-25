---
id: websocket
title: WebSocket
aliases: [ws, 双向长连接]
category: web
level: 1
summary: 一次握手后升级成的全双工长连接，双方随时互发消息，适合浏览器实时应用。
related: [sse, http]
appearsIn: [ui.ws]
quiz:
  - q: PixelWeb 后端把 OpenCode 的 SSE 事件转成什么发给浏览器？
    options: [轮询接口, WebSocket 消息, 邮件, 文件]
    answer: 1
sources:
  - { title: "MDN: WebSocket", url: https://developer.mozilla.org/docs/Web/API/WebSocket }
---
## 为什么重要
浏览器需要收（事件）也需要发（刷新请求），所以 PixelWeb 前后端之间用 WebSocket；后端到 OpenCode 只需收，用 SSE 足够。

## 在 PixelWeb 里出现在哪
`/ws` 路由；前端 `src/lib/ws.ts`。

## 动手试试
在浏览器 DevTools → Network → WS 里看消息帧。
