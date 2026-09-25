import { describe, expect, it } from 'vitest';
import { dirGroup, extractJsImports, extractPyImports, externalName, resolveJs, resolvePy } from '../src/analysis/deps.js';

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
