import { useEffect, useRef, useState } from 'react';
import type { KnowledgeCard } from '@pixelweb/shared';
import { api } from '../lib/api';
import { categoryLabel } from '../lib/knowledge';
import { explain, openCard, setState, toast, useStore } from '../lib/store';
import { Markdown } from './Markdown';
import { Icon } from './Icon';

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
              <span className="chip">{categoryLabel(card.category)}</span>
              <span className="chip">L{card.level}</span>
              {record && <span className={`chip mastery-${record.mastery}`}>{masteryLabel(record.mastery)}</span>}
            </>
          )}
        </div>
        <button className="icon-btn" onClick={() => openCard(null)} title="关闭 (Esc)" aria-label="关闭卡片">
          <Icon name="close" />
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

          <Notes cardId={card.id} initial={record?.notes ?? ''} />

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
              {busy ? '正在开启…' : '让 OpenCode 结合项目深入解释'}
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

/** Free-form notes on a card, saved as you type (and on blur); exported from the knowledge page. */
function Notes({ cardId, initial }: { cardId: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [state, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saved = useRef(initial);
  const latest = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // a different card: start from its saved notes (not on every broadcast, which would clobber the textarea mid-typing).
  // Leaving a card (switching, Esc, close) flushes an unsaved edit, since no blur fires then.
  useEffect(() => {
    setText(initial);
    saved.current = latest.current = initial;
    setSaveState('idle');
    return () => {
      clearTimeout(timer.current);
      if (latest.current !== saved.current) void api.notes(cardId, latest.current).then((learning) => setState({ learning })).catch(() => {});
    };
  }, [cardId]);

  const save = async (value: string) => {
    clearTimeout(timer.current);
    if (value === saved.current) return;
    setSaveState('saving');
    try {
      const learning = await api.notes(cardId, value);
      saved.current = value;
      setState({ learning });
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      toast(`笔记没保存上：${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <section className="notes">
      <h4>
        我的笔记
        <span className="muted small">{state === 'saving' ? ' 保存中…' : state === 'saved' ? ' 已保存' : state === 'error' ? ' 保存失败' : ''}</span>
      </h4>
      <textarea
        value={text}
        placeholder="用自己的话写下它是什么、在这个项目里哪里见到过……"
        rows={Math.min(12, Math.max(3, text.split('\n').length + 1))}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          latest.current = v;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => void save(v), 800);
        }}
        onBlur={() => void save(text)}
      />
    </section>
  );
}

export function masteryLabel(m: string): string {
  return m === 'mastered' ? '已掌握' : m === 'learning' ? '学习中' : '看过';
}
