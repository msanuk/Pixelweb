---
id: agent-skills
title: Agent Skills
aliases: [SKILL.md, 渐进式披露, progressive disclosure]
keywords: [skill, 技能, 按需加载]
category: ai
level: 2
summary: 把某类任务的做法写成一个 SKILL.md。平时 agent 只看到它的名字和一句描述，用得上时才把全文读进来。
related: [system-prompt, tool-call, prompt-cache, mcp, context-engineering]
appearsIn: [timeline.tool.skill]
quiz:
  - q: 为什么 skill 平时只露出名字和描述？
    options: [怕模型看不懂全文, 全部塞进上下文太占地方，也会分散注意力, 全文是加密的, 只有付费模型能读全文]
    answer: 1
  - q: skill 的 description 怎么写最管用？
    options: [尽量宽泛，什么都能触发, 写清楚什么时候该用、什么时候不该用, 只写它能做什么, 越长越好]
    answer: 1
    why: 模型拿 description 决定要不要加载。只写能力、不写边界，就会在不相关的任务上误触发。
sources:
  - { title: "OpenCode: Agent Skills", url: https://opencode.ai/docs/skills }
  - { title: "Anthropic: Equipping agents for the real world with Agent Skills", url: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills }
  - { title: "李博杰《深入理解 AI Agent》第 2 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
能力一多，全写进系统提示既浪费 token 又稀释注意力。OpenCode 从 `.opencode/skills/<名字>/SKILL.md` 等目录找 skill，清单（名字 + 描述）每次请求都带着，全文等模型调用 `skill` 工具时才作为工具结果进入上下文。所以增删 skill、改描述会改动请求开头，缓存要重建；加载一个 skill 只在末尾追加，不影响缓存。

## 在 PixelWeb 里出现在哪
时间线里的 `skill` 工具调用，标题是 `Loaded skill: <名字>`，展开能看到读进来的全文。

## 动手试试
写一个只有十行的 SKILL.md，description 里写明何时用、何时不用，看 agent 会不会在该用的时候自己加载它。
