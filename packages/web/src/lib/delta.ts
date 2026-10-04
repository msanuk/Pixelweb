import type { OcMessageWithParts, OcPart } from '@pixelweb/shared';

type Messages = Record<string, OcMessageWithParts[]>;

/**
 * OpenCode ≥ 1.18 streams text as `message.part.delta` ({ sessionID, messageID,
 * partID, field, delta }) between a `message.part.updated` with the empty part and
 * one with the full text. Appends `delta` to `part[field]`; returns `all` itself
 * when the session isn't loaded or the part hasn't arrived yet (the final update
 * carries the whole text anyway).
 */
export function appendDelta(all: Messages, sessionID: string, messageID: string, partID: string, field: string, delta: unknown): Messages {
  if (typeof delta !== 'string' || typeof field !== 'string') return all;
  const list = all[sessionID];
  const mi = list?.findIndex((m) => m.info.id === messageID) ?? -1;
  if (mi < 0) return all;
  const parts = list[mi].parts;
  const pi = parts.findIndex((x) => x.id === partID);
  if (pi < 0) return all;
  const prev = (parts[pi] as unknown as Record<string, unknown>)[field];
  const part = { ...parts[pi], [field]: (typeof prev === 'string' ? prev : '') + delta } as OcPart;
  const message = { ...list[mi], parts: parts.map((x, i) => (i === pi ? part : x)) };
  return { ...all, [sessionID]: list.map((m, i) => (i === mi ? message : m)) };
}
