import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { analyseProject, gitIgnored, dirGroup, extractJsImports, extractPyImports, externalName, isGenerated, loadWorkspaces, resolveJs, resolvePy } from '../src/analysis/deps.js';
import path from 'node:path';

describe('extractJsImports', () => {
  it('finds static, dynamic, re-export and require imports, ignoring comments', () => {
    const src = `
      import a from './a';
      import { b } from "../b.js";
      import type { T } from './types';
      export * from './re';
      const c = require('c-pkg');
      const d = await import('./lazy');
      // import x from './commented-out';
      /* import y from './also-commented'; */
      const url = 'http://example.com/not-an-import';
    `;
    expect(extractJsImports(src)).toEqual(['./a', '../b.js', './types', './re', 'c-pkg', './lazy']);
  });
});

describe('extractPyImports', () => {
  it('finds from-imports and plain imports', () => {
    const src = `import os, sys\nfrom .sibling import thing\nfrom pkg.mod import x\nimport numpy as np\n`;
    expect(extractPyImports(src)).toEqual(['os', 'sys', '.sibling', 'pkg.mod', 'numpy']);
  });
});

describe('resolveJs', () => {
  const files = new Set(['src/a.ts', 'src/b/index.ts', 'src/c.tsx', 'src/d.js']);
  it('resolves extensions, index files and .js→.ts', () => {
    expect(resolveJs('src/main.ts', './a', files)).toBe('src/a.ts');
    expect(resolveJs('src/main.ts', './a.js', files)).toBe('src/a.ts');
    expect(resolveJs('src/main.ts', './b', files)).toBe('src/b/index.ts');
    expect(resolveJs('src/main.ts', './c', files)).toBe('src/c.tsx');
    expect(resolveJs('src/main.ts', './d.js', files)).toBe('src/d.js');
    expect(resolveJs('src/main.ts', 'react', files)).toBeNull();
    expect(resolveJs('src/main.ts', './missing', files)).toBeNull();
  });
});

describe('resolvePy', () => {
  const files = new Set(['app/__init__.py', 'app/core/db.py', 'app/core/__init__.py', 'app/main.py']);
  it('resolves relative and absolute module paths', () => {
    expect(resolvePy('app/main.py', '.core.db', files)).toBe('app/core/db.py');
    expect(resolvePy('app/core/db.py', '..main', files)).toBe('app/main.py');
    expect(resolvePy('app/main.py', 'app.core', files)).toBe('app/core/__init__.py');
    expect(resolvePy('app/main.py', 'app.core.db.Session', files)).toBe('app/core/db.py');
    expect(resolvePy('app/main.py', 'numpy', files)).toBeNull();
  });
});

describe('resolveJs with workspaces', () => {
  const files = new Set(['packages/shared/src/index.ts', 'packages/shared/src/util.ts', 'packages/server/src/index.ts']);
  const ws = new Map([['@acme/shared', { dir: 'packages/shared', entry: 'packages/shared/src/index.ts' }]]);
  it('maps workspace package names to their entry and subpaths', () => {
    expect(resolveJs('packages/server/src/index.ts', '@acme/shared', files, ws)).toBe('packages/shared/src/index.ts');
    expect(resolveJs('packages/server/src/index.ts', '@acme/shared/util', files, ws)).toBe('packages/shared/src/util.ts');
    expect(resolveJs('packages/server/src/index.ts', '@acme/shared/src/util', files, ws)).toBe('packages/shared/src/util.ts');
    expect(resolveJs('packages/server/src/index.ts', '@acme/other', files, ws)).toBeNull();
    expect(resolveJs('packages/server/src/index.ts', '@acme/shared-extras', files, ws)).toBeNull();
  });
  it('does not assume a packages/<name> layout', () => {
    const flat = new Set(['shared/src/index.ts', 'shared/src/util.ts', 'apps/web/libs/ui/src/index.ts', 'apps/web/libs/ui/src/button.tsx']);
    const flatWs = new Map([
      ['@acme/shared', { dir: 'shared', entry: 'shared/src/index.ts' }],
      ['@acme/ui', { dir: 'apps/web/libs/ui', entry: 'apps/web/libs/ui/src/index.ts' }],
    ]);
    expect(resolveJs('server/src/index.ts', '@acme/shared/src/util', flat, flatWs)).toBe('shared/src/util.ts');
    expect(resolveJs('server/src/index.ts', '@acme/shared/util', flat, flatWs)).toBe('shared/src/util.ts');
    expect(resolveJs('server/src/index.ts', '@acme/ui/button', flat, flatWs)).toBe('apps/web/libs/ui/src/button.tsx');
    expect(resolveJs('server/src/index.ts', 'lodash/fp', flat, flatWs)).toBeNull();
  });
});

describe('isGenerated', () => {
  it('flags minified bundles but not ordinary long files', () => {
    expect(isGenerated('x'.repeat(50_000), 3)).toBe(true);
    expect(isGenerated(Array.from({ length: 2000 }, () => 'const a = 1; // ordinary line of code').join('\n'), 2000)).toBe(false);
    expect(isGenerated('short', 1)).toBe(false);
  });
});

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** Writes a small monorepo fixture and returns its root. */
function fixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-deps-'));
  tmpDirs.push(root);
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  return root;
}

const MINIFIED = 'var a=' + '1'.repeat(30_000) + ';\n';

describe('analyseProject on a monorepo fixture', () => {
  const monorepo = () =>
    fixture({
      'package.json': JSON.stringify({ workspaces: ['packages/*/', '!packages/legacy', null] }),
      'packages/shared/package.json': JSON.stringify({ name: '@acme/shared', types: 'src/index.ts' }),
      'packages/shared/src/index.ts': 'export const x = 1;\n',
      'packages/shared/src/util.ts': 'export const u = 2;\n',
      'packages/server/package.json': JSON.stringify({ name: '@acme/server' }),
      'packages/server/src/index.ts': [
        "import { x } from '@acme/shared';",
        "import { u } from '@acme/shared/util';",
        "import Fastify from 'fastify';",
        "import './styles.css';",
        "import './generated/big.min.js';",
        "import { missing } from './nope';",
      ].join('\n'),
      'packages/server/src/generated/big.min.js': MINIFIED,
      'packages/legacy/package.json': JSON.stringify({ name: '@acme/legacy' }),
      'packages/legacy/src/index.ts': "import { x } from '@acme/shared';\n",
    });

  it('links workspace packages, ignores asset imports and generated bundles', async () => {
    const g = await analyseProject(monorepo(), { level: 'file' });
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(ids.has('ext:@acme/shared')).toBe(false);
    expect(ids.has('ext:.')).toBe(false);
    expect(ids.has('ext:fastify')).toBe(true);
    expect([...ids].some((id) => id.endsWith('big.min.js'))).toBe(false);
    const edge = (s: string, t: string) => g.edges.find((e) => e.source === s && e.target === t);
    expect(edge('packages/server/src/index.ts', 'packages/shared/src/index.ts')?.weight).toBe(1);
    expect(edge('packages/server/src/index.ts', 'packages/shared/src/util.ts')?.weight).toBe(1);
    expect(edge('packages/server/src/index.ts', 'ext:fastify')?.weight).toBe(1);
  });

  it('tolerates odd workspaces entries and still maps packages', async () => {
    const ws = await loadWorkspaces(monorepo(), new Set(['packages/shared/src/index.ts', 'packages/legacy/src/index.ts']));
    expect(ws.get('@acme/shared')).toEqual({ dir: 'packages/shared', entry: 'packages/shared/src/index.ts' });
    expect(ws.has('@acme/legacy')).toBe(false); // negated pattern
  });

  it('keeps stats consistent with the graph: no edge targets a missing node, imports counts only drawn edges', async () => {
    const g = await analyseProject(monorepo(), { level: 'file' });
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
    // shared/index, shared/util, server/index, legacy/index — the minified bundle is skipped
    expect(g.stats.files).toBe(4);
    expect(g.stats.skipped).toBe(1);
    // @acme/shared ×2 (server + legacy), @acme/shared/util, fastify → 4; css / minified / unresolved are not dependencies
    expect(g.stats.imports).toBe(4);
    expect(g.stats.imports).toBe(g.edges.reduce((n, e) => n + e.weight, 0));
  });

  it('does not throw on a workspaces field that is not a list of strings', async () => {
    const root = fixture({ 'package.json': JSON.stringify({ workspaces: { packages: [42, 'packages/*'] } }), 'packages/a/package.json': '{"name":"a"}', 'packages/a/index.ts': '' });
    await expect(loadWorkspaces(root, new Set(['packages/a/index.ts']))).resolves.toEqual(new Map([['a', { dir: 'packages/a', entry: 'packages/a/index.ts' }]]));
  });
});

describe('gitIgnored', () => {
  it("drops what git ignores, including a bundler's tiny chunks", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-deps-'));
    try {
      fs.mkdirSync(path.join(root, 'src'));
      fs.mkdirSync(path.join(root, 'web/public/assets'), { recursive: true });
      fs.writeFileSync(path.join(root, '.gitignore'), 'web/public/\nsrc/gen.ts\n');
      fs.writeFileSync(path.join(root, 'src/a.ts'), "import './b';\n");
      fs.writeFileSync(path.join(root, 'src/b.ts'), 'export {};\n');
      fs.writeFileSync(path.join(root, 'src/gen.ts'), 'export {};\n');
      fs.writeFileSync(path.join(root, 'web/main.ts'), "import '../src/a';\n");
      fs.writeFileSync(path.join(root, 'web/public/assets/chunk-Ab12Cd34.js'), 'import{a as e}from"./x-Zz9.js";export{e as t};');
      execFileSync('git', ['init', '-q'], { cwd: root });
      expect([...(await gitIgnored(root))].sort()).toEqual(['src/gen.ts', 'web/public/']);
      const g = await analyseProject(root, { level: 'file' });
      expect(g.nodes.map((n) => n.id).sort()).toEqual(['src/a.ts', 'src/b.ts', 'web/main.ts']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  it('is empty outside a git work tree', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-deps-'));
    try {
      expect((await gitIgnored(root)).size).toBe(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('helpers', () => {
  it('externalName keeps scoped packages and python top-level modules', () => {
    expect(externalName('@fastify/cors', 'ts')).toBe('@fastify/cors');
    expect(externalName('react-dom/client', 'ts')).toBe('react-dom');
    expect(externalName('numpy.linalg', 'py')).toBe('numpy');
  });
  it('dirGroup collapses deep paths but keeps monorepo package names', () => {
    expect(dirGroup('src/git/service.ts', 2)).toBe('src/git');
    expect(dirGroup('src/analysis/deep/x.ts', 2)).toBe('src/analysis');
    expect(dirGroup('packages/server/src/git/service.ts', 2)).toBe('packages/server/src');
    expect(dirGroup('index.ts', 2)).toBe('');
  });
});
