import type { ModelInfo, OcMessageWithParts, OcModelLimit, OcPart, OcTokens } from '@pixelweb/shared';

// OpenCode's defaults (provider/transform OUTPUT_TOKEN_MAX, session compaction buffer), as of v1.17.
const OUTPUT_TOKEN_MAX = 32_000;
const DEFAULT_RESERVED = 20_000;

/**
 * Token count at which OpenCode compacts a session on its own — the same
 * formula as its overflow check: the window minus room for the reply, or the
 * model's separate input cap minus a reserve.
 */
export function compactionThreshold(limit: OcModelLimit, reserved?: number): number {
  const maxOut = Math.min(limit.output, OUTPUT_TOKEN_MAX) || OUTPUT_TOKEN_MAX;
  if (limit.input) return Math.max(0, limit.input - (reserved ?? Math.min(DEFAULT_RESERVED, maxOut)));
  return Math.max(0, limit.context - maxOut);
}

/** Tokens one request put through the model: prompt (fresh + cached) plus reply. */
export function tokensUsed(t: OcTokens | undefined): number {
  if (!t) return 0;
  return t.total || t.input + t.output + (t.cache?.read ?? 0) + (t.cache?.write ?? 0);
}

export interface ContextUsage {
  model: string;
  used: number;
  /** 0 when OpenCode didn't report this model's window */
  limit: number;
  threshold: number;
  autoCompact: boolean;
  /** the latest message is a compaction summary: the real size is only known after the next request */
  justCompacted: boolean;
}

/** How full the session's context is, judged by its most recent model request. */
export function contextUsage(messages: OcMessageWithParts[] | undefined, info: ModelInfo | null): ContextUsage | null {
  const list = messages ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (m.info.role !== 'assistant') continue;
    const model = `${m.info.providerID}/${m.info.modelID}`;
    const limit = info?.limits[model];
    const base = {
      model,
      limit: limit?.context ?? 0,
      threshold: limit ? compactionThreshold(limit, info?.compaction.reserved) : 0,
      autoCompact: info?.compaction.auto ?? true,
    };
    if (m.info.summary) return { ...base, used: 0, justCompacted: true };
    // the last step of the message is the latest request; message totals are a fallback
    const steps = m.parts.filter((p): p is Extract<OcPart, { type: 'step-finish' }> => p.type === 'step-finish');
    const used = tokensUsed(steps.at(-1)?.tokens) || tokensUsed(m.info.tokens);
    if (used) return { ...base, used, justCompacted: false };
    // still streaming its first step: fall back to the request before it
  }
  return null;
}
