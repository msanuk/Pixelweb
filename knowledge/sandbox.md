---
id: sandbox
title: 沙箱（Sandbox）
aliases: [sandbox, 隔离环境, 容器]
category: general
level: 2
summary: 限制程序能触碰的文件、网络和进程的隔离环境，让 agent 犯错的代价可控。
related: [permission, tool-bash]
appearsIn: [timeline.permission]
quiz:
  - q: 沙箱与权限确认的关系？
    options: [互斥, 沙箱限制「能做什么」，权限确认决定「做之前问不问」，可叠加, 相同, 沙箱更慢]
    answer: 1
sources:
  - { title: "Anthropic: Claude Code sandboxing", url: https://docs.anthropic.com/en/docs/claude-code/security }
---
## 为什么重要
你敢让 agent 自动跑多少，取决于沙箱有多严。

## 在 PixelWeb 里出现在哪
权限横幅旁的提示。

## 动手试试
看看 OpenCode 的权限配置允许自动执行哪些命令。
