---
id: tool-bash
title: bash 工具
aliases: [bash, shell 命令, 终端命令]
category: ai
level: 1
summary: agent 通过它执行任意 shell 命令：装依赖、跑测试、git 操作。副作用最大，权限也最严。
related: [tool-call, permission, cli, sandbox, doom-loop]
appearsIn: [timeline.tool.bash]
quiz:
  - q: 下面哪个动作最可能需要你在 OpenCode 里确认权限？
    options: [读一个文件, 搜索关键字, 执行 rm -rf, 列出目录]
    answer: 2
sources:
  - { title: "OpenCode tools", url: https://opencode.ai/docs/tools }
  - { title: "李博杰《深入理解 AI Agent》第 5 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
一切「真的发生了什么」都在这里：测试到底过没过、依赖装了没。输出超过 2000 行或 50 KB 时，OpenCode 只截一段放进上下文，全文另存成文件，提示 agent 需要时再去 grep，没截进来的部分它其实没看到。按关键字拦截危险命令也拦不住：`find / -exec rm {} \;` 里没有以 `rm` 开头的命令，照样能删文件。

## 在 PixelWeb 里出现在哪
时间线 `bash` 卡片，展开可见命令和输出。

## 动手试试
找一次跑测试的 bash 调用，确认输出里的通过数与 agent 声称的一致。
