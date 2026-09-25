---
id: coupling
title: 耦合（Coupling）
aliases: [coupling, 高内聚低耦合, 循环依赖]
category: architecture
level: 2
summary: 模块间相互依赖的紧密程度；耦合越高，改一处越容易牵连他处；循环依赖是最糟的形态。
related: [dependency-graph, adapter-pattern]
appearsIn: [arch.edge]
quiz:
  - q: 依赖图里出现 A→B 且 B→A 说明？
    options: [设计良好, 循环依赖，需要抽出公共模块, 性能好, 是外部库]
    answer: 1
sources:
  - { title: "Wikipedia: Coupling", url: https://en.wikipedia.org/wiki/Coupling_(computer_programming) }
---
## 为什么重要
让 agent 重构时，「降低耦合」是能被图验证的目标。

## 在 PixelWeb 里出现在哪
架构图中双向边会加粗标红。

## 动手试试
找一条双向边并想想该抽出什么。
