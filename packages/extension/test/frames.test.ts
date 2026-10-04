import { describe, expect, it } from 'vitest';
import { MASK } from '@pixelweb/shared/capture';
import type { FrameCapture } from '../src/content/extract';
import { finalCapture, mergeFrames } from '../src/lib/frames';

const frame = (over: Partial<FrameCapture> = {}): FrameCapture => ({
  url: 'https://ecs.console.aliyun.com/server/create?region=cn-hangzhou&token=abc',
  title: '创建实例',
  breadcrumbs: [],
  heading: '',
  fields: [],
  text: '',
  ...over,
});

describe('mergeFrames', () => {
  it('puts the top frame first and numbers refs across frames', () => {
    const d = mergeFrames(
      [
        { frameId: 7, result: frame({ url: 'https://ecs-buy.aliyun.com/x', heading: '创建实例', fields: [{ label: '地域', kind: 'select', value: '华东1' }] }) },
        { frameId: 0, result: frame({ fields: [{ label: '搜索', kind: 'text', value: '' }] }) },
      ],
      42,
    );
    expect(d.capture.fields.map((f) => [f.ref, f.label])).toEqual([
      ['f1', '搜索'],
      ['f2', '地域'],
    ]);
    expect(d.origins).toEqual({ f1: { frameId: 0, index: 0 }, f2: { frameId: 7, index: 0 } });
    // the top frame's URL, the inner frame's heading
    expect(d.capture.url).toBe('https://ecs.console.aliyun.com/server/create?region=cn-hangzhou');
    expect(d.capture.heading).toBe('创建实例');
    expect(d.capture.vendor).toBe('aliyun');
    expect(d.capture.capturedAt).toBe(42);
  });

  it('drops sub-frames with nothing in them, and frames that failed', () => {
    const d = mergeFrames([
      { frameId: 0, result: frame({ text: '正文' }) },
      { frameId: 3, result: frame({ text: '广告' }) },
      { frameId: 4, result: null },
    ]);
    expect(d.capture.text).toBe('正文');
  });

  it('shares one text budget between frames', () => {
    const d = mergeFrames([
      { frameId: 0, result: frame({ text: 'a'.repeat(7000) }) },
      { frameId: 1, result: frame({ text: 'b'.repeat(7000) }) },
    ]);
    expect(d.capture.text.length).toBeLessThanOrEqual(8000);
    expect(d.capture.text).toMatch(/^a{7000}\n\nb+…$/);
  });

  it('masks secrets before the preview shows them', () => {
    const d = mergeFrames([
      {
        frameId: 0,
        result: frame({
          fields: [
            { label: '描述', kind: 'textarea', value: 'AccessKey ID LTAI5tQ8zXk2Lp9Zr4Tw8Vn1' },
            { label: 'AccessKey Secret', kind: 'text', value: 'abc123' },
          ],
        }),
      },
    ]);
    expect(d.capture.fields.map((f) => f.value)).toEqual([`AccessKey ID ${MASK}`, MASK]);
    expect(d.capture.redactions).toBe(3); // two values and the token in the URL
  });

  it('fails when no frame could be read', () => {
    expect(() => mergeFrames([{ frameId: 0, result: null }])).toThrow('没读到页面内容');
  });
});

describe('finalCapture', () => {
  it('leaves out removed fields and, if asked, the text', () => {
    const d = mergeFrames([
      {
        frameId: 0,
        result: frame({
          text: '正文',
          fields: [
            { label: 'a', kind: 'text' },
            { label: 'b', kind: 'text' },
          ],
        }),
      },
    ]);
    const c = finalCapture(d, { removed: new Set(['f1']), includeText: false, selectionOnly: false });
    expect(c.fields.map((f) => f.ref)).toEqual(['f2']);
    expect(c.text).toBe('');
    expect(finalCapture(d, { removed: new Set(), includeText: true, selectionOnly: false }).text).toBe('正文');
  });

  it('can send only the selected part', () => {
    const d = mergeFrames([
      { frameId: 0, result: frame({ text: '正文', selection: '带宽 5', selected: [1], fields: [{ label: 'a', kind: 'text' }, { label: 'b', kind: 'text' }] }) },
      { frameId: 2, result: frame({ fields: [{ label: 'c', kind: 'text' }], selected: [0] }) },
    ]);
    expect(d.selected).toEqual(['f2', 'f3']);
    const c = finalCapture(d, { removed: new Set(['f3']), includeText: true, selectionOnly: true });
    expect(c.fields.map((f) => f.ref)).toEqual(['f2']);
    expect(c.text).toBe('');
    expect(c.selection).toBe('带宽 5');
  });

  it('ignores "selection only" when nothing is selected', () => {
    const d = mergeFrames([{ frameId: 0, result: frame({ text: '正文', fields: [{ label: 'a', kind: 'text' }] }) }]);
    expect(finalCapture(d, { removed: new Set(), includeText: true, selectionOnly: true })).toMatchObject({ text: '正文', fields: [{ ref: 'f1' }] });
  });
});
