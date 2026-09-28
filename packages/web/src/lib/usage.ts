import type { OcMessageWithParts, OcPart } from '@pixelweb/shared';

export interface TokenTotals {
  input: number;
  output: number;
  cost: number;
}

/**
 * A session's token and cost totals over its assistant messages.
 * OpenCode overwrites a message's `tokens` with the last step's usage (while summing `cost`),
 * so a multi-step turn is counted from its step-finish parts; the message's own tokens are
 * only used when it has none.
 */
export function sessionTokens(messages: OcMessageWithParts[]): TokenTotals {
  const t: TokenTotals = { input: 0, output: 0, cost: 0 };
  for (const m of messages) {
    if (m.info.role !== 'assistant') continue;
    t.cost += m.info.cost ?? 0;
    const steps = m.parts.filter((p): p is Extract<OcPart, { type: 'step-finish' }> => p.type === 'step-finish');
    for (const tokens of steps.length ? steps.map((s) => s.tokens) : [m.info.tokens]) {
      t.input += tokens?.input ?? 0;
      t.output += tokens?.output ?? 0;
    }
  }
  return t;
}
