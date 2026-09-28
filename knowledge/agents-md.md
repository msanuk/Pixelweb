---
id: agents-md
title: 项目指令文件
aliases: [AGENTS.md, CLAUDE.md, 项目规则]
keywords: [rules, 指令文件, /init]
category: ai
level: 1
summary: 放在仓库根目录、写给 agent 看的说明书（OpenCode 读 AGENTS.md）：怎么构建和测试、代码约定、哪里不能碰。每个会话开头自动读进上下文。
related: [system-prompt, prompt-cache, context-engineering, compaction]
appearsIn: [timeline.session]
quiz:
  - q: 下面哪条最适合写进 AGENTS.md？
    options: [今天的日期, 「跑测试用 npm test -w server，不要用 jest」, 刚才那个 bug 的报错全文, 当前 git 分支名]
    answer: 1
    why: 它是每个会话都会带上的固定开头，只放长期不变的约定；会变的东西放进去，缓存每次都会失效。
sources:
  - { title: "OpenCode: Rules", url: https://opencode.ai/docs/rules }
  - { title: "李博杰《深入理解 AI Agent》第 5 章", url: https://github.com/bojieli/ai-agent-book }
---
## 为什么重要
agent 读不到口头约定，只读得到仓库里的文字。写在这里的规则每个会话都生效，compaction 之后也不会丢。它在请求开头、内容很少变，天然适合缓存；反过来，会话中途改它，下一步缓存就要从头来。

## 在 PixelWeb 里出现在哪
会话中途 agent 改了 AGENTS.md 或 CLAUDE.md，时间线会把之后的缓存中断归因到它。

## 动手试试
在 OpenCode 里运行 `/init` 生成一份，再删掉其中一眼就能从代码里看出来的内容。
