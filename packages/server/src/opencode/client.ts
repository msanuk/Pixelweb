import { EventEmitter } from 'node:events';
import type { OcEvent, OcMessageWithParts, OcModelLimit, OcSession, PermissionResponse } from '@pixelweb/shared';
import type { OcProject } from '../project.js';

/** A non-2xx answer from OpenCode; `status` lets callers fall back between API versions. */
export class OpencodeHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Minimal, dependency-free client for `opencode serve`.
 *
 * Why not @opencode-ai/sdk? PixelWeb only needs a handful of endpoints and the
 * SSE stream; owning the fetch layer keeps reconnect behaviour and auth simple
 * and makes it easy to add adapters for other agents later.
 */
export interface OpencodeClientOptions {
  baseUrl: string;
  username?: string;
  password?: string;
  /** Sent as `?directory=` so opencode scopes the call to this project. */
  directory?: string;
  verbose?: boolean;
}

export interface GlobalEvent {
  directory?: string;
  payload: OcEvent;
}

export interface PromptInput {
  parts: { type: 'text'; text: string }[];
  system?: string;
  model?: { providerID: string; modelID: string };
  agent?: string;
  variant?: string;
  tools?: Record<string, boolean>;
}

export class OpencodeClient extends EventEmitter {
  private abort?: AbortController;
  private connected = false;
  private stopped = false;
  private backoff = 1000;

  constructor(private readonly opts: OpencodeClientOptions) {
    super();
  }

  get isConnected(): boolean {
    return this.connected;
  }

  /** Re-scopes later REST calls to another project. The SSE stream is global, so it stays connected. */
  setDirectory(directory: string): void {
    this.opts.directory = directory;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const h: Record<string, string> = { accept: 'application/json', ...extra };
    if (this.opts.password) {
      h.authorization = 'Basic ' + Buffer.from(`${this.opts.username ?? 'opencode'}:${this.opts.password}`).toString('base64');
    }
    return h;
  }

  private url(p: string, query: Record<string, string | undefined> = {}): string {
    const u = new URL(p, this.opts.baseUrl + '/');
    if (this.opts.directory) u.searchParams.set('directory', this.opts.directory);
    for (const [k, v] of Object.entries(query)) if (v !== undefined) u.searchParams.set(k, v);
    return u.toString();
  }

  private async json<T>(p: string, init: RequestInit = {}, query?: Record<string, string | undefined>): Promise<T> {
    const res = await fetch(this.url(p, query), {
      ...init,
      headers: this.headers({ 'content-type': 'application/json', ...(init.headers as Record<string, string>) }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new OpencodeHttpError(`opencode ${init.method ?? 'GET'} ${p} -> ${res.status} ${text.slice(0, 200)}`, res.status);
    }
    const ct = res.headers.get('content-type') ?? '';
    return (ct.includes('json') ? await res.json() : (await res.text())) as T;
  }

  // ---- REST -------------------------------------------------------------

  health(): Promise<{ healthy?: boolean; version?: string }> {
    return this.json('global/health');
  }

  path(): Promise<{ worktree: string; directory: string }> {
    return this.json('path');
  }

  /** Configured providers and their models (with token limits). */
  providers(): Promise<{ providers: { id: string; models: Record<string, { id?: string; limit?: OcModelLimit }> }[] }> {
    return this.json('config/providers');
  }

  config(): Promise<{ compaction?: { auto?: boolean; reserved?: number } }> {
    return this.json('config');
  }

  /** Every project OpenCode has opened (≥ 1.x `GET /project`); empty on versions without it. */
  async listProjects(): Promise<OcProject[]> {
    try {
      return await this.json<OcProject[]>('project');
    } catch (e) {
      if (e instanceof OpencodeHttpError && e.status === 404) return [];
      throw e;
    }
  }

  listSessions(): Promise<OcSession[]> {
    return this.json('session');
  }

  getSession(id: string): Promise<OcSession> {
    return this.json(`session/${encodeURIComponent(id)}`);
  }

  messages(id: string): Promise<OcMessageWithParts[]> {
    return this.json(`session/${encodeURIComponent(id)}/message`);
  }

  /** Rename a session; OpenCode broadcasts `session.updated`, so its own UI follows. */
  updateSession(id: string, body: { title: string }): Promise<OcSession> {
    return this.json(`session/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  createSession(body: { title?: string; parentID?: string }): Promise<OcSession> {
    return this.json('session', { method: 'POST', body: JSON.stringify(body) });
  }

  /** Fire-and-forget prompt; the reply streams back over SSE. */
  promptAsync(id: string, input: PromptInput): Promise<void> {
    return this.json(`session/${encodeURIComponent(id)}/prompt_async`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /** Answer a pending permission request; opencode confirms with a `permission.replied` event. */
  /** Pending permission requests (OpenCode ≥ 1.x `GET /permission`); empty on versions without it. */
  async listPermissions(): Promise<unknown[]> {
    try {
      return await this.json<unknown[]>('permission');
    } catch (e) {
      if (e instanceof OpencodeHttpError && e.status === 404) return [];
      throw e;
    }
  }

  /** Answers a permission request: the current endpoint, falling back to the deprecated per-session one on older servers. */
  async replyPermission(id: string, permissionID: string, response: PermissionResponse): Promise<boolean> {
    try {
      return await this.json(`permission/${encodeURIComponent(permissionID)}/reply`, { method: 'POST', body: JSON.stringify({ reply: response }) });
    } catch (e) {
      if (!(e instanceof OpencodeHttpError && e.status === 404)) throw e;
      return this.json(`session/${encodeURIComponent(id)}/permissions/${encodeURIComponent(permissionID)}`, {
        method: 'POST',
        body: JSON.stringify({ response }),
      });
    }
  }

  abortSession(id: string): Promise<unknown> {
    return this.json(`session/${encodeURIComponent(id)}/abort`, { method: 'POST' });
  }

  listAgents(): Promise<unknown[]> {
    return this.json('agent');
  }

  listProviders(): Promise<unknown> {
    return this.json('provider');
  }

  // ---- SSE --------------------------------------------------------------

  /** Connects to /global/event and keeps reconnecting until stop() is called. */
  start(): void {
    this.stopped = false;
    void this.loop();
  }

  stop(): void {
    this.stopped = true;
    this.abort?.abort();
  }

  private setConnected(v: boolean, error?: string): void {
    if (this.connected !== v) {
      this.connected = v;
      this.emit('status', { connected: v, error });
    } else if (!v && error) {
      this.emit('status', { connected: v, error });
    }
  }

  private async loop(): Promise<void> {
    while (!this.stopped) {
      this.abort = new AbortController();
      try {
        await this.consume(this.abort.signal);
        this.backoff = 1000;
      } catch (err) {
        if (this.stopped) break;
        const message = err instanceof Error ? err.message : String(err);
        this.setConnected(false, message);
        await new Promise((r) => setTimeout(r, this.backoff));
        this.backoff = Math.min(this.backoff * 2, 15000);
      }
    }
    this.setConnected(false);
  }

  private async consume(signal: AbortSignal): Promise<void> {
    const res = await fetch(this.url('global/event'), {
      headers: this.headers({ accept: 'text/event-stream' }),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`SSE connect failed: ${res.status}`);
    this.setConnected(true);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        this.handleChunk(chunk);
      }
    }
    throw new Error('SSE stream ended');
  }

  private handleChunk(chunk: string): void {
    const dataLines = chunk
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trimStart());
    if (dataLines.length === 0) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }
    const ev = normaliseEvent(parsed);
    if (!ev) return;
    if (this.opts.verbose) console.log('[opencode]', ev.directory ?? '-', ev.payload.type);
    this.emit('event', ev);
  }
}

/** /global/event wraps events as {directory, payload}; /event sends them bare. Accept both. */
export function normaliseEvent(raw: unknown): GlobalEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.payload && typeof r.payload === 'object' && typeof (r.payload as OcEvent).type === 'string') {
    return { directory: typeof r.directory === 'string' ? r.directory : undefined, payload: r.payload as OcEvent };
  }
  if (typeof r.type === 'string') {
    return { payload: { type: r.type, properties: (r.properties as Record<string, unknown>) ?? {} } };
  }
  return null;
}
