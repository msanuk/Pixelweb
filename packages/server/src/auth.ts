import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Access control for the PixelWeb server.
 *
 * - Origin check (always on): state-changing requests and the WebSocket
 *   handshake must come from the page PixelWeb itself serves. This stops other
 *   websites from driving the agent through a PixelWeb running on localhost.
 * - Password (optional, --password): a login sets an HttpOnly session cookie;
 *   every /api and /ws request then needs that cookie. Static UI files stay
 *   public so the browser can load the login screen — they hold no data.
 */

export const COOKIE = 'pixelweb_session';
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const PUBLIC_API = new Set(['/api/auth', '/api/login']);

export class SessionStore {
  private readonly sessions = new Map<string, number>(); // token -> expiresAt
  private readonly digest: Buffer;

  constructor(password: string) {
    this.digest = sha256(password);
  }

  /** Constant-time comparison (both sides hashed to equal length first). */
  checkPassword(candidate: string): boolean {
    return crypto.timingSafeEqual(sha256(candidate), this.digest);
  }

  create(now = Date.now()): string {
    const token = crypto.randomBytes(32).toString('base64url');
    this.sessions.set(token, now + SESSION_TTL_MS);
    return token;
  }

  isValid(token: string | undefined, now = Date.now()): boolean {
    if (!token) return false;
    const exp = this.sessions.get(token);
    if (exp === undefined) return false;
    if (exp < now) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  revoke(token: string | undefined): void {
    if (token) this.sessions.delete(token);
  }
}

/** Per-IP failed-login counter, so a password can't be brute-forced. */
export class LoginLimiter {
  private readonly failures = new Map<string, { count: number; resetAt: number }>();

  blocked(ip: string, now = Date.now()): boolean {
    const f = this.failures.get(ip);
    if (!f || f.resetAt < now) return false;
    return f.count >= MAX_FAILURES;
  }

  fail(ip: string, now = Date.now()): void {
    const f = this.failures.get(ip);
    if (!f || f.resetAt < now) this.failures.set(ip, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
    else f.count++;
  }

  succeed(ip: string): void {
    this.failures.delete(ip);
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[k] = part.slice(i + 1).trim();
    }
  }
  return out;
}

/**
 * True when the request's Origin (if any) is the host PixelWeb is being served from.
 * Behind a reverse proxy that rewrites Host, X-Forwarded-Host carries the public one;
 * a web page can't forge it (custom headers need a CORS preflight, which we never grant).
 */
export function sameOrigin(req: FastifyRequest): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients (curl) and same-origin GETs may omit it
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const fwd = req.headers['x-forwarded-host'];
  const forwarded = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0].trim();
  return originHost === req.headers.host || (!!forwarded && originHost === forwarded);
}

function sha256(s: string): Buffer {
  return crypto.createHash('sha256').update(s, 'utf8').digest();
}

function isHttps(req: FastifyRequest): boolean {
  return req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
}

function sessionCookie(req: FastifyRequest, value: string, maxAgeSec: number): string {
  return [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSec}`, ...(isHttps(req) ? ['Secure'] : [])].join('; ');
}

export function registerAuth(app: FastifyInstance, password: string | undefined): void {
  const store = password ? new SessionStore(password) : null;
  const limiter = new LoginLimiter();
  const tokenOf = (req: FastifyRequest) => parseCookies(req.headers.cookie)[COOKIE];

  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const url = req.raw.url ?? '/';
    const isWs = url === '/ws' || url.startsWith('/ws?');
    const isApi = url.startsWith('/api/') || url === '/api';
    if (!isWs && !isApi) return; // static UI

    if ((isWs || req.method !== 'GET') && !sameOrigin(req)) {
      return reply.code(403).send({ error: 'cross-origin request refused' });
    }
    if (!store) return;
    const path = url.split('?')[0];
    if (PUBLIC_API.has(path)) return;
    if (!store.isValid(tokenOf(req))) return reply.code(401).send({ error: 'login required' });
  });

  app.get('/api/auth', async (req) => ({
    required: !!store,
    authenticated: !store || store.isValid(tokenOf(req)),
  }));

  app.post<{ Body: { password?: string } }>('/api/login', async (req, reply) => {
    if (!store) return { ok: true };
    if (limiter.blocked(req.ip)) return reply.code(429).send({ error: '尝试次数过多，请 15 分钟后再试' });
    if (typeof req.body?.password !== 'string' || !store.checkPassword(req.body.password)) {
      limiter.fail(req.ip);
      return reply.code(401).send({ error: '密码不对' });
    }
    limiter.succeed(req.ip);
    reply.header('set-cookie', sessionCookie(req, store.create(), SESSION_TTL_MS / 1000));
    return { ok: true };
  });

  app.post('/api/logout', async (req, reply) => {
    store?.revoke(tokenOf(req));
    reply.header('set-cookie', sessionCookie(req, '', 0));
    return { ok: true };
  });
}
