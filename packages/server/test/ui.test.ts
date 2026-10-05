import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerUi } from '../src/ui.js';

const tmp: string[] = [];
afterEach(() => {
  for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

async function build(publicDir: string) {
  const app = Fastify();
  await registerUi(app, publicDir);
  app.get('/api/ping', async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe('registerUi', () => {
  it('serves the UI that gets built after the server started, without a restart', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-ui-'));
    tmp.push(dir);
    const publicDir = path.join(dir, 'public'); // does not exist yet: fresh clone, npm run dev
    const app = await build(publicDir);

    const before = await app.inject({ url: '/' });
    expect(before.statusCode).toBe(503);
    expect(before.body).toMatch(/not built/i);

    fs.mkdirSync(path.join(publicDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(publicDir, 'index.html'), '<!doctype html><title>PixelWeb</title>');
    fs.writeFileSync(path.join(publicDir, 'assets', 'app.js'), 'console.log(1)');

    const after = await app.inject({ url: '/' });
    expect(after.statusCode).toBe(200);
    expect(after.body).toContain('PixelWeb');
    const asset = await app.inject({ url: '/assets/app.js' });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['content-type']).toMatch(/javascript/);
    // SPA fallback for client routes
    const deep = await app.inject({ url: '/knowledge/webhook' });
    expect(deep.statusCode).toBe(200);
    expect(deep.body).toContain('PixelWeb');
    await app.close();
  });

  it('keeps /api and /ws out of the SPA fallback', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-ui-'));
    tmp.push(dir);
    const publicDir = path.join(dir, 'public');
    fs.mkdirSync(publicDir);
    fs.writeFileSync(path.join(publicDir, 'index.html'), '<html></html>');
    const app = await build(publicDir);
    expect((await app.inject({ url: '/api/ping' })).json()).toEqual({ ok: true });
    const missing = await app.inject({ url: '/api/nope' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: 'not found' });
    expect((await app.inject({ url: '/ws' })).statusCode).toBe(404);
    await app.close();
  });
});
