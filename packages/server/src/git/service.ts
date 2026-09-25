import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import chokidar, { type FSWatcher } from 'chokidar';
import type { GitBranch, GitCommit, GitSnapshot, GitStatusEntry } from '@pixelweb/shared';

const execFileP = promisify(execFile);
const SEP = '\u001f';

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileP('git', args, { cwd, maxBuffer: 32 * 1024 * 1024 });
  return stdout;
}

// ---- Pure parsers (unit-tested) -------------------------------------------

export function parseLog(out: string): GitCommit[] {
  const commits: GitCommit[] = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const [hash, parents, author, date, subject, refs] = line.split(SEP);
    if (!hash) continue;
    commits.push({
      hash,
      shortHash: hash.slice(0, 7),
      parents: parents ? parents.split(' ').filter(Boolean) : [],
      author: author ?? '',
      date: Number(date) || 0,
      subject: subject ?? '',
      refs: refs ? refs.split(',').map((r) => r.trim()).filter(Boolean) : [],
    });
  }
  return commits;
}

export function parseBranches(out: string): GitBranch[] {
  const branches: GitBranch[] = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const [name, hash, head, upstream, track] = line.split(SEP);
    if (!name || name.endsWith('/HEAD')) continue;
    const remote = name.startsWith('remotes/') || (!!hash && isRemoteRef(name));
    const b: GitBranch = {
      name: name.replace(/^remotes\//, ''),
      hash: hash ?? '',
      current: head === '*',
      remote,
    };
    if (upstream) b.upstream = upstream;
    if (track) {
      const ahead = /ahead (\d+)/.exec(track);
      const behind = /behind (\d+)/.exec(track);
      if (ahead) b.ahead = Number(ahead[1]);
      if (behind) b.behind = Number(behind[1]);
    }
    branches.push(b);
  }
  return branches;
}

function isRemoteRef(shortName: string): boolean {
  // `git branch -a --format=%(refname:short)` prints remote branches as "origin/main".
  // Local branches may legally contain "/" too (feature/x), so callers pass the refname
  // through `refs/remotes` detection where possible; this heuristic is only a fallback.
  return /^(origin|upstream)\//.test(shortName);
}

export function parseStatus(out: string): GitStatusEntry[] {
  const entries: GitStatusEntry[] = [];
  for (const line of out.split('\n')) {
    if (line.length < 4) continue;
    const code = line.slice(0, 2);
    let p = line.slice(3);
    // renames: "R  old -> new"
    const arrow = p.indexOf(' -> ');
    if (arrow >= 0) p = p.slice(arrow + 4);
    entries.push({ path: p, code });
  }
  return entries;
}

// ---- Service ----------------------------------------------------------------

export class GitService extends EventEmitter {
  private watcher?: FSWatcher;
  private timer?: NodeJS.Timeout;
  private snapshot: GitSnapshot | null = null;
  private refreshing: Promise<GitSnapshot | null> | null = null;

  constructor(private readonly projectRoot: string, private readonly maxCommits = 400) {
    super();
  }

  get current(): GitSnapshot | null {
    return this.snapshot;
  }

  async isRepo(): Promise<boolean> {
    try {
      await git(this.projectRoot, ['rev-parse', '--is-inside-work-tree']);
      return true;
    } catch {
      return false;
    }
  }

  /** Coalesces concurrent refreshes into one git round-trip. */
  refresh(): Promise<GitSnapshot | null> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.doRefresh().finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  private async doRefresh(): Promise<GitSnapshot | null> {
    if (!(await this.isRepo())) {
      this.snapshot = null;
      return null;
    }
    const root = (await git(this.projectRoot, ['rev-parse', '--show-toplevel'])).trim();
    const [logOut, branchOut, statusOut, stashOut, headOut, symOut] = await Promise.all([
      git(root, [
        'log',
        '--all',
        '--date-order',
        `--max-count=${this.maxCommits}`,
        `--format=%H${SEP}%P${SEP}%an${SEP}%at${SEP}%s${SEP}%D`,
      ]).catch(() => ''),
      git(root, [
        'for-each-ref',
        '--sort=-committerdate',
        `--format=%(refname)${SEP}%(objectname)${SEP}%(HEAD)${SEP}%(upstream:short)${SEP}%(upstream:track)`,
        'refs/heads',
        'refs/remotes',
      ]).catch(() => ''),
      git(root, ['status', '--porcelain=v1', '--untracked-files=normal']).catch(() => ''),
      git(root, ['stash', 'list']).catch(() => ''),
      git(root, ['rev-parse', 'HEAD']).catch(() => ''),
      git(root, ['symbolic-ref', '--short', '-q', 'HEAD']).catch(() => ''),
    ]);

    const branches = parseBranches(
      branchOut
        .split('\n')
        .map((l) => {
          // Normalise refs/heads/x -> x, refs/remotes/origin/x -> remotes/origin/x so the parser can tell them apart.
          if (l.startsWith('refs/heads/')) return l.slice('refs/heads/'.length);
          if (l.startsWith('refs/remotes/')) return 'remotes/' + l.slice('refs/remotes/'.length);
          return l;
        })
        .join('\n'),
    );

    const head = headOut.trim() || null;
    const currentBranch = symOut.trim() || null;
    this.snapshot = {
      root,
      head,
      currentBranch,
      detached: !!head && !currentBranch,
      commits: parseLog(logOut),
      branches,
      status: parseStatus(statusOut),
      stashCount: stashOut.split('\n').filter((l) => l.trim()).length,
    };
    this.emit('snapshot', this.snapshot);
    return this.snapshot;
  }

  /** Watches .git internals and the working tree index, debounced. */
  async watch(): Promise<void> {
    if (!(await this.isRepo())) return;
    const root = (await git(this.projectRoot, ['rev-parse', '--show-toplevel'])).trim();
    const gitDir = (await git(root, ['rev-parse', '--git-dir'])).trim();
    const abs = path.isAbsolute(gitDir) ? gitDir : path.join(root, gitDir);
    const targets = ['HEAD', 'ORIG_HEAD', 'index', 'packed-refs', 'refs', 'logs/HEAD']
      .map((t) => path.join(abs, t))
      .filter((p) => fs.existsSync(p) || p.endsWith('refs'));
    this.watcher = chokidar.watch(targets, { ignoreInitial: true, persistent: true, depth: 6 });
    this.watcher.on('all', () => this.scheduleRefresh());
  }

  scheduleRefresh(delay = 250): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.refresh().catch((e) => this.emit('error', e)), delay);
  }

  async close(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    await this.watcher?.close();
  }
}
