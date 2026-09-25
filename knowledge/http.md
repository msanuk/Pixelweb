---
id: http
title: HTTP
aliases: [HTTP 协议, 请求, 响应, 状态码]
category: web
level: 1
summary: Web 的基础请求-响应协议：方法 + 路径 + 头 + 体，返回状态码（2xx 成功 4xx 你错 5xx 它错）。
related: [rest-api, sse, websocket, cors]
appearsIn: [timeline.tool.webfetch]
quiz:
  - q: 502 属于哪一类？
    options: [成功, 重定向, 客户端错误, 服务端/网关错误]
    answer: 3
sources:
  - { title: "MDN: HTTP", url: https://developer.mozilla.org/docs/Web/HTTP }
---
## 为什么重要
PixelWeb 连不上 OpenCode 时会返回 502，读懂状态码等于会看第一行日志。

## 在 PixelWeb 里出现在哪
任何红色错误提示。

## 动手试试
关掉 opencode serve，再刷新 session 列表。
