---
id: localhost-port
title: localhost 与端口
aliases: [端口, port, 127.0.0.1, localhost]
category: web
level: 1
summary: localhost/127.0.0.1 指本机；端口是同一台机器上区分不同服务的门牌号。
related: [http, cors]
appearsIn: [ui.status]
quiz:
  - q: PixelWeb 默认用哪两个端口？
    options: [80 与 443, 4096（OpenCode）与 7420（PixelWeb）, 3000 与 8080, 22 与 21]
    answer: 1
sources:
  - { title: "Wikipedia: Port", url: https://zh.wikipedia.org/wiki/通訊埠 }
---
## 为什么重要
「连接被拒绝」通常是服务没起或端口写错。

## 在 PixelWeb 里出现在哪
顶栏显示 OpenCode 地址。

## 动手试试
`opencode serve --port 5000`，再用 `--opencode http://127.0.0.1:5000` 启动 PixelWeb。
