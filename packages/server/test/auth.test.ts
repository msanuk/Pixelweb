import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { COOKIE, parseCookies, registerAuth } from '../src/auth.js';
import { loadConfig } from '../src/config.js';

const HOST = 'pixelweb.test:7420';

const DEVICE = { id: 'd1', name: 'Chrome', createdAt: 0 };
const extTokens = { verify: (t: string) => (t === 'pwx_good' ? DEVICE : null) };

async function makeApp(password?: string): Promise<FastifyInstance> {
  const app = Fastify();
  registerAuth(app, password, extTokens);
  app.get('/api/secret', async () => ({ secret: 1 }));
  app.post('/api/act', async () => ({ ok: true }));
  app.get('/ws', async () => ({ upgraded: true }));
  app.post('/api/ext/act', async (req) => ({ device: req.extToken?.name }));
  app.post('/api/ext-tokens', async () => ({ created: true }));
  await app.ready();
  return app;
}

let app: FastifyInstance;
afterEach(() => app?.close());

describe('origin check (no password)', () => {
  it('allows same-origin and header-less requests', async () => {
    app = await makeApp();
    expect((await app.inject({ method: 'GET', url: '/api/secret', headers: { host: HOST } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/act', headers: { host: HOST, origin: `http://${HOST}` } })).statusCode).toBe(200);
  });

  it('refuses cross-origin writes and websocket handshakes', async () => {
    app = await makeApp();
    const evil = { host: HOST, origin: 'https://evil.example' };
    expect((await app.inject({ method: 'POST', url: '/api/act', headers: evil })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/ws', headers: evil })).statusCode).toBe(403);
  });

  it('accepts the public host from a reverse proxy that rewrites Host', async () => {
    app = await makeApp();
    const headers = { host: '127.0.0.1:7420', origin: 'https://pixelweb.example', 'x-forwarded-host': 'pixelweb.example' };
    expect((await app.inject({ method: 'POST', url: '/api/act', headers })).statusCode).toBe(200);
  });

  it('reports that no login is needed', async () => {
    app = await makeApp();
    expect((await app.inject({ method: 'GET', url: '/api/auth' })).json()).toEqual({ required: false, authenticated: true });
  });
});

describe('password login', () => {
  const login = (password: string) =>
    app.inject({ method: 'POST', url: '/api/login', headers: { host: HOST }, payload: { password } });

  it('blocks api and ws without a session, but not static files', async () => {
    app = await makeApp('s3cret');
    expect((await app.inject({ method: 'GET', url: '/api/secret' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/ws' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/index.html' })).statusCode).toBe(404); // reached routing, not refused
    expect((await app.inject({ method: 'GET', url: '/api/auth' })).json()).toEqual({ required: true, authenticated: false });
  });

  it('guards the route the request reaches, however its path is spelled', async () => {
    app = await makeApp('s3cret');
    for (const url of ['/%61pi/secret', '/api/%73ecret', '/%61pi/secret?x=1', '/w%73']) {
      expect((await app.inject({ method: 'GET', url })).statusCode, url).toBe(401);
    }
    const evil = { host: HOST, origin: 'https://evil.example' };
    expect((await app.inject({ method: 'POST', url: '/%61pi/act', headers: evil })).statusCode).toBe(403);
  });

  it('issues an HttpOnly SameSite cookie on the right password and accepts it', async () => {
    app = await makeApp('s3cret');
    expect((await login('wrong')).statusCode).toBe(401);
    const ok = await login('s3cret');
    expect(ok.statusCode).toBe(200);
    const setCookie = String(ok.headers['set-cookie']);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    const token = parseCookies(setCookie.split(';')[0])[COOKIE];
    const cookie = `${COOKIE}=${token}`;
    expect((await app.inject({ method: 'GET', url: '/api/secret', headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/ws', headers: { cookie } })).statusCode).toBe(200);

    await app.inject({ method: 'POST', url: '/api/logout', headers: { cookie, host: HOST } });
    expect((await app.inject({ method: 'GET', url: '/api/secret', headers: { cookie } })).statusCode).toBe(401);
  });

  it('rate-limits repeated failures even if the right password follows', async () => {
    app = await makeApp('s3cret');
    for (let i = 0; i < 10; i++) await login('nope');
    expect((await login('s3cret')).statusCode).toBe(429);
  });
});

describe('extension token', () => {
  const EXT_ORIGIN = 'chrome-extension://abcdefghijklmnop';
  const bearer = (token: string) => ({ host: HOST, origin: EXT_ORIGIN, authorization: `Bearer ${token}` });

  for (const password of [undefined, 's3cret']) {
    it(`opens /api/ext/* from the extension's origin, with${password ? '' : 'out'} --password`, async () => {
      app = await makeApp(password);
      const ok = await app.inject({ method: 'POST', url: '/api/ext/act', headers: bearer('pwx_good') });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toEqual({ device: 'Chrome' });
      expect((await app.inject({ method: 'POST', url: '/%61pi/ext/act', headers: bearer('pwx_good') })).statusCode).toBe(200);
    });
  }

  it('needs a valid token there, even on a same-origin request', async () => {
    app = await makeApp();
    expect((await app.inject({ method: 'POST', url: '/api/ext/act', headers: bearer('pwx_bad') })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/ext/act', headers: { host: HOST, origin: `http://${HOST}` } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/%61pi/ext/act', headers: { host: HOST } })).statusCode).toBe(401);
  });

  it('opens nothing outside /api/ext/', async () => {
    app = await makeApp('s3cret');
    expect((await app.inject({ method: 'POST', url: '/api/act', headers: bearer('pwx_good') })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/ws', headers: bearer('pwx_good') })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/secret', headers: { authorization: 'Bearer pwx_good' } })).statusCode).toBe(401);
    // pairing a new token is PixelWeb's own UI: cookie and Origin, not a token
    expect((await app.inject({ method: 'POST', url: '/api/ext-tokens', headers: { host: HOST, authorization: 'Bearer pwx_good' } })).statusCode).toBe(401);
  });
});

describe('config', () => {
  it('reads opencode username and PixelWeb password from flags and env', () => {
    expect(loadConfig([], {}).opencodeUsername).toBe('opencode');
    expect(loadConfig(['--opencode-username', 'me'], {}).opencodeUsername).toBe('me');
    expect(loadConfig([], { OPENCODE_SERVER_USERNAME: 'env-user' }).opencodeUsername).toBe('env-user');
    expect(loadConfig(['--password=pw'], {}).password).toBe('pw');
    expect(loadConfig([], { PIXELWEB_PASSWORD: 'pw2' }).password).toBe('pw2');
  });
});
