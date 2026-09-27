import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { openCard, useStore } from '../lib/store';
import { masteryLabel } from '../components/CardDrawer';
import { Icon } from '../components/Icon';
import { downloadText, exportFilename, learningMarkdown } from '../lib/export';
import {
  CATEGORIES,
  MASTERY_FILTERS,
  categoryLabel,
  facetCounts,
  filterCards,
  stepSelection,
  type CategoryFilter,
  type MasteryFilter,
} from '../lib/knowledge';

export function Knowledge() {
  const cards = useStore((s) => s.knowledge);
  const learning = useStore((s) => s.learning);
  const openId = useStore((s) => s.openCard);
  const [cat, setCat] = useState<CategoryFilter>('all');
  const [mastery, setMastery] = useState<MasteryFilter>('all');
  const [q, setQ] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const project = useStore((s) => s.server?.projectRoot.split(/[\\/]/).filter(Boolean).pop());
  const noteCount = useMemo(() => Object.values(learning.records).filter((r) => r.notes?.trim()).length, [learning]);

  const list = useMemo(() => filterCards(cards, { cat, mastery, q }, learning.records, openId), [cards, cat, mastery, q, learning, openId]);
  const counts = useMemo(() => facetCounts(cards, { cat, mastery, q }, learning.records), [cards, cat, mastery, q, learning]);

  const stats = useMemo(() => {
    const recs = Object.values(learning.records);
    return {
      seen: recs.length,
      mastered: recs.filter((r) => r.mastery === 'mastered').length,
      learning: recs.filter((r) => r.mastery === 'learning').length,
      quiz: recs.reduce((a, r) => a + r.quizTotal, 0),
      correct: recs.reduce((a, r) => a + r.quizCorrect, 0),
    };
  }, [learning]);

  // keep the open card's row visible, however it was opened
  useEffect(() => {
    if (!openId) return;
    listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(openId)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [openId, list]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const i = stepSelection(
      list.map((c) => c.id),
      openId,
      e.key === 'ArrowDown' ? 1 : -1,
    );
    if (i < 0) return;
    e.preventDefault();
    openCard(list[i].id);
    // moving through the rows moves focus with the selection; in the search box focus stays put
    if (listRef.current?.contains(e.target as Node)) listRef.current.querySelector<HTMLElement>(`[data-id="${CSS.escape(list[i].id)}"]`)?.focus();
  };

  const exportNotes = () => {
    const now = Date.now();
    downloadText(exportFilename(now), learningMarkdown(cards, learning, { project, now }));
  };

  return (
    <div className="knowledge">
      <aside className="kn-side">
        <section>
          <h4>分类</h4>
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`kn-facet ${cat === c.id ? 'selected' : ''}`} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
              <span>{c.label}</span>
              <span className="count">{counts.cat[c.id]}</span>
            </button>
          ))}
        </section>
        <section>
          <h4>掌握程度</h4>
          {MASTERY_FILTERS.map((m) => (
            <button key={m.id} className={`kn-facet ${mastery === m.id ? 'selected' : ''}`} aria-pressed={mastery === m.id} onClick={() => setMastery(m.id)}>
              <span>{m.label}</span>
              <span className="count">{counts.mastery[m.id]}</span>
            </button>
          ))}
        </section>
        <section className="kn-progress">
          <h4>进度</h4>
          <div className="bar" title={`已掌握 ${stats.mastered} / ${cards.length}`}>
            <i style={{ width: `${(stats.mastered / Math.max(cards.length, 1)) * 100}%` }} />
          </div>
          <p className="muted small">
            {cards.length} 张卡片 · 看过 {stats.seen}
            <br />
            学习中 {stats.learning} · 已掌握 {stats.mastered}
            <br />
            练习 {stats.correct}/{stats.quiz}
          </p>
          <button
            onClick={exportNotes}
            disabled={stats.seen === 0}
            title={stats.seen === 0 ? '还没有学习记录' : `导出 ${stats.seen} 张卡片的学习记录${noteCount ? `和 ${noteCount} 条笔记` : ''}`}
          >
            导出笔记
          </button>
        </section>
      </aside>

      <div className="kn-main">
        <header className="panel-head kn-head">
          <div className="search">
            <Icon name="search" size={14} />
            <input
              placeholder="搜索概念（中英文）"
              aria-label="搜索知识卡片"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && list[0]) openCard(list[0].id);
                else onKey(e);
              }}
            />
          </div>
          <span className="muted small">{list.length} 张</span>
        </header>
        <div className="kn-list" ref={listRef} onKeyDown={onKey}>
          {list.map((c) => {
            const r = learning.records[c.id];
            return (
              <button key={c.id} data-id={c.id} className={`kn-row ${openId === c.id ? 'selected' : ''}`} aria-current={openId === c.id || undefined} onClick={() => openCard(c.id)}>
                <span className="kn-row-top">
                  <strong>{c.title}</strong>
                  <span className="chip">L{c.level}</span>
                  {r && <span className={`chip mastery-${r.mastery}`}>{masteryLabel(r.mastery)}</span>}
                </span>
                <span className="kn-row-sub">
                  {cat === 'all' && <span className="kn-cat">{categoryLabel(c.category)}</span>}
                  {c.summary}
                </span>
              </button>
            );
          })}
          {list.length === 0 && <p className="muted kn-empty">没有匹配的卡片。可以在 knowledge/ 目录新增一张。</p>}
        </div>
      </div>

      {!openId && (
        <aside className="drawer kn-placeholder">
          <div className="drawer-head">
            <strong>知识卡片</strong>
          </div>
          <div className="drawer-body">
            <p className="muted">选择左侧列表里的一张卡片查看定义、练习和笔记。</p>
            <p className="muted small">在列表或搜索框里用 ↑ / ↓ 切换卡片，搜索框里按 Enter 打开第一条结果。</p>
            <dl>
              <dt>卡片</dt>
              <dd>{cards.length}</dd>
              <dt>看过</dt>
              <dd>{stats.seen}</dd>
              <dt>学习中</dt>
              <dd>{stats.learning}</dd>
              <dt>已掌握</dt>
              <dd>{stats.mastered}</dd>
              <dt>练习</dt>
              <dd>
                {stats.correct}/{stats.quiz}
              </dd>
              <dt>笔记</dt>
              <dd>{noteCount}</dd>
            </dl>
          </div>
        </aside>
      )}
    </div>
  );
}
