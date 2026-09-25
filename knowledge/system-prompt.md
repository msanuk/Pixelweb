---
id: system-prompt
title: System Prompt
aliases: [系统提示, 系统提示词, system message]
category: ai
level: 1
summary: 放在对话最前面、优先级最高的指令，定义模型的角色、规则和风格。
related: [prompt, context-window, agent]
appearsIn: [timeline.session, knowledge.explain]
quiz:
  - q: PixelWeb 的「深入解释」会话与普通会话的差别主要来自？
    options: [模型不同, 系统提示与工具白名单不同, 端口不同, 标题不同]
    answer: 1
sources:
  - { title: "Anthropic: System prompts", url: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/system-prompts }
---
## 为什么重要
同一个模型，换一套 system prompt 就从「执行者」变成「导师」。PixelWeb 的教学会话正是这么做的。

## 在 PixelWeb 里出现在哪
点「深入解释」时，服务端给新 session 附上教学系统提示，并关闭写文件等工具。

## 动手试试
读一读 `packages/server/src/knowledge/explain.ts` 里的系统提示。
