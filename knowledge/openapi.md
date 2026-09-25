---
id: openapi
title: OpenAPI
aliases: [Swagger, API 规范]
category: web
level: 2
summary: 用一份机器可读的 JSON/YAML 描述整个 REST API，可自动生成文档和 SDK。
related: [rest-api, sdk]
appearsIn: [timeline.session]
quiz:
  - q: OpenCode 在哪个路径提供 OpenAPI 规范？
    options: [/openapi, /doc, /swagger.json, /spec]
    answer: 1
sources:
  - { title: "OpenAPI Initiative", url: https://www.openapis.org }
---
## 为什么重要
`@opencode-ai/sdk` 就是从 `/doc` 的规范生成的；读规范比读源码更快掌握一个服务。

## 在 PixelWeb 里出现在哪
后端类型 `packages/shared/src/index.ts` 对应规范里的 schema。

## 动手试试
打开 `http://127.0.0.1:4096/doc`。
