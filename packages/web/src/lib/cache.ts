import type { OcMessageWithParts, OcPart, OcTokens } from '@pixelweb/shared';
import { fmtDuration } from './format';

/** Anthropic's default cache lifetime; OpenAI and DeepSeek keep prefixes about as long or longer. */
export const CACHE_TTL_MS = 5 * 60_000;
/** Below this, providers don't cache at all (Anthropic and OpenAI: 1024 tokens). */
const MIN_CACHEABLE = 1024;
/** A request that re-reads less than this share of the previous prompt counts as a cache break. */
const BREAK_RATIO = 0.5;
const INSTRUCTION_FILES = /(^|[\\/])(AGENTS|CLAUDE)\.md$/i;
const EDIT_TOOLS = new Set(['edit', 'write', 'patch', 'multiedit']);

/** Why a request stopped matching the cached prefix, as far as the timeline can tell. */
export type CacheBreakCause = 'compaction' | 'model' | 'agent' | 'settings' | 'instructions' | 'idle';

export interface CacheBreak {
  /** the previous request's prompt, which this one should have re-read */
  expected: number;
  causes: CacheBreakCause[];
  /** time since the previous request */
  idleMs: number;
}

export interface StepCache {
  /** prompt tokens: fresh input plus cache reads and writes */
  prompt: number;
  read: number;
  write: number;
  /** share of the prompt served from cache; null for an empty prompt */
  hitRate: number | null;
  broken?: CacheBreak;
}

export interface SessionCache {
  /** by step-finish part id */
  steps: Map<string, StepCache>;
  prompt: number;
  read: number;
  write: number;
  hitRate: number | null;
  breaks: number;
  /** false when the provider never reported cache usage, so every read is 0 and says nothing */
  reported: boolean;
}

type StepFinish = Extract<OcPart, { type: 'step-finish' }>;
type Tool = Extract<OcPart, { type: 'tool' }>;

export function promptTokens(t: OcTokens): number {
  return (t.input ?? 0) + (t.cache?.read ?? 0) + (t.cache?.write ?? 0);
}

/**
 * Prompt-cache use of every model request (step) in a session.
 *
 * Each request normally starts with the whole previous prompt, so the cache
 * should serve at least that much; when it serves far less the prefix changed
 * or expired. The causes are what the timeline shows happening in between.
 * OpenCode reports `input` without the cached part, for every provider.
 */
export function analyzeCache(messages: OcMessageWithParts[]): SessionCache {
  const steps = new Map<string, StepCache>();
  let prompt = 0,
    read = 0,
    write = 0,
    breaks = 0;
  let prev: { prompt: number; start: number; model: string; agent: string; settings: string } | null = null;
  // what happened since the previous request, and what the current one did that affects the next
  let pending = new Set<CacheBreakCause>();
  let settings = '';

  for (const m of messages) {
    if (m.info.role === 'user') {
      const u = m.info;
      settings = JSON.stringify([u.system ?? '', u.tools ?? {}, u.model?.variant ?? '']);
      if (m.parts.some((p) => p.type === 'compaction')) pending.add('compaction');
      continue;
    }
    const a = m.info;
    const model = `${a.providerID}/${a.modelID}`;
    const agent = a.mode ?? '';
    if (a.summary) pending.add('compaction');
    let start = a.time.created;
    let toolsEnd = 0;
    let next = new Set<CacheBreakCause>();

    for (const p of m.parts) {
      if (p.type === 'tool') {
        const st = (p as Tool).state;
        if ('time' in st && 'end' in st.time) toolsEnd = Math.max(toolsEnd, st.time.end);
        const file = st.input?.filePath;
        if (EDIT_TOOLS.has((p as Tool).tool) && typeof file === 'string' && INSTRUCTION_FILES.test(file)) next.add('instructions');
        continue;
      }
      if (p.type !== 'step-finish') continue;
      const t = (p as StepFinish).tokens;
      if (!t) continue;
      const s: StepCache = { prompt: promptTokens(t), read: t.cache?.read ?? 0, write: t.cache?.write ?? 0, hitRate: null };
      if (s.prompt) s.hitRate = s.read / s.prompt;
      if (prev && prev.prompt >= MIN_CACHEABLE && s.read < prev.prompt * BREAK_RATIO) {
        const idleMs = Math.max(0, start - prev.start);
        const causes: CacheBreakCause[] = [];
        if (pending.has('compaction')) causes.push('compaction');
        if (model !== prev.model) causes.push('model');
        if (agent !== prev.agent) causes.push('agent');
        if (settings !== prev.settings) causes.push('settings');
        if (pending.has('instructions')) causes.push('instructions');
        if (idleMs > CACHE_TTL_MS) causes.push('idle');
        s.broken = { expected: prev.prompt, causes, idleMs };
      }
      steps.set(p.id, s);
      prompt += s.prompt;
      read += s.read;
      write += s.write;
      if (s.broken) breaks++;
      prev = { prompt: s.prompt, start, model, agent, settings };
      // the request after a compaction summary starts from that summary, not the old history
      pending = a.summary ? new Set<CacheBreakCause>(['compaction', ...next]) : next;
      next = new Set();
      // the next request goes out once this step's tools have finished
      start = toolsEnd || start;
      toolsEnd = 0;
    }
  }

  const reported = read > 0 || write > 0;
  return { steps, prompt, read, write, hitRate: prompt ? read / prompt : null, breaks: reported ? breaks : 0, reported };
}

const CAUSE_TEXT: Record<Exclude<CacheBreakCause, 'idle'>, string> = {
  compaction: '上下文压缩重写了历史',
  model: '换了模型',
  agent: '换了 agent（系统提示和工具都不同）',
  settings: '系统提示、工具开关或推理档位变了',
  instructions: '改了 AGENTS.md / CLAUDE.md（它们在系统提示里）',
};

/** Why a cache break happened, in the UI's language. */
export function breakReasons(b: CacheBreak): string {
  if (!b.causes.length) return '原因不明：可能是 MCP 工具变了，或服务商清掉了缓存';
  return b.causes
    .map((c) => (c === 'idle' ? `距上一次请求 ${fmtDuration(b.idleMs)}，超过常见的 5 分钟缓存有效期` : CAUSE_TEXT[c]))
    .join('；');
}
