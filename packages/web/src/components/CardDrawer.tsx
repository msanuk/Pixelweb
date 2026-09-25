import { useEffect, useState } from 'react';
import type { KnowledgeCard } from '@pixelweb/shared';
import { api } from '../lib/api';
import { explain, openCard, setState, useStore } from '../lib/store';
import { Markdown } from './Markdown';

const CATEGORY_LABEL: Record<string, string> = {
  ai: 'AI',
  git: 'Git',
  web: 'Web',
  tooling: '工具链',
  architecture: '架构',
  general: '通用',
};

export function CardDrawer() {
  const id = useStore((s) => s.openCard);
  const context = useStore((s) => s.explainContext);
  const record = useStore((s) => (id ? s.learning.records[id] : undefined));
  const [card, setCard] = useState<KnowledgeCard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCard(null);
    setErr(null);
    setAnswers({});
    if (!id) return;
    api
      .card(id)
      .then(setCard)
      .catch((e) => setErr(e.message));
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && openCard(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!id) return null;

  const answer = (qi: number, oi: number) => {
    if (!card || answers[qi] !== undefined) return;
    setAnswers({ ...answers, [qi]: oi });
    void api.quiz(card.id, card.quiz[qi].answer === oi).then((learning) => setState({ learning }));
  };

  return (
    <aside className="drawer" role="dialog" aria-label="概念卡片">
      <div className="drawer-head">
        <div>
          {card && (
            <>
              <span className={`chip cat-${card.category}`}>{CATEGORY_LABEL[card.category]}</span>
              <span className="chip">L{card.level}</span>
              {record && <span className={`chip mastery-${record.mastery}`}>{masteryLabel(record.mastery)}</span>}
            </>
          )}
        </div>
        <button className="icon-btn" onClick={() => openCard(null)} title="关闭 (Esc)">
          ✕
        </button>
      </div>
      {err && <p className="error">找不到卡片：{err}</p>}
      {card && (
        <div className="drawer-body">
          <h2>{card.title}</h2>
          {card.aliases.length > 0 && <p className="aliases">{card.aliases.join(' · ')}</p>}
          <p className="summary">{card.summary}</p>
          <Markdown text={card.body} />

          {card.quiz.length > 0 && (
            <section className="quiz">
              <h4>检索练习</h4>
              {card.quiz.map((q, qi) => (
                <div key={qi} className="quiz-item">
                  <p>{q.q}</p>
                  <div className="quiz-options">
                    {q.options.map((o, oi) => {
                      const picked = answers[qi];
                      const cls =
                        picked === undefined ? '' : oi === q.answer ? 'correct' : picked === oi ? 'wrong' : 'dim';
                      return (
                        <button key={oi} className={`quiz-opt ${cls}`} onClick={() => answer(qi, oi)} disabled={picked !== undefined}>
                          {o}
                        </button>
                      );
                    })}
                  </div>
                  {answers[qi] !== undefined && q.why && <p className="why">{q.why}</p>}
                </div>
              ))}
            </section>
          )}

          {card.related.length > 0 && (
            <section>
              <h4>相关概念</h4>
              <div className="chips">
                {card.related.map((r) => (
                  <button key={r} className="chip link" onClick={() => openCard(r, context ?? undefined)}>
                    {r}
                  </button>
                ))}
              </div>
            </section>
          )}

          {card.sources.length > 0 && (
            <section>
              <h4>来源</h4>
              <ul className="sources">
                {card.sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="drawer-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await explain(card.title, context ?? undefined, card.id);
                setBusy(false);
              }}
              title="开一个只读的 OpenCode 教学会话，结合当前项目深入讲解"
            >
              {busy ? '正在开启…' : '📖 让 OpenCode 结合项目深入解释'}
            </button>
            <div className="mastery-row">
              <span>我的掌握度：</span>
              {(['seen', 'learning', 'mastered'] as const).map((m) => (
                <button
                  key={m}
                  className={`chip ${record?.mastery === m ? 'active' : ''}`}
                  onClick={() => void api.mastery(card.id, m).then((learning) => setState({ learning }))}
                >
                  {masteryLabel(m)}
                </button>
              ))}
            </div>
            {context && (
              <details className="ctx">
                <summary>触发上下文</summary>
                <pre>{context}</pre>
              </details>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}

export function masteryLabel(m: string): string {
  return m === 'mastered' ? '已掌握' : m === 'learning' ? '学习中' : '看过';
}
