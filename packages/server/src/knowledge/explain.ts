import type { ExplainRequest, KnowledgeCard } from '@pixelweb/shared';

/**
 * Builds the teaching prompt PixelWeb hands to a fresh OpenCode session.
 *
 * The style follows Matt Pocock's `teach` skill: ground the lesson in the
 * learner's mission (the thing they are doing right now), keep it short enough
 * for working memory, cite sources, and end with effortful retrieval — a
 * question the learner must answer, not a summary they can nod along to.
 */
export const TEACHING_SYSTEM_PROMPT = `你是 PixelWeb 内置的「边干活边学」导师。用户正在用 coding agent 做真实开发，你的任务是解释他们此刻遇到的一个概念。

教学原则（严格遵守）：
1. 先给一句话定义（≤ 30 字），再讲「为什么这里会出现它」，把概念钉在用户当下的上下文上。
2. 简短：整体不超过 250 字正文。工作记忆有限，一次只教一个概念，不要顺带教相邻概念，最多点名 1–2 个相关词供后续查询。
3. 用一个来自当前项目的具体例子（可以用只读工具查看代码 / git 历史），不要编造项目里不存在的东西。
4. 不要修改任何文件，不要执行有副作用的命令。你是导师，不是执行者。
5. 结尾必须附一个「检索练习」：一道需要用户自己作答的问题（选择题或填空），不要给答案。
6. 如有权威来源，附 1–2 个链接。
7. 用中文回答，术语保留英文原文并在首次出现时给中文。`;

export function buildExplainPrompt(req: ExplainRequest, card?: KnowledgeCard, projectRoot?: string): string {
  const lines: string[] = [];
  lines.push(`请解释概念：**${req.term}**`);
  if (projectRoot) lines.push(`\n当前项目目录：${projectRoot}`);
  if (req.context) lines.push(`\n用户此刻看到的内容 / 上下文：\n${req.context}`);
  if (card) {
    lines.push(`\nPixelWeb 已有一张基础知识卡片，请在它的基础上「往深一层」讲，不要重复它：`);
    lines.push(`- 卡片定义：${card.summary}`);
    if (card.related.length) lines.push(`- 相关概念（仅供参考，不要展开）：${card.related.join(', ')}`);
  }
  lines.push(`\n请按系统提示中的教学原则作答。`);
  return lines.join('\n');
}

/** Tools the teaching session is allowed to use: read-only. */
export const TEACHING_TOOLS: Record<string, boolean> = {
  write: false,
  edit: false,
  patch: false,
  bash: false,
  todowrite: false,
  todoread: false,
  webfetch: true,
  read: true,
  grep: true,
  glob: true,
  list: true,
};

export function teachingSessionTitle(term: string): string {
  return `📖 ${term}`;
}
