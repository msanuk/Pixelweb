import type { OcMessageWithParts, OcPart } from '@pixelweb/shared';
import { sessionFiles } from './activity';
import { splitByTerms, type TermMatcher } from './terms';
import { cardForTool } from './tools';

export interface SessionSummary {
  /** user prompts */
  turns: number;
  toolCalls: number;
  toolErrors: number;
  /** project files the agent edited */
  edited: string[];
  cost: number;
  /** knowledge cards the conversation touched, most frequent first */
  concepts: { cardId: string; count: number }[];
}

/**
 * What a session amounted to, for the recap under the timeline: counts, the
 * files it changed, and every concept that came up — named in the
 * conversation's text or exercised through a tool (a bash call → the bash card).
 */
export function summarizeSession(messages: OcMessageWithParts[] | undefined, matcher: TermMatcher, root: string): SessionSummary {
  const concepts = new Map<string, number>();
  const bump = (id: string | undefined) => id && concepts.set(id, (concepts.get(id) ?? 0) + 1);
  let turns = 0,
    toolCalls = 0,
    toolErrors = 0,
    cost = 0;
  for (const m of messages ?? []) {
    if (m.info.role === 'user') turns++;
    else cost += m.info.cost ?? 0;
    for (const p of m.parts) {
      if (p.type === 'text') {
        const t = p as Extract<OcPart, { type: 'text' }>;
        if (!t.synthetic) for (const piece of splitByTerms(t.text ?? '', matcher)) bump(piece.cardId);
      } else if (p.type === 'tool') {
        const tool = p as Extract<OcPart, { type: 'tool' }>;
        toolCalls++;
        if (tool.state.status === 'error') toolErrors++;
        bump(cardForTool(tool.tool));
      }
    }
  }
  const edited = [...sessionFiles(messages, root)].filter(([, t]) => t === 'edit').map(([f]) => f);
  return {
    turns,
    toolCalls,
    toolErrors,
    edited,
    cost,
    concepts: [...concepts].map(([cardId, count]) => ({ cardId, count })).sort((a, b) => b.count - a.count || a.cardId.localeCompare(b.cardId)),
  };
}
