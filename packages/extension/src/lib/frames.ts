import type { CapturedField, PageCapture } from '@pixelweb/shared';
import { redactCapture, vendorOf } from '@pixelweb/shared/capture';
import { TEXT_BUDGET, type FrameCapture } from '../content/extract';

/** Where a ref's element lives: which frame, and its index in that frame's element list. */
export interface FieldOrigin {
  frameId: number;
  index: number;
}

/** A capture waiting in the side panel for the user to look over before it is sent. */
export interface Draft {
  capture: PageCapture;
  origins: Record<string, FieldOrigin>;
  /** refs of the fields inside the user's selection */
  selected: string[];
}

const MAX_FIELDS = 150;
/** A sub-frame with less text than this and no fields is an ad, a tracker or a spacer. */
const MIN_FRAME_TEXT = 40;

/**
 * One capture from every frame the reader ran in: the top frame first, refs
 * numbered across frames, the text shared out under one budget, and every
 * secret masked before the user even sees the preview.
 */
export function mergeFrames(frames: { frameId: number; result: FrameCapture | null | undefined }[], now = Date.now()): Draft {
  const ok = frames
    .filter((f): f is { frameId: number; result: FrameCapture } => !!f.result)
    .filter((f) => f.frameId === 0 || f.result.fields.length > 0 || f.result.text.length >= MIN_FRAME_TEXT)
    .sort((a, b) => (a.frameId === 0 ? -1 : b.frameId === 0 ? 1 : a.frameId - b.frameId));
  const top = ok[0]?.result;
  if (!top) throw new Error('没读到页面内容');

  const fields: CapturedField[] = [];
  const origins: Record<string, FieldOrigin> = {};
  const selected: string[] = [];
  for (const { frameId, result } of ok) {
    result.fields.forEach((field, index) => {
      if (fields.length >= MAX_FIELDS) return;
      const ref = `f${fields.length + 1}`;
      fields.push({ ref, ...field });
      origins[ref] = { frameId, index };
      if (result.selected?.includes(index)) selected.push(ref);
    });
  }

  let text = '';
  for (const { result } of ok) {
    const t = result.text.trim();
    const room = TEXT_BUDGET - text.length - 2;
    if (!t || room <= 0) continue;
    text += (text ? '\n\n' : '') + (t.length > room ? t.slice(0, room - 1) + '…' : t);
  }

  let vendor: PageCapture['vendor'] = null;
  try {
    vendor = vendorOf(new URL(top.url).hostname);
  } catch {
    /* not a URL: no vendor */
  }
  const first = <T>(pick: (c: FrameCapture) => T | undefined, empty: (v: T) => boolean): T | undefined =>
    ok.map((f) => pick(f.result)).find((v) => v !== undefined && !empty(v));
  const selection = first((c) => c.selection, (s) => !s);

  const capture: PageCapture = {
    url: top.url,
    title: top.title,
    vendor,
    // an Alibaba Cloud console often draws its page inside a cross-subdomain iframe
    breadcrumbs: first((c) => c.breadcrumbs, (b) => b.length === 0) ?? [],
    heading: first((c) => c.heading, (h) => !h) ?? '',
    fields,
    text,
    ...(selection ? { selection } : {}),
    redactions: 0,
    capturedAt: now,
  };
  return { capture: redactCapture(capture), origins, selected };
}

export interface SendOptions {
  /** fields the user took out of the preview */
  removed: ReadonlySet<string>;
  includeText: boolean;
  /** only the selected part: its fields and the selected text, not the whole page */
  selectionOnly: boolean;
}

/** What is sent: the draft as the user trimmed it in the preview. */
export function finalCapture(draft: Draft, opts: SendOptions): PageCapture {
  const c = draft.capture;
  const only = opts.selectionOnly && !!c.selection;
  const fields = c.fields.filter((f) => !opts.removed.has(f.ref) && (!only || draft.selected.includes(f.ref)));
  return { ...c, fields, text: opts.includeText && !only ? c.text : '' };
}
