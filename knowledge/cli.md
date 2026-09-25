---
id: cli
title: CLI
aliases: [命令行, 命令行工具, 终端]
category: tooling
level: 1
summary: 通过命令与参数操作程序的文本界面；agent 与开发者最常用的交互方式。
related: [tool-bash, environment-variable]
appearsIn: [timeline.tool.bash]
quiz:
  - q: `pixelweb --opencode http://x:1` 中 `--opencode` 是？
    options: [子命令, 标志/选项, 环境变量, 文件名]
    answer: 1
sources:
  - { title: "The Art of Command Line", url: https://github.com/jlevy/the-art-of-command-line }
---
## 为什么重要
agent 的 bash 调用就是在用 CLI；看懂命令你就能看懂它在干什么。

## 在 PixelWeb 里出现在哪
bash 卡片的命令行。

## 动手试试
`pixelweb --help`。
