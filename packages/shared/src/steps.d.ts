import type { OcMessageWithParts, UsageTotals } from './index.js';

/** One model request: an OpenCode step, timed by the assistant message it belongs to. */
export interface UsageStep {
  t: number;
  providerID: string;
  modelID: string;
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
}

export function stepsOf(messages: OcMessageWithParts[]): UsageStep[];
export function emptyTotals(): UsageTotals;
export function addStep(t: UsageTotals, s: UsageStep): void;
export function sessionTotals(messages: OcMessageWithParts[]): UsageTotals;
