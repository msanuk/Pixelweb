---
id: environment-variable
title: 环境变量
aliases: [environment variable, env, .env]
category: tooling
level: 1
summary: 进程启动时从外部注入的键值对，用来放配置和密钥而不写进代码。
related: [cli]
appearsIn: [ui.status]
quiz:
  - q: 把 API key 放进环境变量而不是源码的主要原因？
    options: [更快, 不会被提交进仓库泄露, 更短, 语法要求]
    answer: 1
sources:
  - { title: "12-Factor: Config", url: https://12factor.net/zh_cn/config }
---
## 为什么重要
OpenCode 的模型密钥、`OPENCODE_SERVER_PASSWORD` 都在这里。

## 在 PixelWeb 里出现在哪
`PIXELWEB_*` 系列变量与 CLI 标志等价。

## 动手试试
`PIXELWEB_VERBOSE=1 pixelweb` 看原始事件日志。
