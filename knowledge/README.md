# 知识卡片（Knowledge Cards）

每个 `.md` 文件是一张卡片，供 PixelWeb 在界面里「点一下就能看懂」。卡片不限于 AI 概念，也覆盖 Git、Web、工具链、架构等在开发中会碰到的专有名词。

设计原则来自 Matt Pocock 的 `teach` skill：
- **简短**：`summary` 一句话，正文 ≤ 200 字，尊重工作记忆。
- **钉在任务上**：`appearsIn` 声明它在 PixelWeb 的哪个位置出现，界面据此把概念挂到对应元素上。
- **检索练习**：`quiz` 至少一题，选项长度尽量一致，避免暴露答案。
- **引用来源**：`sources` 给权威链接。

## Frontmatter 字段

```yaml
id: webhook            # 唯一 id（文件名即默认 id）
title: Webhook
aliases: [web hook]    # 触发高亮的别名（中英皆可），要足够专指
keywords: [回调]        # 只用于搜索、不高亮的近义词（太常见的词放这里，如「请求」「API」）
category: web          # ai | git | web | tooling | architecture | cloud | general
level: 1               # 1 基础 · 2 进阶 · 3 深入
summary: 一句话定义
related: [sse, websocket]
appearsIn: [timeline.tool.webfetch]
quiz:
  - q: 问题
    options: [A, B, C, D]
    answer: 1          # 0-based
    why: 解释
sources:
  - { title: MDN, url: https://... }
```

正文建议结构：`## 为什么重要` / `## 在 PixelWeb 里出现在哪` / `## 动手试试`。

## 扩展

- 用户级卡片放在 `~/.pixelweb/knowledge/`
- 项目级卡片放在 `<项目>/.pixelweb/knowledge/`
- 同 id 时后加载的覆盖先加载的。改完调 `POST /api/knowledge/reload` 或重启即可。
