import { useState } from 'react';
import type { CapturedField } from '@pixelweb/shared';
import { MASK, VENDOR_NAMES } from '@pixelweb/shared/capture';
import { abortGuide, promptGuide, startGuide, type ServerConfig } from '../lib/api';
import { captureTab, targetTab, type Thread } from '../lib/chrome';
import { finalCapture, type Draft } from '../lib/frames';

interface DraftState {
  draft: Draft;
  removed: Set<string>;
  includeText: boolean;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Capture → look it over → send. A new conversation starts from a capture;
 * after that the user can ask follow-ups, or capture the next page of a
 * multi-step wizard into the same conversation.
 */
export function Composer({
  server,
  thread,
  busy,
  onStarted,
}: {
  server: ServerConfig;
  thread: Thread | null;
  busy: boolean;
  onStarted: (t: Thread) => void;
}) {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [phase, setPhase] = useState<'idle' | 'capturing' | 'sending'>('idle');
  const [error, setError] = useState('');

  const capture = async () => {
    setError('');
    setPhase('capturing');
    try {
      const tab = await targetTab();
      setDraft({ draft: await captureTab(tab.id), removed: new Set(), includeText: true });
    } catch (e) {
      setError(message(e));
    } finally {
      setPhase('idle');
    }
  };

  const send = async () => {
    if (phase !== 'idle' || busy) return;
    const question = text.trim() || undefined;
    const page = draft ? finalCapture(draft.draft, draft.removed, draft.includeText) : undefined;
    if (!thread && !page) return setError('先捕捉一页：对话要从一个页面开始。');
    if (!page && !question) return;
    setError('');
    setPhase('sending');
    try {
      if (thread) await promptGuide(server, thread.sessionID, { capture: page, question });
      else {
        const r = await startGuide(server, { capture: page, question });
        onStarted({ sessionID: r.sessionID, title: r.title });
      }
      setText('');
      setDraft(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setPhase('idle');
    }
  };

  const stop = () => {
    if (thread) abortGuide(server, thread.sessionID).catch((e) => setError(message(e)));
  };

  const canSend = phase === 'idle' && !busy && (!!draft || (!!thread && !!text.trim()));
  const placeholder = busy ? '正在回答…' : draft ? '想问什么？不填就是「这一页该怎么填？」' : thread ? '追问，或者捕捉下一页' : '先打开看不懂的配置页，再点「捕捉这一页」';

  return (
    <footer className="composer">
      {draft && <DraftCard state={draft} onChange={setDraft} />}
      {error && <div className="banner bad">{error}</div>}
      <textarea
        value={text}
        placeholder={placeholder}
        rows={Math.min(6, Math.max(2, text.split('\n').length))}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends, Shift+Enter is a new line; Enter that picks an IME candidate does neither
          if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
          e.preventDefault();
          void send();
        }}
      />
      <div className="row">
        {draft ? (
          <button onClick={() => setDraft(null)}>取消</button>
        ) : (
          <button className={thread ? '' : 'primary'} onClick={() => void capture()} disabled={phase !== 'idle'}>
            {phase === 'capturing' ? '正在读取…' : thread ? '捕捉下一页' : '捕捉这一页'}
          </button>
        )}
        <span className="spacer" />
        {busy && thread && (
          <button className="danger" onClick={stop}>
            停止
          </button>
        )}
        {(draft || thread) && (
          <button className="primary" onClick={() => void send()} disabled={!canSend}>
            {phase === 'sending' ? '发送中…' : '发送'}
          </button>
        )}
      </div>
    </footer>
  );
}

function valueText(f: CapturedField): string {
  if (f.value === undefined) return '（未读取）';
  if (f.value === '') return '（空）';
  return f.value;
}

/** What is about to be sent, with a way to leave fields or the page text out. */
function DraftCard({ state, onChange }: { state: DraftState; onChange: (s: DraftState) => void }) {
  const c = state.draft.capture;
  const kept = c.fields.filter((f) => !state.removed.has(f.ref)).length;
  let host = '';
  try {
    host = new URL(c.url).hostname;
  } catch {
    /* no URL */
  }
  const toggle = (ref: string) => {
    const removed = new Set(state.removed);
    if (!removed.delete(ref)) removed.add(ref);
    onChange({ ...state, removed });
  };
  return (
    <div className="draft">
      <div className="draft-head">
        <strong>{[c.vendor ? VENDOR_NAMES[c.vendor] : '', c.heading || c.title || host].filter(Boolean).join(' · ')}</strong>
      </div>
      <div className="muted small">
        {kept} 个字段 · 正文 {state.includeText ? c.text.length : 0} 字{c.redactions ? ` · 已隐藏 ${c.redactions} 处敏感信息` : ''}
      </div>
      {c.fields.length === 0 && <div className="banner warn">这一页没找到表单字段，只会发送页面正文。</div>}
      <details>
        <summary>看看要发什么</summary>
        <ul className="fields">
          {c.fields.map((f) => {
            const off = state.removed.has(f.ref);
            return (
              <li key={f.ref} className={off ? 'off' : ''}>
                <span className="ref">{f.ref}</span>
                <span className="label" title={f.label}>
                  {f.label || '（无标签）'}
                </span>
                <span className={`value ${f.value === MASK ? 'masked' : ''}`} title={f.value}>
                  {valueText(f)}
                </span>
                <button className="link" onClick={() => toggle(f.ref)} title={off ? '发送这个字段' : '不发送这个字段'}>
                  {off ? '放回' : '去掉'}
                </button>
              </li>
            );
          })}
        </ul>
        <label className="check">
          <input type="checkbox" checked={state.includeText} onChange={(e) => onChange({ ...state, includeText: e.target.checked })} />
          附带页面正文（{c.text.length} 字）
        </label>
      </details>
      <p className="muted small">页面内容会经 PixelWeb 发给模型提供商；像密钥、密码的值已经换成 {MASK}。</p>
    </div>
  );
}
