---
id: rest-api
title: REST API
aliases: [REST, HTTP API]
keywords: [API, 接口]
category: web
level: 1
summary: 用 HTTP 动词（GET/POST/…）操作以 URL 表示的资源，返回通常是 JSON。
related: [http, json, openapi, sdk]
appearsIn: [timeline.session]
quiz:
  - q: 创建一个 OpenCode session 用什么请求？
    options: [GET /session, POST /session, DELETE /session, PATCH /session]
    answer: 1
sources:
  - { title: "MDN: HTTP request methods", url: https://developer.mozilla.org/docs/Web/HTTP/Methods }
---
## 为什么重要
OpenCode 把自己的一切能力都暴露成 REST API，PixelWeb 才能作为「上层工具」存在。

## 在 PixelWeb 里出现在哪
后端 `/api/*` 路由把 OpenCode 的接口代理给前端。

## 动手试试
`curl http://127.0.0.1:4096/session | jq length`。
