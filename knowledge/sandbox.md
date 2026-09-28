---
id: sandbox
title: 沙箱（Sandbox）
aliases: [sandbox, 隔离环境]
keywords: [容器]
category: general
level: 2
summary: 限制程序能触碰的文件、网络和进程的隔离环境，让 agent 犯错的代价可控。
related: [permission, tool-bash, lethal-trifecta]
appearsIn: [timeline.permission]
quiz:
  - q: 沙箱与权限确认的关系？
    options: [互斥, 沙箱限制「能做什么」，权限确认决定「做之前问不问」，可叠加, 相同, 沙箱更慢]
    answer: 1
sources:
  - { title: "Anthropic: Claude Code sandboxing", url: https://docs.anthropic.com/en/docs/claude-code/security }
  - { title: "李博杰《深入理解 AI Agent》第 4、5 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
你敢让 agent 自动跑多少，取决于沙箱有多严。Python 的 venv 不是沙箱，它只隔离依赖包，不管文件和网络。真正的隔离从弱到强：系统级限制（macOS 的 sandbox-exec）、容器、虚拟机。最该先关的是网络出口：即使 agent 被骗读到了密钥，也传不出去。

## 在 PixelWeb 里出现在哪
权限横幅旁的提示。

## 动手试试
看看 OpenCode 的权限配置允许自动执行哪些命令。
