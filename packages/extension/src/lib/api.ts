import type { ExtHello, GuideRequest, GuideResponse, GuideStreamMessage } from '@pixelweb/shared';
import { sseParser } from './sse';

/** Where PixelWeb is and the pairing token made in its 设置 → 浏览器插件. */
export interface ServerConfig {
  origin: string;
  token: string;
}

/**
 * The PixelWeb address as an origin. Takes what people paste: a full URL,
 * host:port, or a bare port for this machine. Null if it isn't an http(s) address.
 */
export function serverOrigin(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (/^\d{1,5}$/.test(s)) s = `127.0.0.1:${s}`;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `http://${s}`;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
}

/** The host permission that lets the side panel call this origin. */
export const originPattern = (origin: string) => `${origin}/*`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const UNAUTHORIZED = '配对 token 无效或已撤销：到 PixelWeb 的 设置 → 浏览器插件 重新生成一个。';

async function call<T>(cfg: ServerConfig, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(cfg.origin + path, {
      method,
      headers: { authorization: `Bearer ${cfg.token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(`连不上 PixelWeb（${cfg.origin}）：地址对吗？服务开着吗？`, 0);
  }
  if (res.status === 401) throw new ApiError(UNAUTHORIZED, 401);
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? `PixelWeb 返回了 ${res.status}`, res.status);
  return data as T;
}

const guidePath = (id: string, rest = '') => `/api/ext/guide/${encodeURIComponent(id)}${rest}`;

export const hello = (cfg: ServerConfig) => call<ExtHello>(cfg, 'GET', '/api/ext/hello');
export const startGuide = (cfg: ServerConfig, req: GuideRequest) => call<GuideResponse>(cfg, 'POST', '/api/ext/guide', req);
export const promptGuide = (cfg: ServerConfig, id: string, req: GuideRequest) => call<unknown>(cfg, 'POST', guidePath(id, '/prompt'), req);
export const abortGuide = (cfg: ServerConfig, id: string) => call<unknown>(cfg, 'POST', guidePath(id, '/abort'));

/**
 * Follows one guide session until the server closes the stream or `signal`
 * aborts it. Read with fetch because EventSource can't send the token.
 */
export async function streamGuide(cfg: ServerConfig, id: string, onMessage: (m: GuideStreamMessage) => void, signal: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch(cfg.origin + guidePath(id, '/events'), { headers: { authorization: `Bearer ${cfg.token}`, accept: 'text/event-stream' }, signal });
  } catch (e) {
    if (signal.aborted) throw e;
    throw new ApiError(`连不上 PixelWeb（${cfg.origin}）`, 0);
  }
  if (res.status === 401) throw new ApiError(UNAUTHORIZED, 401);
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(data.error ?? `PixelWeb 返回了 ${res.status}`, res.status);
  }
  const push = sseParser((data) => {
    try {
      onMessage(JSON.parse(data) as GuideStreamMessage);
    } catch {
      /* a frame we don't understand: skip it */
    }
  });
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    push(value);
  }
}
