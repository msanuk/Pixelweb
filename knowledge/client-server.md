---
id: client-server
title: 客户端 / 服务端
aliases: [客户端, 服务端, 服务器, 前端, 后端, C/S]
keywords: [client, server]
category: architecture
level: 1
summary: 服务端持有数据和能力并等待请求；客户端发起请求并呈现结果。一个程序可以同时是两者。
related: [rest-api, adapter-pattern]
appearsIn: [arch.node]
quiz:
  - q: PixelWeb 后端相对 OpenCode 是什么角色？
    options: [服务端, 客户端, 数据库, 无关]
    answer: 1
    why: 它向 OpenCode 发请求；而相对浏览器它又是服务端。
sources:
  - { title: "MDN: Client-Server overview", url: https://developer.mozilla.org/docs/Learn/Server-side/First_steps/Client-Server_overview }
---
## 为什么重要
「上层工具」的本质：对下是客户端，对上是服务端。

## 在 PixelWeb 里出现在哪
架构图中 web ↔ server ↔（外部）opencode 的三层。

## 动手试试
在架构图里找出这三层。
