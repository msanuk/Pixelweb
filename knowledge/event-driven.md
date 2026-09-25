---
id: event-driven
title: 事件驱动（Event-Driven）
aliases: [事件驱动, event-driven, 发布订阅, pub/sub]
category: architecture
level: 2
summary: 组件之间不直接调用，而是发出事件、由订阅者响应；解耦且天然适合实时系统。
related: [sse, websocket, webhook, coupling]
appearsIn: [ui.ws, ui.sse]
quiz:
  - q: PixelWeb 中「OpenCode 改了文件 → Git 面板刷新」是如何串起来的？
    options: [定时轮询, 监听 file.edited 事件后触发刷新, 用户手动点击, 数据库触发器]
    answer: 1
sources:
  - { title: "Martin Fowler: What do you mean by Event-Driven?", url: https://martinfowler.com/articles/201701-event-driven.html }
---
## 为什么重要
理解事件流，你就能读懂 PixelWeb 后端 `index.ts` 里那几行「on → broadcast」的粘合代码。

## 在 PixelWeb 里出现在哪
一切实时刷新。

## 动手试试
`--verbose` 启动，看事件与界面变化的对应。
