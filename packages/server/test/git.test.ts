import { describe, expect, it } from 'vitest';
import { parseBranches, parseLog, parseStatus } from '../src/git/service.js';

const S = '\u001f';

describe('parseLog', () => {
  it('parses commits with parents and refs', () => {
    const out = [
      `aaa111${S}bbb222 ccc333${S}Ada${S}1700000000${S}Merge feature${S}HEAD -> main, origin/main`,
      `bbb222${S}${S}Bob${S}1699999999${S}Initial${S}tag: v0.1`,
    ].join('\n');
    const commits = parseLog(out);
    expect(commits).toHaveLength(2);
    expect(commits[0].parents).toEqual(['bbb222', 'ccc333']);
    expect(commits[0].refs).toEqual(['HEAD -> main', 'origin/main']);
    expect(commits[1].parents).toEqual([]);
    expect(commits[1].shortHash).toBe('bbb222');
  });
});

describe('parseBranches', () => {
  it('distinguishes local, current and remote branches', () => {
    const out = [
      `main${S}aaa${S}*${S}origin/main${S}[ahead 2, behind 1]`,
      `feature/x${S}bbb${S} ${S}${S}`,
      `remotes/origin/main${S}aaa${S} ${S}${S}`,
      `remotes/origin/HEAD${S}aaa${S} ${S}${S}`,
    ].join('\n');
    const b = parseBranches(out);
    expect(b.map((x) => x.name)).toEqual(['main', 'feature/x', 'origin/main']);
    expect(b[0].current).toBe(true);
    expect(b[0].ahead).toBe(2);
    expect(b[0].behind).toBe(1);
    expect(b[1].remote).toBe(false);
    expect(b[2].remote).toBe(true);
  });
});

describe('parseStatus', () => {
  it('parses porcelain output including renames', () => {
    const entries = parseStatus(' M src/a.ts\n?? new.txt\nR  old.ts -> new.ts\n');
    expect(entries).toEqual([
      { path: 'src/a.ts', code: ' M' },
      { path: 'new.txt', code: '??' },
      { path: 'new.ts', code: 'R ' },
    ]);
  });
});
