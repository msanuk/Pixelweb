---
id: typescript
title: TypeScript
aliases: [TS, 类型检查, tsc]
category: tooling
level: 1
summary: 给 JavaScript 加静态类型的语言；编译期发现错误，也是 agent 的「安全带」。
related: [module, sdk]
appearsIn: [arch.node]
quiz:
  - q: "`npm run typecheck` 失败意味着？"
    options: [程序一定跑不起来, 存在类型不一致，可能是 bug, 网络问题, 需要重装]
    answer: 1
sources:
  - { title: "TypeScript Handbook", url: https://www.typescriptlang.org/docs/handbook/intro.html }
---
## 为什么重要
agent 改完代码后跑 tsc 是最便宜的验证；PixelWeb 全栈 TS，前后端共享一份类型。

## 在 PixelWeb 里出现在哪
架构图里蓝色节点为 TS 文件。

## 动手试试
故意改坏 `shared/src/index.ts` 一个字段，看两端谁先报错。
