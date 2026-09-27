import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitService, parseBranches, parseLog, parseStatus } from '../src/git/service.js';

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

describe('GitService.diff', () => {
  let dir: string;
  let svc: GitService;
  const run = (...args: string[]) => execFileSync('git', args, { cwd: dir });

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixelweb-git-'));
    run('init', '-q');
    run('config', 'user.email', 'test@example.com');
    run('config', 'user.name', 'test');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'one\ntwo\n');
    fs.writeFileSync(path.join(dir, 'secret.txt'), 'committed and unchanged\n');
    run('add', '.');
    run('commit', '-q', '-m', 'init');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'one\nTWO\n');
    fs.writeFileSync(path.join(dir, 'new.txt'), 'fresh\n');
    svc = new GitService(dir);
    await svc.refresh();
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('diffs a modified tracked file against HEAD', async () => {
    const d = await svc.diff('a.txt');
    expect(d).toContain('-two');
    expect(d).toContain('+TWO');
  });

  it('diffs an untracked file as all additions', async () => {
    const d = await svc.diff('new.txt');
    expect(d).toContain('+fresh');
  });

  it('refuses paths that are not in git status', async () => {
    expect(await svc.diff('secret.txt')).toBeNull();
    expect(await svc.diff('../outside.txt')).toBeNull();
  });
});
