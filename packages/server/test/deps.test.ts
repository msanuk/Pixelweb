import { describe, expect, it } from 'vitest';
import { analyseProject, dirGroup, extractJsImports, extractPyImports, externalName, isGenerated, resolveJs, resolvePy } from '../src/analysis/deps.js';
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
  const ws = new Map([['@acme/shared', 'packages/shared/src/index.ts']]);
  it('maps workspace package names to their entry and subpaths', () => {
    expect(resolveJs('packages/server/src/index.ts', '@acme/shared', files, ws)).toBe('packages/shared/src/index.ts');
    expect(resolveJs('packages/server/src/index.ts', '@acme/shared/util', files, ws)).toBe('packages/shared/src/util.ts');
    expect(resolveJs('packages/server/src/index.ts', '@acme/other', files, ws)).toBeNull();
  });
});

describe('isGenerated', () => {
  it('flags minified bundles but not ordinary long files', () => {
    expect(isGenerated('x'.repeat(50_000), 3)).toBe(true);
    expect(isGenerated(Array.from({ length: 2000 }, () => 'const a = 1; // ordinary line of code').join('\n'), 2000)).toBe(false);
    expect(isGenerated('short', 1)).toBe(false);
  });
});

describe('analyseProject on this repo', () => {
  it('links workspace packages, ignores asset imports and generated bundles', async () => {
    const g = await analyseProject(path.resolve(__dirname, '../../..'), { level: 'file' });
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(ids.has('ext:@pixelweb/shared')).toBe(false);
    expect(ids.has('ext:.')).toBe(false);
    expect(ids.has('ext:..')).toBe(false);
    expect([...ids].some((id) => id.includes('/public/'))).toBe(false);
    expect(g.edges.some((e) => e.source === 'packages/server/src/index.ts' && e.target === 'packages/shared/src/index.ts')).toBe(true);
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
