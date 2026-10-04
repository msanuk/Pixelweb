import { describe, expect, it } from 'vitest';
import type { OcMessageWithParts, OcPart } from '@pixelweb/shared';
import { appendDelta } from '../src/lib/delta';

const text = (id: string, t: string): OcPart => ({ id, sessionID: 's', messageID: 'm', type: 'text', text: t }) as OcPart;
const msg = (parts: OcPart[]): OcMessageWithParts =>
  ({ info: { id: 'm', sessionID: 's', role: 'assistant', time: { created: 1 } }, parts }) as unknown as OcMessageWithParts;

describe('appendDelta', () => {
  it('appends chunks to the part field, leaving the other parts alone', () => {
    const other = text('p0', 'done');
    let all = { s: [msg([other, text('p1', '')])] };
    all = appendDelta(all, 's', 'm', 'p1', 'text', '你好');
    all = appendDelta(all, 's', 'm', 'p1', 'text', '，世界');
    expect((all.s[0].parts[1] as any).text).toBe('你好，世界');
    expect(all.s[0].parts[0]).toBe(other);
  });
  it('starts from an empty string when the field is missing', () => {
    const all = appendDelta({ s: [msg([{ id: 'p1', sessionID: 's', messageID: 'm', type: 'reasoning' } as OcPart])] }, 's', 'm', 'p1', 'text', 'x');
    expect((all.s[0].parts[0] as any).text).toBe('x');
  });
  it('does not mutate the previous tree', () => {
    const before = { s: [msg([text('p1', 'a')])] };
    appendDelta(before, 's', 'm', 'p1', 'text', 'b');
    expect((before.s[0].parts[0] as any).text).toBe('a');
  });
  it('returns the same object when there is nothing to append to', () => {
    const all = { s: [msg([text('p1', 'a')])] };
    expect(appendDelta(all, 'other', 'm', 'p1', 'text', 'b')).toBe(all);
    expect(appendDelta(all, 's', 'm2', 'p1', 'text', 'b')).toBe(all);
    expect(appendDelta(all, 's', 'm', 'p2', 'text', 'b')).toBe(all);
    expect(appendDelta(all, 's', 'm', 'p1', 'text', undefined)).toBe(all);
  });
});
