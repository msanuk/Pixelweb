---
id: sdk
title: SDK
aliases: [软件开发工具包, client library]
category: tooling
level: 1
summary: 把某个服务的 API 封装成你所用语言里的函数与类型，省去手写 HTTP 的麻烦。
related: [rest-api, openapi]
appearsIn: [arch.external]
quiz:
  - q: PixelWeb 为什么选择自己写一个精简客户端而不用官方 SDK？
    options: [SDK 不存在, 只需少数端点且要自管 SSE 重连，同时便于日后接其它 agent, SDK 收费, 版权问题]
    answer: 1
sources:
  - { title: "@opencode-ai/sdk", url: https://www.npmjs.com/package/@opencode-ai/sdk }
---
## 为什么重要
用 SDK 快，自己写可控。两者取舍是每个集成项目的第一课。

## 在 PixelWeb 里出现在哪
架构图里的外部依赖节点。

## 动手试试
对照 `opencode/client.ts` 与 SDK 的类型定义。
