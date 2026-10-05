import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ArchEdge, ArchGraph, ArchNode } from '@pixelweb/shared';

/**
 * Lightweight import-graph extraction for TS/JS and Python.
 *
 * Deliberately regex based: PixelWeb wants a picture that is "right enough to
 * teach with" in under a second on a mid-sized repo, not a compiler-grade
 * analysis. Swap in a real parser per language later behind the same shape.
 */

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.nuxt', '.turbo', '.cache',
  '__pycache__', '.venv', 'venv', 'env', '.mypy_cache', '.pytest_cache', 'target', 'vendor', '.idea', '.vscode',
]);

const TS_EXT = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const PY_EXT = ['.py'];

export function languageOf(file: string): ArchNode['language'] {
  const ext = path.extname(file);
  if (['.ts', '.tsx', '.mts', '.cts'].includes(ext)) return 'ts';
  if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'js';
  if (ext === '.py') return 'py';
  return 'other';
}

// ---- Import extraction (pure, tested) ----------------------------------------

const JS_IMPORT_RE =
  /(?:^|[^\w$.])(?:import\s+(?:[\w*{}\s,$]+?\s+from\s+)?|export\s+(?:[\w*{}\s,$]+?\s+)?from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"\n]+)['"]/g;

export function extractJsImports(source: string): string[] {
  const out: string[] = [];
  const src = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  let m: RegExpExecArray | null;
  JS_IMPORT_RE.lastIndex = 0;
  while ((m = JS_IMPORT_RE.exec(src))) out.push(m[1]);
  return out;
}

const PY_IMPORT_RE = /^\s*(?:from\s+([.\w]+)\s+import\s+|import\s+([\w.]+(?:\s*,\s*[\w.]+)*))/gm;

export function extractPyImports(source: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  PY_IMPORT_RE.lastIndex = 0;
  while ((m = PY_IMPORT_RE.exec(source))) {
    if (m[1]) out.push(m[1]);
    else if (m[2]) out.push(...m[2].split(',').map((s) => s.trim()).filter(Boolean));
  }
  return out;
}

// ---- Resolution --------------------------------------------------------------

export interface WorkspaceEntry {
  /** package directory, repo-relative, e.g. "packages/shared" */
  dir: string;
  /** source entry file, repo-relative, e.g. "packages/shared/src/index.ts" */
  entry: string;
}
/** package name → where it lives, for workspace (monorepo) packages */
export type WorkspaceMap = Map<string, WorkspaceEntry>;

/** "@scope/pkg/sub/path" → "@scope/pkg"; "pkg/sub" → "pkg". Bare specifiers only. */
function packageNameOf(spec: string): string {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

export function resolveJs(fromFile: string, spec: string, files: Set<string>, workspaces?: WorkspaceMap): string | null {
  if (!spec.startsWith('.') && !spec.startsWith('/')) {
    // workspace package (monorepo) → its entry file. O(1): look the package name up directly.
    const name = packageNameOf(spec);
    const ws = workspaces?.get(name);
    if (!ws) return null; // bare → external
    if (spec === name) return files.has(ws.entry) ? ws.entry : null;
    const sub = spec.slice(name.length + 1);
    const fromPkg = ws.dir + '/package.json';
    return resolveJs(fromPkg, './' + sub, files) ?? resolveJs(fromPkg, './src/' + sub, files);
  }
  const clean = spec.replace(/\?.*$/, '');
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), clean));
  const candidates = [base];
  // "./foo.js" written in TS ESM style may map to foo.ts
  if (/\.(m|c)?js$/.test(base)) candidates.push(base.replace(/\.(m|c)?js$/, '.ts'), base.replace(/\.(m|c)?js$/, '.tsx'));
  for (const ext of TS_EXT) candidates.push(base + ext);
  for (const ext of TS_EXT) candidates.push(path.posix.join(base, 'index' + ext));
  for (const c of candidates) if (files.has(c)) return c;
  return null;
}

export function resolvePy(fromFile: string, spec: string, files: Set<string>): string | null {
  const dots = /^\.*/.exec(spec)?.[0].length ?? 0;
  const rest = spec.slice(dots);
  let baseDir: string;
  if (dots > 0) {
    baseDir = path.posix.dirname(fromFile);
    for (let i = 1; i < dots; i++) baseDir = path.posix.dirname(baseDir);
  } else {
    baseDir = '';
  }
  const parts = rest ? rest.split('.') : [];
  // try progressively shorter module paths: a.b.c -> a/b/c.py, a/b/c/__init__.py, a/b.py ...
  for (let n = parts.length; n >= (dots > 0 ? 0 : 1); n--) {
    const rel = path.posix.join(baseDir, ...parts.slice(0, n));
    for (const c of [rel + '.py', path.posix.join(rel, '__init__.py')]) {
      if (files.has(c)) return c;
    }
  }
  return null;
}

export function externalName(spec: string, lang: ArchNode['language']): string {
  if (lang === 'py') return spec.split('.')[0];
  if (spec.startsWith('@')) return spec.split('/').slice(0, 2).join('/');
  return spec.split('/')[0];
}

// ---- Walking -----------------------------------------------------------------

const execFileP = promisify(execFile);

/**
 * What git ignores under `root` (build output, caches…), as root-relative
 * paths; a wholly ignored directory is one entry ending in "/". Empty when
 * `root` isn't in a git work tree. Catches generated files the size check in
 * `isGenerated` can't: a bundler's small split chunks look like short source.
 */
export async function gitIgnored(root: string): Promise<Set<string>> {
  try {
    const { stdout } = await execFileP('git', ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'], {
      cwd: root,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 10_000,
    });
    return new Set(stdout.split('\0').filter(Boolean));
  } catch {
    return new Set();
  }
}

async function walk(root: string, maxFiles: number): Promise<{ files: string[]; skipped: number }> {
  const ignored = await gitIgnored(root);
  const files: string[] = [];
  let skipped = 0;
  const stack = [''];
  while (stack.length) {
    const rel = stack.pop()!;
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(path.join(root, rel), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      const relPath = rel ? path.posix.join(rel, e.name) : e.name;
      if (e.isDirectory()) {
        if (IGNORED_DIRS.has(e.name) || e.name.startsWith('.') || ignored.has(relPath + '/')) continue;
        stack.push(relPath);
      } else if (e.isFile()) {
        const ext = path.extname(e.name);
        if (!TS_EXT.includes(ext) && !PY_EXT.includes(ext)) continue;
        if (/\.d\.ts$/.test(e.name) || ignored.has(relPath)) continue;
        if (files.length >= maxFiles) {
          skipped++;
          continue;
        }
        files.push(relPath);
      }
    }
  }
  return { files, skipped };
}

export interface AnalyseOptions {
  level?: 'file' | 'dir';
  maxFiles?: number;
  /** collapse directories deeper than this (dir level only) */
  dirDepth?: number;
  /** keep the N most-referenced external packages */
  maxExternals?: number;
}

export async function analyseProject(root: string, opts: AnalyseOptions = {}): Promise<ArchGraph> {
  const level = opts.level ?? 'dir';
  const walked = await walk(root, opts.maxFiles ?? 4000);
  let skipped = walked.skipped;

  // Pass 1: read everything and drop what we will not draw (generated blobs, unreadable files),
  // so that nothing below can resolve an import onto a file that has no node.
  const sources = new Map<string, string>();
  for (const file of walked.files) {
    let src: string;
    try {
      src = await fs.readFile(path.join(root, file), 'utf8');
    } catch {
      skipped++;
      continue;
    }
    if (isGenerated(src, src.split('\n').length)) {
      skipped++;
      continue;
    }
    sources.set(file, src);
  }
  const files = [...sources.keys()];
  const fileSet = new Set(files);
  const workspaces = await loadWorkspaces(root, fileSet);

  // Pass 2: edges
  const loc = new Map<string, number>();
  const edges = new Map<string, ArchEdge>();
  const externals = new Map<string, number>();
  let imports = 0; // dependencies actually drawn (internal edges + external packages)

  const addEdge = (s: string, t: string) => {
    if (s === t) return;
    const key = s + '\u0000' + t;
    const e = edges.get(key);
    if (e) e.weight++;
    else edges.set(key, { source: s, target: t, weight: 1 });
  };

  const groupOf = (file: string) => (level === 'file' ? file : dirGroup(file, opts.dirDepth ?? 2));

  for (const [file, src] of sources) {
    loc.set(file, src.split('\n').length);
    const lang = languageOf(file);
    const specs = lang === 'py' ? extractPyImports(src) : extractJsImports(src);
    for (const spec of specs) {
      const target = lang === 'py' ? resolvePy(file, spec, fileSet) : resolveJs(file, spec, fileSet, workspaces);
      if (target) {
        imports++;
        addEdge(groupOf(file), groupOf(target));
      } else if (spec.startsWith('.') || spec.startsWith('/')) {
        continue; // unresolved relative (css, json, images, skipped bundles…) → not a dependency edge
      } else {
        imports++;
        const name = externalName(spec, lang);
        externals.set(name, (externals.get(name) ?? 0) + 1);
        addEdge(groupOf(file), 'ext:' + name);
      }
    }
  }

  // nodes
  const nodes = new Map<string, ArchNode>();
  for (const file of files) {
    const id = groupOf(file);
    const n = nodes.get(id);
    if (n) {
      n.loc += loc.get(file) ?? 0;
      n.fileCount = (n.fileCount ?? 0) + 1;
    } else {
      nodes.set(id, {
        id,
        label: level === 'file' ? path.posix.basename(file) : id || '(root)',
        kind: level === 'file' ? 'file' : 'dir',
        language: level === 'file' ? languageOf(file) : undefined,
        loc: loc.get(file) ?? 0,
        fileCount: 1,
      });
    }
  }
  // keep the N most-referenced externals; the rest are not drawn, so they are not counted either
  const ranked = [...externals.entries()].sort((a, b) => b[1] - a[1]);
  const keepExt = new Set(ranked.slice(0, opts.maxExternals ?? 12).map(([n]) => n));
  for (const [name, count] of ranked) {
    if (keepExt.has(name)) nodes.set('ext:' + name, { id: 'ext:' + name, label: name, kind: 'external', loc: 0 });
    else imports -= count;
  }

  // self-edges were never recorded; every remaining edge now has both endpoints
  const finalEdges = [...edges.values()].filter((e) => nodes.has(e.source) && nodes.has(e.target));

  return {
    root,
    level,
    nodes: [...nodes.values()],
    edges: finalEdges,
    generatedAt: Date.now(),
    stats: { files: files.length, imports, externals: externals.size, skipped },
  };
}

/** Minified bundles and other generated blobs: very few, very long lines. Not worth a node. */
export function isGenerated(src: string, lineCount: number): boolean {
  if (src.length < 20_000) return false;
  return src.length / Math.max(lineCount, 1) > 400;
}

/** Reads package.json of every workspace package and maps its name to a source entry file. */
export async function loadWorkspaces(root: string, files: Set<string>): Promise<WorkspaceMap> {
  const map: WorkspaceMap = new Map();
  let rootPkg: { workspaces?: unknown[] | { packages?: unknown[] } } | null = null;
  try {
    rootPkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  } catch {
    return map;
  }
  const raw = Array.isArray(rootPkg?.workspaces) ? rootPkg.workspaces : Array.isArray(rootPkg?.workspaces?.packages) ? rootPkg.workspaces.packages : [];
  // npm/yarn/pnpm accept globs and "!negations"; we support the common "dir" and "dir/*" shapes and skip the rest safely
  const strings = raw.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map((p) => p.trim().replace(/\/+$/, ''));
  const negated = new Set(strings.filter((p) => p.startsWith('!')).map((p) => p.slice(1).replace(/^\.\//, '')));
  const patterns = strings.filter((p) => !p.startsWith('!'));
  for (const pattern of patterns) {
    const base = pattern.replace(/\/?\*+$/, '');
    let dirs: string[] = [];
    try {
      dirs = pattern.endsWith('*')
        ? (await fs.readdir(path.join(root, base), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => path.posix.join(base, d.name))
        : [base];
    } catch {
      continue;
    }
    for (const dir of dirs) {
      if (negated.has(dir)) continue;
      try {
        const pkg = JSON.parse(await fs.readFile(path.join(root, dir, 'package.json'), 'utf8')) as {
          name?: string;
          main?: string;
          types?: string;
          exports?: string | Record<string, string | Record<string, string>>;
        };
        if (!pkg.name) continue;
        const candidates: string[] = [];
        const dot = typeof pkg.exports === 'string' ? pkg.exports : pkg.exports?.['.'];
        if (typeof dot === 'string') candidates.push(dot);
        else if (dot && typeof dot === 'object') candidates.push(...Object.values(dot).filter((v): v is string => typeof v === 'string'));
        if (pkg.types) candidates.push(pkg.types);
        if (pkg.main) candidates.push(pkg.main);
        candidates.push('src/index.ts', 'src/index.tsx', 'index.ts', 'src/main.ts');
        for (const c of candidates) {
          const rel = path.posix.normalize(path.posix.join(dir, c));
          const resolved = files.has(rel) ? rel : resolveJs(dir + '/package.json', './' + path.posix.relative(dir, rel), files);
          if (resolved) {
            map.set(pkg.name, { dir, entry: resolved });
            break;
          }
        }
      } catch {
        /* not a package */
      }
    }
  }
  return map;
}

export function dirGroup(file: string, depth: number): string {
  const dir = path.posix.dirname(file);
  if (dir === '.') return '';
  const parts = dir.split('/');
  // keep monorepo layout readable: packages/<name>/src/... → packages/<name>/src
  return parts.slice(0, Math.max(depth, parts[0] === 'packages' || parts[0] === 'apps' ? 3 : depth)).join('/');
}
