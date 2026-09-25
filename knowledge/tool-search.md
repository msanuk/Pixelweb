---
id: tool-search
title: grep / glob 工具
aliases: [grep, glob, 搜索代码, 文件匹配]
category: ai
level: 1
summary: glob 按文件名模式找文件，grep 按内容找文本；两者是 agent 「先找到再动手」的定位手段。
related: [tool-call, tool-read-edit]
appearsIn: [timeline.tool.grep, timeline.tool.glob]
quiz:
  - q: 要找「所有以 .test.ts 结尾的文件」应该用哪个？
    options: [grep, glob, bash cat, read]
    answer: 1
sources:
  - { title: "ripgrep", url: https://github.com/BurntSushi/ripgrep }
---
## 为什么重要
好的 agent 在改代码前会大量搜索。搜索太少 = 瞎改；搜索太多 = 上下文膨胀。

## 在 PixelWeb 里出现在哪
时间线卡片，input 里能看到 pattern。

## 动手试试
观察一次任务里 grep/glob 与 edit 的比例。
