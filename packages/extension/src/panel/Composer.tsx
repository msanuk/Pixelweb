import { useEffect, useRef, useState } from 'react';
import type { CapturedField, GuideModel } from '@pixelweb/shared';
import { MASK, VENDOR_NAMES } from '@pixelweb/shared/capture';
import { abortGuide, promptGuide, startGuide, type ServerConfig } from '../lib/api';
import { addCapture, allowOrigins, captureTab, takeCaptureRequest, targetTab, watchCaptureRequests, type Thread } from '../lib/chrome';
import { finalCapture, type Draft, type SendOptions } from '../lib/frames';
import { screenshotTab, sizeText, type Shot } from '../lib/screenshot';

interface DraftState extends SendOptions {
  draft: Draft;
  /** the tab it was read from, so a reply's ⟦fN⟧ can find the field there later */
  tabId: number;
  /** the screenshot the user chose to send along; off by default, for every capture */
  shot?: Shot;
  shooting?: boolean;
  shotError?: string;
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
  windowId,
  model,
  onStarted,
}: {
  server: ServerConfig;
  thread: Thread | null;
  busy: boolean;
  windowId?: number;
  /** what the answer will run on, to tell whether a screenshot is any use */
  model?: GuideModel | null;
  onStarted: (t: Thread) => void;
}) {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [phase, setPhase] = useState<'idle' | 'capturing' | 'sending'>('idle');
  const [error, setError] = useState('');

  /** `tabId`: a tab the right-click menu named; `selectionOnly`: start with only the selection ticked */
  const capture = async (tabId?: number, selectionOnly = false) => {
    setError('');
    setPhase('capturing');
    try {
      const id = tabId ?? (await targetTab()).id;
      const d = await captureTab(id);
      setDraft({ draft: d, tabId: id, removed: new Set(), includeText: true, selectionOnly: selectionOnly && !!d.capture.selection });
    } catch (e) {
      setError(message(e));
    } finally {
      setPhase('idle');
    }
  };

  // the right-click menu: a request may be waiting from before this panel opened, or arrive while it is open
  const latest = useRef(capture);
  latest.current = capture;
  useEffect(() => {
    if (windowId === undefined) return;
    const take = () =>
      void takeCaptureRequest(windowId).then((req) => {
        if (req) void latest.current(req.tabId, req.selection);
      });
    take();
    return watchCaptureRequests(windowId, take);
  }, [windowId]);

  // iframes from sites the extension may not read: ask Chrome for them, then read the page again
  const allowFrames = async (state: DraftState) => {
    try {
      if (await allowOrigins(state.draft.unread)) await capture(state.tabId, state.selectionOnly);
    } catch (e) {
      setError(message(e));
    }
  };

  const toggleShot = async (on: boolean) => {
    if (!draft) return;
    if (!on) return setDraft({ ...draft, shot: undefined, shotError: undefined });
    setDraft({ ...draft, shooting: true, shotError: undefined });
    try {
      const shot = await screenshotTab(draft.tabId);
      setDraft((d) => d && { ...d, shot, shooting: false });
    } catch (e) {
      setDraft((d) => d && { ...d, shooting: false, shotError: message(e) });
    }
  };

  const send = async () => {
    if (phase !== 'idle' || busy) return;
    const question = text.trim() || undefined;
    const page = draft ? finalCapture(draft.draft, draft) : undefined;
    if (!thread && !page) return setError('先捕捉一页：对话要从一个页面开始。');
    if (!page && !question) return;
    const screenshot = page && model?.image !== false ? draft?.shot?.url : undefined;
    setError('');
    setPhase('sending');
    try {
      let sessionID = thread?.sessionID;
      if (sessionID) await promptGuide(server, sessionID, { capture: page, question, screenshot });
      else {
        const r = await startGuide(server, { capture: page, question, screenshot });
        sessionID = r.sessionID;
        onStarted({ sessionID: r.sessionID, title: r.title });
      }
      if (page && draft) {
        // where each sent field was, under the label the prompt shows for it
        const labels = Object.fromEntries(page.fields.map((f) => [f.ref, f.label || '（无标签）']));
        const origins = Object.fromEntries(page.fields.map((f) => [f.ref, draft.draft.origins[f.ref]]));
        await addCapture(sessionID, { tabId: draft.tabId, stamp: page.capturedAt, origins, labels });
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
      {draft && (
        <DraftCard
          state={draft}
          model={model}
          onChange={setDraft}
          onAllowFrames={() => void allowFrames(draft)}
          onShot={(on) => void toggleShot(on)}
        />
      )}
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

const hostOf = (origin: string) => {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
};

/** What is about to be sent, with a way to leave fields or the page text out, or add a screenshot. */
function DraftCard({
  state,
  model,
  onChange,
  onAllowFrames,
  onShot,
}: {
  state: DraftState;
  model?: GuideModel | null;
  onChange: (s: DraftState) => void;
  onAllowFrames: () => void;
  onShot: (on: boolean) => void;
}) {
  const c = state.draft.capture;
  const { unread, hints } = state.draft;
  const blind = model?.image === false;
  const sent = finalCapture(state.draft, state);
  const inSelection = new Set(state.draft.selected);
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
        {sent.fields.length} 个字段 · {state.selectionOnly ? `选中的文字 ${c.selection?.length ?? 0} 字` : `正文 ${sent.text.length} 字`}
        {c.redactions ? ` · 已隐藏 ${c.redactions} 处敏感信息` : ''}
        {state.shot ? ` · 截图 ${sizeText(state.shot.url)}` : ''}
      </div>
      {c.selection && (
        <label className="check">
          <input type="checkbox" checked={state.selectionOnly} onChange={(e) => onChange({ ...state, selectionOnly: e.target.checked })} />
          只发选中的部分（{inSelection.size} 个字段、{c.selection.length} 字）
        </label>
      )}
      {unread.length > 0 && (
        <div className="banner warn">
          页面里嵌着 {unread.map(hostOf).join('、')} 的内容，插件没有权限读，这次没包含。{' '}
          <button className="link" onClick={onAllowFrames}>
            允许读取并重新捕捉
          </button>
        </div>
      )}
      {c.fields.length === 0 && <div className="banner warn">这一页没找到表单字段，只会发送页面正文。</div>}
      <details>
        <summary>看看要发什么</summary>
        <ul className="fields">
          {c.fields.map((f) => {
            if (state.selectionOnly && !inSelection.has(f.ref)) return null;
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
        {!state.selectionOnly && (
          <label className="check">
            <input type="checkbox" checked={state.includeText} onChange={(e) => onChange({ ...state, includeText: e.target.checked })} />
            附带页面正文（{c.text.length} 字）
          </label>
        )}
      </details>
      <label className="check" title={blind ? `当前模型 ${model?.name} 看不了图片` : undefined}>
        <input type="checkbox" checked={!!state.shot || !!state.shooting} disabled={blind || state.shooting} onChange={(e) => onShot(e.target.checked)} />
        {state.shooting ? '正在截图…' : '附带截图（当前看得到的这一屏）'}
      </label>
      {blind && <p className="muted small">当前模型 {model?.name} 看不了图片，截图发了也没用。</p>}
      {state.shotError && <div className="banner bad">{state.shotError}</div>}
      {state.shot && <img className="shot" src={state.shot.url} alt="要发送的截图" />}
      {hints.map((h) => (
        <p key={h} className="muted small">
          {h}
        </p>
      ))}
      <p className="muted small">
        页面内容会经 PixelWeb 发给模型提供商；像密钥、密码的值已经换成 {MASK}。{state.shot ? '截图原样发送，没法隐藏，发之前看一眼。' : ''}
      </p>
    </div>
  );
}
