---
id: monorepo
title: Monorepo 与 workspaces
aliases: [monorepo, workspaces, npm workspaces, 多包仓库]
category: tooling
level: 2
summary: 一个仓库放多个相互依赖的包；npm workspaces 让它们互相引用并共享 node_modules。
related: [module, dependency-graph]
appearsIn: [arch.node]
quiz:
  - q: PixelWeb 仓库里 `packages/shared` 的角色？
    options: [前端, 后端, 前后端共用的类型定义, 测试]
    answer: 2
sources:
  - { title: "npm workspaces", url: https://docs.npmjs.com/cli/v10/using-npm/workspaces }
---
## 为什么重要
架构图里 `packages/*` 的分组就来自这个结构。

## 在 PixelWeb 里出现在哪
架构图顶层节点。

## 动手试试
看 `package.json` 里的 `workspaces` 字段。
