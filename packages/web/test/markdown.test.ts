import { describe, expect, it } from 'vitest';
import { parseBlocks, splitRow } from '../src/lib/markdown';

describe('splitRow', () => {
  it('drops the outer pipes and trims cells', () => {
    expect(splitRow('| a | b |')).toEqual(['a', 'b']);
    expect(splitRow('a | b')).toEqual(['a', 'b']);
  });
  it('keeps escaped pipes and pipes inside code spans', () => {
    expect(splitRow('| `a | b` | c \\| d |')).toEqual(['`a | b`', 'c | d']);
  });
  it('keeps empty cells in the middle', () => {
    expect(splitRow('| a |  | c |')).toEqual(['a', '', 'c']);
  });
});

describe('parseBlocks tables', () => {
  it('parses a GFM table with alignment', () => {
    const blocks = parseBlocks('对比如下：\n\n| 模型 | 命中率 | 费用 |\n|:---|:---:|---:|\n| sonnet | 90% | $1 |\n| haiku | 80% | $0.2 |\n\n结束');
    expect(blocks).toEqual([
      { kind: 'p', text: '对比如下：' },
      { kind: 'table', align: ['left', 'center', 'right'], head: ['模型', '命中率', '费用'], rows: [['sonnet', '90%', '$1'], ['haiku', '80%', '$0.2']] },
      { kind: 'p', text: '结束' },
    ]);
  });
  it('interrupts a paragraph and pads or cuts rows to the header width', () => {
    const blocks = parseBlocks('说明\na | b\n--|--\n1\n1 | 2 | 3');
    expect(blocks).toEqual([
      { kind: 'p', text: '说明' },
      { kind: 'table', align: [null, null], head: ['a', 'b'], rows: [['1', ''], ['1', '2']] },
    ]);
  });
  it('ends at a following list or heading', () => {
    const blocks = parseBlocks('| a |\n|---|\n| 1 |\n- item\n## 标题');
    expect(blocks.map((b) => b.kind)).toEqual(['table', 'ul', 'h']);
  });
  it('leaves pipes in plain text alone', () => {
    expect(parseBlocks('a | b\nc | d')).toEqual([{ kind: 'p', text: 'a | b c | d' }]);
    // header and delimiter must have the same column count
    expect(parseBlocks('| a | b |\n|---|')[0].kind).toBe('p');
  });
  it('treats a lone --- as text, not a table', () => {
    expect(parseBlocks('---')[0]).toEqual({ kind: 'p', text: '---' });
  });
});

describe('parseBlocks code fences', () => {
  it('keeps the language and whether the fence was closed', () => {
    expect(parseBlocks('```Mermaid title\ngraph TD\n  A-->B\n```\n后文')).toEqual([
      { kind: 'code', text: 'graph TD\n  A-->B', lang: 'mermaid', closed: true },
      { kind: 'p', text: '后文' },
    ]);
    expect(parseBlocks('```\nplain\n```')[0]).toMatchObject({ lang: '', closed: true });
  });
  it('marks a fence a streaming reply has not closed yet', () => {
    expect(parseBlocks('```mermaid\ngraph TD\n  A-->')).toEqual([{ kind: 'code', text: 'graph TD\n  A-->', lang: 'mermaid', closed: false }]);
  });
});
