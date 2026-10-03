import { Fragment, useMemo } from 'react';
import type { OcAssistantMessage, OcMessageWithParts, OcPart, OcPermission } from '@pixelweb/shared';
import { MarkdownView, type MarkdownRender } from '@web/components/MarkdownView';
import { readPrompt, refChip, type PromptView } from '../lib/prompt';
import { toolLine } from '../lib/tools';
import type { GuideState } from './useGuide';

const textOf = (parts: OcPart[]) =>
  parts
    .filter((p): p is OcPart & { type: 'text'; text: string } => p.type === 'text' && !(p as { synthetic?: boolean }).synthetic)
    .map((p) => p.text)
    .join('\n');

/** The conversation: each capture as a one-line page chip, replies as markdown with ⟦fN⟧ as field tags. */
export function ThreadView({ guide, root, origin }: { guide: GuideState; root?: string; origin: string }) {
  // a capture renumbers the fields: each reply's ⟦fN⟧ means the last capture before it
  let refs: Record<string, string> = {};
  const turns = guide.messages.map((m) => {
    if (m.info.role === 'user') {
      const view = readPrompt(textOf(m.parts));
      if (view.page) refs = view.refs;
      return <UserTurn key={m.info.id} view={view} />;
    }
    return <AssistantTurn key={m.info.id} msg={m} refs={refs} root={root} />;
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

function AssistantTurn({ msg, refs, root }: { msg: OcMessageWithParts; refs: Record<string, string>; root?: string }) {
  const render = useMemo<MarkdownRender>(() => ({ text: (text, key) => <RefText key={key} text={text} refs={refs} /> }), [refs]);
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

/** Text with each ⟦f3⟧ as a tag. */
function RefText({ text, refs }: { text: string; refs: Record<string, string> }) {
  if (!text.includes('⟦')) return <>{text}</>;
  const parts = text.split(/⟦(f\d+)⟧/);
  return (
    <>
      {parts.map((s, i) =>
        i % 2 === 0 ? (
          <Fragment key={i}>{s}</Fragment>
        ) : (
          <span key={i} className="ref" title={refs[s] ? `页面上的「${refs[s]}」` : '页面上的字段'}>
            {refChip(s, refs[s], parts[i + 1] ?? '')}
          </span>
        ),
      )}
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
