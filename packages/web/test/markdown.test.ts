import { describe, expect, it } from 'vitest';
import { joinLines, parseBlocks, parseInline, safeHref, splitRow } from '../src/lib/markdown';

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
  it('treats a lone --- as a rule, not a table', () => {
    expect(parseBlocks('---')).toEqual([{ kind: 'hr' }]);
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

describe('safeHref', () => {
  it('keeps web and mail links', () => {
    expect(safeHref(' https://opencode.ai/docs ')).toBe('https://opencode.ai/docs');
    expect(safeHref('mailto:a@b.c')).toBe('mailto:a@b.c');
  });
  it('drops script, data and relative targets', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref(' JavaScript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeHref('/api/sessions')).toBeNull();
  });
});

const li = (text: string, children: ReturnType<typeof parseBlocks> = []) => ({ text, children });

describe('parseBlocks lists', () => {
  it('nests lists by indent, 2 or 4 spaces, mixing bullets and numbers', () => {
    const md = '- 前端\n  - React\n  - Vite\n- 后端\n    1. Fastify\n    2. tsx';
    expect(parseBlocks(md)).toEqual([
      {
        kind: 'ul',
        items: [
          li('前端', [{ kind: 'ul', items: [li('React'), li('Vite')] }]),
          li('后端', [{ kind: 'ol', start: 1, items: [li('Fastify'), li('tsx')] }]),
        ],
      },
    ]);
  });
  it('keeps the start number and blank lines between items', () => {
    expect(parseBlocks('3. 三\n\n4. 四')).toEqual([{ kind: 'ol', start: 3, items: [li('三'), li('四')] }]);
  });
  it('joins wrapped item text and keeps code indented under an item', () => {
    expect(parseBlocks('1. 运行测试，\n   看输出\n\n   ```bash\n   npm test\n   ```\n2. 提交')).toEqual([
      {
        kind: 'ol',
        start: 1,
        items: [li('运行测试，看输出', [{ kind: 'code', text: 'npm test', lang: 'bash', closed: true }]), li('提交')],
      },
    ]);
  });
  it('starts a new list when the marker kind changes at the same depth', () => {
    expect(parseBlocks('- a\n1. b').map((b) => b.kind)).toEqual(['ul', 'ol']);
  });
  it('does not take emphasis or a rule for a list', () => {
    expect(parseBlocks('*强调*开头')[0].kind).toBe('p');
    expect(parseBlocks('* * *')).toEqual([{ kind: 'hr' }]);
  });
});

describe('parseBlocks quotes and rules', () => {
  it('parses a quote as nested blocks', () => {
    expect(parseBlocks('> **注意**：会改文件\n> - 先备份\n\n正文')).toEqual([
      { kind: 'quote', blocks: [{ kind: 'p', text: '**注意**：会改文件' }, { kind: 'ul', items: [li('先备份')] }] },
      { kind: 'p', text: '正文' },
    ]);
  });
  it('ends a paragraph at a rule', () => {
    expect(parseBlocks('上面\n___\n下面')).toEqual([{ kind: 'p', text: '上面' }, { kind: 'hr' }, { kind: 'p', text: '下面' }]);
  });
});

describe('joinLines', () => {
  it('puts no space between wrapped Chinese lines', () => {
    expect(joinLines(['第一行', '第二行'])).toBe('第一行第二行');
    expect(joinLines(['first', 'second'])).toBe('first second');
    expect(joinLines(['中文', 'English'])).toBe('中文 English');
  });
});

describe('parseInline', () => {
  it('reads code, bold, italic, strikethrough and links, nested', () => {
    expect(parseInline('用 `grep` 找 **很*重要*的** 和 _斜体_，~~旧的~~，见 [文档](https://x.y)')).toEqual([
      { kind: 'text', text: '用 ' },
      { kind: 'code', text: 'grep' },
      { kind: 'text', text: ' 找 ' },
      { kind: 'strong', children: [{ kind: 'text', text: '很' }, { kind: 'em', children: [{ kind: 'text', text: '重要' }] }, { kind: 'text', text: '的' }] },
      { kind: 'text', text: ' 和 ' },
      { kind: 'em', children: [{ kind: 'text', text: '斜体' }] },
      { kind: 'text', text: '，' },
      { kind: 'del', children: [{ kind: 'text', text: '旧的' }] },
      { kind: 'text', text: '，见 ' },
      { kind: 'link', text: '文档', href: 'https://x.y' },
    ]);
  });
  it('keeps balanced parentheses in a link target', () => {
    expect(parseInline('[词条](https://zh.wikipedia.org/wiki/A_(B))。')).toEqual([
      { kind: 'link', text: '词条', href: 'https://zh.wikipedia.org/wiki/A_(B)' },
      { kind: 'text', text: '。' },
    ]);
  });
  it('leaves stars and underscores that are not emphasis alone', () => {
    for (const t of ['2 * 3 * 4', 'glob *.ts, *.js', 'snake_case_name', 'a __init__ b', '`*x*` code']) {
      expect(parseInline(t).some((n) => n.kind === 'em' || n.kind === 'strong')).toBe(false);
    }
  });
});
