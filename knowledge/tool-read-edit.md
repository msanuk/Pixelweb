---
id: tool-read-edit
title: read / edit / write 工具
aliases: [读文件, 改文件, 写文件]
keywords: [read, edit, write]
category: ai
level: 1
summary: agent 的「眼」和「手」：read 把文件内容放进上下文，edit 做精确字符串替换，write 整文件覆盖。
related: [tool-call, diff, token]
appearsIn: [timeline.tool.read, timeline.tool.edit, timeline.tool.write]
quiz:
  - q: 为什么 agent 通常先 read 再 edit？
    options: [规范要求, edit 需要精确匹配现有文本, read 更便宜, 顺序无所谓]
    answer: 1
sources:
  - { title: "OpenCode tools", url: https://opencode.ai/docs/tools }
---
## 为什么重要
read 越多，上下文越贵；edit 失败几乎都是「旧文本不匹配」。看懂这三种调用，就能读懂 agent 90% 的工作。

## 在 PixelWeb 里出现在哪
时间线卡片；对应的文件路径会与 git 面板的改动列表联动。

## 动手试试
找到一次失败的 edit，看它的 error 文本，再看 agent 下一步怎么补救。
