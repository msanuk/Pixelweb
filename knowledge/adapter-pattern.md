---
id: adapter-pattern
title: 适配器模式（Adapter）
aliases: [adapter, 适配层]
keywords: [抽象层]
category: architecture
level: 2
summary: 在你的核心逻辑与外部系统之间放一层「翻译」，替换外部系统时只改这一层。
related: [coupling, client-server, sdk]
appearsIn: [arch.node]
quiz:
  - q: PixelWeb 要支持 Claude Code 等其它 agent，应该改哪里？
    options: [前端所有面板, 新增一个 agent 适配器、输出同样的事件, 重写 git 服务, 换数据库]
    answer: 1
sources:
  - { title: "Refactoring Guru: Adapter", url: https://refactoring.guru/design-patterns/adapter }
---
## 为什么重要
`opencode/client.ts` 就是一个适配器；它是 PixelWeb 与任何一款 agent 之间唯一的接缝。

## 在 PixelWeb 里出现在哪
架构图中 `packages/server/src/opencode` 节点。

## 动手试试
数一数有多少节点依赖它——应该很少。
