---
id: module
title: 模块（Module）
aliases: [module, ES module]
keywords: [import, export]
category: architecture
level: 1
summary: 一个有自己作用域、通过 import/export 与外界交换的代码单元，通常就是一个文件。
related: [dependency-graph, coupling]
appearsIn: [arch.node]
quiz:
  - q: 依赖图的边是从哪条语句提取的？
    options: [函数调用, import / require 语句, 注释, 变量名]
    answer: 1
sources:
  - { title: "MDN: JavaScript modules", url: https://developer.mozilla.org/docs/Web/JavaScript/Guide/Modules }
---
## 为什么重要
模块边界就是可以放心「只改这里」的边界。

## 在 PixelWeb 里出现在哪
架构图文件层级的每个节点。

## 动手试试
切换到「文件级」看一个目录内部的依赖。
