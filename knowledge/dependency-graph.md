---
id: dependency-graph
title: 依赖图（Dependency Graph）
aliases: [依赖关系, import graph, 模块依赖]
category: architecture
level: 1
summary: 节点是模块、边是 import 的有向图；箭头方向就是「谁需要谁」。
related: [module, coupling, monorepo]
appearsIn: [arch.edge, arch.node]
quiz:
  - q: 依赖图里入边很多的节点意味着？
    options: [它没人用, 很多模块依赖它，改动影响面大, 它很慢, 它是外部包]
    answer: 1
sources:
  - { title: "Wikipedia: Dependency graph", url: https://en.wikipedia.org/wiki/Dependency_graph }
---
## 为什么重要
agent 改一个文件前，你想知道「会波及谁」，看图比读代码快。

## 在 PixelWeb 里出现在哪
架构面板；节点大小 = 代码行数，边粗细 = import 次数。

## 动手试试
找出图里入边最多的节点。
