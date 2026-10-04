import { Fragment, useEffect, useMemo, useState } from 'react';
import type { OcAssistantMessage, OcMessageWithParts, OcPart, OcPermission } from '@pixelweb/shared';
import { MarkdownView, type MarkdownRender } from '@web/components/MarkdownView';
import { cardLink } from '@web/lib/knowledge';
import type { TermMatcher } from '@web/lib/terms';
import { locateField, NO_ACCESS, targetTab, type CaptureRecord } from '../lib/chrome';
import { readPrompt, type PromptView } from '../lib/prompt';
import { sameRefs, segments } from '../lib/segments';
import { toolLine } from '../lib/tools';
import type { GuideState } from './useGuide';

/** What a reply's ⟦fN⟧ refer to: the labels from the last capture before it, and where that capture found them. */
interface RefContext {
  refs: Record<string, string>;
  record?: CaptureRecord;
}

const NO_LABEL = '（无标签）';

const textOf = (parts: OcPart[]) =>
  parts
    .filter((p): p is OcPart & { type: 'text'; text: string } => p.type === 'text' && !(p as { synthetic?: boolean }).synthetic)
    .map((p) => p.text)
    .join('\n');

/**
 * The conversation: each capture as a one-line page chip, replies as markdown
 * where ⟦fN⟧ is a tag that outlines the field on the page and knowledge terms
 * link to their card in PixelWeb.
 */
export function ThreadView({
  guide,
  root,
  origin,
  captures,
  terms,
}: {
  guide: GuideState;
  root?: string;
  origin: string;
  captures: CaptureRecord[];
  terms: TermMatcher | null;
}) {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const locate = async (ref: string, ctx: RefContext) => {
    setNotice('');
    const label = ctx.refs[ref] === NO_LABEL ? '' : (ctx.refs[ref] ?? '');
    try {
      const tab = await targetTab();
      // the recorded element only counts in the tab it was captured from
      const rec = ctx.record?.tabId === tab.id ? ctx.record : undefined;
      const at = rec?.origins[ref];
      const found = await locateField(tab.id, { stamp: rec?.stamp, index: at?.index, label }, at?.frameId);
      if (!found) setNotice(`页面上没找到「${label || ref}」：可能换了页面，或者页面变了。重新捕捉后再点。`);
    } catch {
      setNotice(NO_ACCESS);
    }
  };

  // a capture renumbers the fields: each reply's ⟦fN⟧ means the last capture before it
  let ctx: RefContext = { refs: {} };
  const turns = guide.messages.map((m) => {
    if (m.info.role === 'user') {
      const view = readPrompt(textOf(m.parts));
      if (view.page) ctx = { refs: view.refs, record: [...captures].reverse().find((r) => sameRefs(r.labels, view.refs)) };
      return <UserTurn key={m.info.id} view={view} />;
    }
    return <AssistantTurn key={m.info.id} msg={m} ctx={ctx} root={root} origin={origin} terms={terms} onLocate={locate} />;
  });
  const last = guide.messages[guide.messages.length - 1];
  const waiting = guide.busy && (!last || last.info.role === 'user' || !last.parts.some((p) => p.type === 'text' && (p as { text?: string }).text));

  return (
    <div className="thread">
      {!guide.loaded && !guide.streamError && <p className="muted">正在载入…</p>}
      {turns}
      {waiting && <div className="working">正在看页面和项目…</div>}
      {/* OpenCode keeps a request listed after the reply was stopped: only a running session is waiting on one */}
      {guide.busy && guide.permissions.map((p) => <Permission key={p.id} p={p} origin={origin} />)}
      {guide.error && <div className="banner bad">{guide.error}</div>}
      {guide.streamError && <div className="banner bad">{guide.streamError}</div>}
      {!guide.opencode && <div className="banner warn">PixelWeb 连不上 OpenCode，回答会在连上后继续。</div>}
      {notice && <div className="notice">{notice}</div>}
    </div>
  );
}

function UserTurn({ view }: { view: PromptView }) {
  const page = view.page;
  return (
    <div className="turn user">
      {page && (
        <div className="page-chip" title={page.host}>
          <span className="tag">{page.next ? '下一页' : '页面'}</span>
          {[page.vendor, page.heading || page.host].filter(Boolean).join(' · ')}
          <span className="muted"> · {page.fields} 个字段</span>
        </div>
      )}
      {view.question && <div className="bubble">{view.question}</div>}
    </div>
  );
}

function AssistantTurn({
  msg,
  ctx,
  root,
  origin,
  terms,
  onLocate,
}: {
  msg: OcMessageWithParts;
  ctx: RefContext;
  root?: string;
  origin: string;
  terms: TermMatcher | null;
  onLocate: (ref: string, ctx: RefContext) => void;
}) {
  const render = useMemo<MarkdownRender>(
    () => ({ text: (text, key) => <RichText key={key} text={text} ctx={ctx} origin={origin} terms={terms} onLocate={onLocate} /> }),
    [ctx, origin, terms, onLocate],
  );
  const error = (msg.info as OcAssistantMessage).error;
  return (
    <div className="turn assistant">
      {msg.parts.map((p) => {
        if (p.type === 'text') {
          const t = p as OcPart & { text: string; synthetic?: boolean };
          return t.text && !t.synthetic ? <MarkdownView key={p.id} text={t.text} render={render} /> : null;
        }
        if (p.type === 'tool') {
          const call = p as Extract<OcPart, { type: 'tool' }>;
          const line = toolLine(call.tool, call.state, root);
          return (
            <div key={p.id} className={`tool ${line.status}`}>
              <span className="verb">{line.verb}</span>{' '}
              {line.href ? (
                <a href={line.href} target="_blank" rel="noreferrer">
                  {line.target}
                </a>
              ) : (
                <span className="target">{line.target}</span>
              )}
              {line.status === 'error' && <span className="muted">（失败）</span>}
            </div>
          );
        }
        return null;
      })}
      {error && (error.name === 'MessageAbortedError' ? <div className="muted small">已停止</div> : <div className="banner bad">{error.data?.message || error.name}</div>)}
    </div>
  );
}

/** Reply text with each ⟦f3⟧ as a button that outlines the field, and knowledge terms as links to their card. */
function RichText({
  text,
  ctx,
  origin,
  terms,
  onLocate,
}: {
  text: string;
  ctx: RefContext;
  origin: string;
  terms: TermMatcher | null;
  onLocate: (ref: string, ctx: RefContext) => void;
}) {
  return (
    <>
      {segments(text, ctx.refs, terms).map((s, i) => {
        if (s.kind === 'text') return <Fragment key={i}>{s.text}</Fragment>;
        if (s.kind === 'term')
          return (
            <a key={i} className="term" href={cardLink(origin, s.cardId)} target="_blank" rel="noreferrer" title="在 PixelWeb 里看这个概念">
              {s.text}
            </a>
          );
        return (
          <button key={i} type="button" className="ref" title={`在页面上找到${s.label ? `「${s.label}」` : '这个字段'}`} onClick={() => onLocate(s.ref, ctx)}>
            {s.chip}
          </button>
        );
      })}
    </>
  );
}

function Permission({ p, origin }: { p: OcPermission; origin: string }) {
  const what = Array.isArray(p.pattern) ? p.pattern.join(' ') : p.pattern;
  return (
    <div className="banner warn">
      agent 想{p.type === 'bash' ? '运行命令' : `使用 ${p.type}`}
      {what && (
        <>
          ：<code>{what}</code>
        </>
      )}
      。插件里不能批准，请到{' '}
      <a href={origin} target="_blank" rel="noreferrer">
        PixelWeb
      </a>{' '}
      里批准或拒绝。
    </div>
  );
}
