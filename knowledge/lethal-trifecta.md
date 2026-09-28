---
id: lethal-trifecta
title: 致命三要素
aliases: [lethal trifecta]
keywords: [数据外泄, 攻击面]
category: ai
level: 2
summary: agent 同时能读私有数据、会接触不可信内容、又能向外发消息，三样凑齐，一次提示注入就能把数据偷出去。
related: [prompt-injection, sandbox, permission, mcp]
appearsIn: [timeline.permission]
quiz:
  - q: 三要素里拿掉哪一样，就能切断「读到数据再发出去」这条路？
    options: [任意一样都行, 只能拿掉私有数据, 只能拿掉不可信内容, 三样都得拿掉]
    answer: 0
    why: 攻击要三步走完：注入进来、读到数据、传出去。缺一步就走不通。
sources:
  - { title: "Simon Willison: The lethal trifecta for AI agents", url: https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ }
  - { title: "李博杰《深入理解 AI Agent》第 5 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
coding agent 默认三样都有：能读整个仓库（包括里面的密钥和配置），会 webfetch 网页、读别人的代码，能用 bash 跑 `curl`。书里补了第四点：持久记忆会让注入跨会话潜伏下来，比如被人塞进 AGENTS.md 的一句话。

## 在 PixelWeb 里出现在哪
权限横幅是拦住「往外发」的那道闸，前提是 bash、webfetch 设成了 `ask`（OpenCode 默认直接放行）。agent 刚读过网页或陌生仓库，紧接着申请联网命令，要格外小心。

## 动手试试
看看 OpenCode 的权限配置：哪些命令会自动放行，其中有没有能联网的。
