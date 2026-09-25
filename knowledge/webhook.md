---
id: webhook
title: Webhook
aliases: [web hook, 回调 URL, 事件回调]
category: web
level: 1
summary: 服务端在事件发生时主动向你预先登记的 URL 发一个 HTTP 请求——「有事我叫你」，而不是你反复去问。
related: [sse, websocket, rest-api, http]
appearsIn: [git.remote]
quiz:
  - q: Webhook 中谁发起 HTTP 请求？
    options: [接收方轮询, 事件发生的一方主动推送, 浏览器, DNS 服务器]
    answer: 1
  - q: Webhook 与 SSE 的主要区别？
    options: [没有区别, Webhook 需要接收方有可公网访问的 URL；SSE 由客户端先建连接, SSE 更慢, Webhook 只能用于 GitHub]
    answer: 1
sources:
  - { title: "GitHub Webhooks", url: https://docs.github.com/en/webhooks }
  - { title: "MDN: HTTP", url: https://developer.mozilla.org/docs/Web/HTTP }
---
## 为什么重要
CI 触发、PR 通知、支付回调都靠它。它把「轮询」变成「推送」，是事件驱动架构的入口。

## 在 PixelWeb 里出现在哪
PixelWeb 自己**没有**用 webhook（它监听的是 OpenCode 的 SSE），但 GitHub 通知 CI 就是 webhook。二者都是「推」，方向和建连方式不同。

## 动手试试
在 GitHub 仓库设置里看 Webhooks 页面的 recent deliveries。
