import { useMemo, useState } from 'react';
import type { CardCategory } from '@pixelweb/shared';
import { openCard, useStore } from '../lib/store';
import { masteryLabel } from '../components/CardDrawer';

const CATS: { id: CardCategory | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'ai', label: 'AI' },
  { id: 'git', label: 'Git' },
  { id: 'web', label: 'Web' },
  { id: 'tooling', label: '工具链' },
  { id: 'architecture', label: '架构' },
  { id: 'general', label: '通用' },
];

export function Knowledge() {
  const cards = useStore((s) => s.knowledge);
  const learning = useStore((s) => s.learning);
  const [cat, setCat] = useState<CardCategory | 'all'>('all');
  const [q, setQ] = useState('');
  const [onlyUnseen, setOnlyUnseen] = useState(false);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return cards.filter((c) => {
      if (cat !== 'all' && c.category !== cat) return false;
      if (onlyUnseen && learning.records[c.id]) return false;
      if (!ql) return true;
      return c.title.toLowerCase().includes(ql) || c.aliases.some((a) => a.toLowerCase().includes(ql)) || c.summary.toLowerCase().includes(ql);
    });
  }, [cards, cat, q, onlyUnseen, learning]);

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

  return (
    <div className="knowledge">
      <header className="panel-head">
        <div className="progress">
          <span>{cards.length} 张卡片</span>
          <span>看过 {stats.seen}</span>
          <span>学习中 {stats.learning}</span>
          <span>已掌握 {stats.mastered}</span>
          <span>练习 {stats.correct}/{stats.quiz}</span>
          <div className="bar">
            <i style={{ width: `${(stats.mastered / Math.max(cards.length, 1)) * 100}%` }} />
          </div>
        </div>
        <div className="actions">
          <input placeholder="搜索概念（中英文）" value={q} onChange={(e) => setQ(e.target.value)} />
          <label>
            <input type="checkbox" checked={onlyUnseen} onChange={(e) => setOnlyUnseen(e.target.checked)} /> 只看没学过的
          </label>
        </div>
      </header>
      <div className="cat-tabs">
        {CATS.map((c) => (
          <button key={c.id} className={cat === c.id ? 'active' : ''} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="card-grid">
        {list.map((c) => {
          const r = learning.records[c.id];
          return (
            <button key={c.id} className="card" onClick={() => openCard(c.id)}>
              <div className="card-top">
                <strong>{c.title}</strong>
                {cat === 'all' && <span className="muted small">{CATS.find((x) => x.id === c.category)?.label}</span>}
                <span className="chip">L{c.level}</span>
                {r && <span className={`chip mastery-${r.mastery}`}>{masteryLabel(r.mastery)}</span>}
              </div>
              <p>{c.summary}</p>
              {c.aliases.length > 0 && <small className="muted">{c.aliases.slice(0, 4).join(' · ')}</small>}
            </button>
          );
        })}
        {list.length === 0 && <p className="muted">没有匹配的卡片。可以在 knowledge/ 目录新增一张。</p>}
      </div>
    </div>
  );
}
