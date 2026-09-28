// @ts-check
// The one place token usage is read out of OpenCode messages, for the server's 用量 page
// and the web timeline alike. Plain JS (typed by steps.d.ts) so the built server can import
// it under Node without a build step for this package.

/** @typedef {import('./index.js').OcMessageWithParts} OcMessageWithParts */
/** @typedef {import('./index.js').OcTokens} OcTokens */
/** @typedef {import('./index.js').UsageTotals} UsageTotals */
/** @typedef {import('./steps.js').UsageStep} UsageStep */

/** @param {OcTokens | undefined} t */
const tokenFields = (t) => ({
  input: t?.input ?? 0,
  output: t?.output ?? 0,
  reasoning: t?.reasoning ?? 0,
  cacheRead: t?.cache?.read ?? 0,
  cacheWrite: t?.cache?.write ?? 0,
});

/**
 * Every request a session made. Counted from step-finish parts: an assistant
 * message's own `tokens` only hold its last step (OpenCode overwrites them per
 * step, while summing `cost`), so summing messages would undercount multi-step
 * turns. A message with no step-finish (older OpenCode, or it failed mid-step)
 * counts as one step.
 * @param {OcMessageWithParts[]} messages
 * @returns {UsageStep[]}
 */
export function stepsOf(messages) {
  /** @type {UsageStep[]} */
  const out = [];
  for (const m of messages) {
    const info = m.info;
    if (info.role !== 'assistant') continue;
    const base = { t: info.time.created, providerID: info.providerID, modelID: info.modelID };
    let finished = false;
    for (const p of m.parts) {
      if (p.type !== 'step-finish' || !('tokens' in p)) continue;
      finished = true;
      out.push({ ...base, ...tokenFields(p.tokens), cost: p.cost ?? 0 });
    }
    if (finished) continue;
    const f = tokenFields(info.tokens);
    if (f.input + f.output + f.cacheRead + f.cacheWrite > 0) out.push({ ...base, ...f, cost: info.cost ?? 0 });
  }
  return out;
}

/** @returns {UsageTotals} */
export const emptyTotals = () => ({ steps: 0, input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });

/**
 * Adds one step into `t`, in place.
 * @param {UsageTotals} t
 * @param {UsageStep} s
 */
export function addStep(t, s) {
  t.steps++;
  t.input += s.input;
  t.output += s.output;
  t.reasoning += s.reasoning;
  t.cacheRead += s.cacheRead;
  t.cacheWrite += s.cacheWrite;
  t.cost += s.cost;
}

/**
 * A session's totals over all its steps.
 * @param {OcMessageWithParts[]} messages
 * @returns {UsageTotals}
 */
export function sessionTotals(messages) {
  const t = emptyTotals();
  for (const s of stepsOf(messages)) addStep(t, s);
  return t;
}
