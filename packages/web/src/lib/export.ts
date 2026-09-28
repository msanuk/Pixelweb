import type { KnowledgeIndexEntry, LearningRecord, LearningState, MasteryLevel } from '@pixelweb/shared';

const CATEGORY: Record<string, string> = { ai: 'AI', git: 'Git', web: 'Web', tooling: '工具链', architecture: '架构', general: '通用' };
const SECTIONS: { mastery: MasteryLevel; title: string }[] = [
  { mastery: 'learning', title: '学习中' },
  { mastery: 'seen', title: '看过' },
  { mastery: 'mastered', title: '已掌握' },
];

function day(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Keeps a note's own Markdown intact but stops a stray "# " from breaking the outline. */
function indentHeadings(notes: string): string {
  return notes.replace(/^(#{1,6})\s/gm, '###$1 ');
}

/**
 * Everything the learner has touched, as a Markdown document: grouped by
 * mastery (still learning first), each card with its definition, practice
 * record and the learner's own notes.
 */
export function learningMarkdown(cards: KnowledgeIndexEntry[], learning: LearningState, meta: { project?: string; now: number }): string {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const records = Object.values(learning.records);
  const quizTotal = records.reduce((a, r) => a + r.quizTotal, 0);
  const quizCorrect = records.reduce((a, r) => a + r.quizCorrect, 0);
  const count = (m: MasteryLevel) => records.filter((r) => r.mastery === m).length;

  const out: string[] = [];
  out.push('# PixelWeb 学习笔记', '');
  out.push(`导出于 ${day(meta.now)}${meta.project ? ` · 项目 ${meta.project}` : ''}`, '');
  out.push(
    `看过 ${records.length} / ${cards.length} 张卡片 · 学习中 ${count('learning')} · 已掌握 ${count('mastered')}` +
      (quizTotal ? ` · 练习正确 ${quizCorrect}/${quizTotal}` : ''),
  );
  if (records.length === 0) {
    out.push('', '还没有学习记录：在 PixelWeb 里点开概念卡片就会开始记录。');
    return out.join('\n') + '\n';
  }

  for (const { mastery, title } of SECTIONS) {
    const recs = records
      .filter((r) => r.mastery === mastery)
      // notes first (they're the point of an export), then most recently seen
      .sort((a, b) => Number(!!b.notes?.trim()) - Number(!!a.notes?.trim()) || b.lastSeen - a.lastSeen);
    if (!recs.length) continue;
    out.push('', `## ${title}（${recs.length}）`);
    for (const r of recs) out.push('', ...cardBlock(r, byId.get(r.cardId)));
  }
  return out.join('\n') + '\n';
}

function cardBlock(r: LearningRecord, card: KnowledgeIndexEntry | undefined): string[] {
  const lines = [`### ${card?.title ?? r.cardId}`];
  if (card?.summary) lines.push('', `> ${card.summary}`);
  const facts = [
    card ? `${CATEGORY[card.category] ?? card.category} · L${card.level}` : null,
    `看过 ${r.seenCount} 次`,
    r.lastSeen ? `最近 ${day(r.lastSeen)}` : null,
    r.quizTotal ? `练习 ${r.quizCorrect}/${r.quizTotal}` : null,
  ].filter(Boolean);
  lines.push('', facts.join(' · '));
  if (r.notes?.trim()) lines.push('', '**我的笔记**', '', indentHeadings(r.notes.trim()));
  return lines;
}

/** Offers a text file to the browser as a download. */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportFilename(now: number): string {
  return `pixelweb-notes-${day(now)}.md`;
}
