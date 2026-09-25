---
id: cors
title: CORS
aliases: [跨域, 跨域资源共享]
category: web
level: 2
summary: 浏览器的安全规则：网页只能请求「同源」地址，除非目标服务器用响应头明确放行。
related: [http, localhost-port]
appearsIn: [ui.proxy]
quiz:
  - q: PixelWeb 前端为何不直接请求 OpenCode 的 4096 端口？
    options: [太慢, 不同端口即不同源，会被 CORS 拦截；走后端代理更简单, 端口被占用, 协议不同]
    answer: 1
sources:
  - { title: "MDN: CORS", url: https://developer.mozilla.org/docs/Web/HTTP/CORS }
---
## 为什么重要
「本地都能 curl 通，浏览器却报错」十有八九是 CORS。

## 在 PixelWeb 里出现在哪
后端统一代理，前端只跟同源的 `/api` 说话。

## 动手试试
在 DevTools 里看一次被 CORS 拦下的请求长什么样。
