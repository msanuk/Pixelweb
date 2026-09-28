import { describe, expect, it } from 'vitest';
import { buildMatcher, splitByTerms } from '../src/lib/terms';

const m = buildMatcher([
  { term: 'TS', cardId: 'typescript' },
  { term: 'bash', cardId: 'tool-bash' },
  { term: 'localhost', cardId: 'localhost-port' },
  { term: '.env', cardId: 'environment-variable' },
  { term: 'Context Window', cardId: 'context-window' },
  { term: '会话', cardId: 'session' },
]);
const hits = (text: string) => splitByTerms(text, m).filter((p) => p.cardId).map((p) => p.text);

describe('splitByTerms', () => {
  it('finds ASCII terms as words, including next to CJK and punctuation', () => {
    expect(hits('用 TS 写的，跑在 bash 里。')).toEqual(['TS', 'bash']);
    expect(hits('项目用TS写')).toEqual(['TS']);
    expect(hits('改成 TS.')).toEqual(['TS']);
    expect(hits('把密钥放进 .env 文件')).toEqual(['.env']);
    expect(hits('这个会话的 context window 快满了')).toEqual(['会话', 'context window']);
  });

  it('ignores terms inside file names, paths, URLs and identifiers', () => {
    expect(hits('改了 src/auth.ts 和 ts-node')).toEqual([]);
    expect(hits('调用了 tool-bash 和 bash_history')).toEqual([]);
    expect(hits('打开 http://localhost:5173/ 看看')).toEqual([]);
    expect(hits('打开 localhost:5173 看看')).toEqual(['localhost']);
    expect(hits('读 config.env.ts')).toEqual([]);
  });
});
