---
id: doom-loop
title: Doom Loop
aliases: [doom_loop, 死循环检测, 熔断器, circuit breaker]
keywords: [原地打转, 重复调用, 无限循环]
category: ai
level: 2
summary: agent 原地打转：拿同样的参数反复调用同一个工具，没有进展。OpenCode 发现连续 3 次一模一样的调用，会停下来问你要不要继续。
related: [permission, react-loop, harness, tool-call]
appearsIn: [timeline.permission]
quiz:
  - q: OpenCode 什么时候会发 doom_loop 权限请求？
    options: [工具连续失败 3 次, 同一个工具、参数完全相同，连续调用 3 次, 会话超过 100 步, 用户 3 分钟没回复]
    answer: 1
  - q: 遇到这种请求，通常该怎么处理？
    options: [总是允许，让它自己想办法, 拒绝，然后告诉它换个思路或补上缺的信息, 重启 opencode serve, 换一个模型接着跑]
    answer: 1
    why: 同样的输入重试多少次都是同样的结果，得改变输入或策略。
sources:
  - { title: "OpenCode: Permissions", url: https://opencode.ai/docs/permissions }
  - { title: "李博杰《深入理解 AI Agent》第 5 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
打转的 agent 每一圈都在花钱，却不会自己停。常见原因：工具一直报同一个错、看不到上一次的结果、任务本身做不到。书里提到 Claude Code 的压缩重试：有一个会话连续失败了三千多次，后来加了「连续失败 3 次就放弃」的熔断。

## 在 PixelWeb 里出现在哪
权限横幅里类型为 `doom_loop` 的请求，后面跟着那个工具名。往上翻，能看到连着三次一样的调用。

## 动手试试
拒绝之后，用一句话告诉 agent 你看到的问题（比如「这个测试需要先启动数据库」），看它下一步有没有换方向。
