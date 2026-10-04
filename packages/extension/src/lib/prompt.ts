/**
 * Reads back a guide prompt (built by the server's buildGuidePrompt in
 * server/src/ext/prompt.ts) for display: the user's question, a one-line
 * description of the captured page instead of the whole <page-data> dump, and
 * which field each ⟦fN⟧ in the next reply means. The prompt text is the only
 * record of a capture that survives closing the panel, so this parses it
 * rather than keeping a copy.
 */
export interface PromptView {
  question: string;
  page?: { vendor?: string; heading?: string; host?: string; fields: number; next: boolean };
  /** ref → field label */
  refs: Record<string, string>;
}

const FIELD = /^- ⟦(f\d+)⟧ (.*?)（[^（）]*）当前值：/;

export function readPrompt(text: string): PromptView {
  const open = text.indexOf('<page-data>');
  if (open < 0) return { question: text.trim(), refs: {} };
  const head = text.slice(0, open);
  const close = text.indexOf('</page-data>', open);
  const body = text.slice(open + '<page-data>'.length, close < 0 ? undefined : close);

  const line = (re: RegExp, s: string) => re.exec(s)?.[1]?.trim();
  const refs: Record<string, string> = {};
  for (const l of body.split('\n')) {
    const m = FIELD.exec(l);
    if (m) refs[m[1]] = m[2];
  }
  let host: string | undefined;
  try {
    const url = line(/^URL：(.+)$/m, body);
    host = url ? new URL(url).hostname : undefined;
  } catch {
    /* no URL */
  }
  return {
    question: line(/^我的问题：(.*)$/m, head) ?? '',
    page: {
      vendor: line(/^厂商：(.+)$/m, body),
      heading: line(/^主标题：(.+)$/m, body) ?? line(/^页面标题：(.+)$/m, body),
      host,
      fields: Object.keys(refs).length,
      next: head.trimStart().startsWith('我到了下一页'),
    },
    refs,
  };
}

/**
 * The text of a ⟦f3⟧ tag in a reply: the ref, plus the field's label unless
 * the reply names the field right after it. Replies name it loosely — "带宽峰值"
 * for "带宽峰值（Mbps）", "HTTP 80" for "安全组规则 · HTTP 80" — so the first
 * few characters of the label or of one of its parts are enough.
 */
export function refChip(ref: string, label: string | undefined, after: string): string {
  if (!label) return ref;
  const next = after.replace(/^[\s:：、，,]+/, '');
  const named = [label, ...label.split(' · ')].some((name) => {
    const n = Math.min(4, name.length);
    return n > 0 && next.slice(0, n) === name.slice(0, n);
  });
  return named ? ref : `${ref} ${label}`;
}
