import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ExtTokenCreated, ExtTokenInfo } from '@pixelweb/shared';

interface StoredToken extends ExtTokenInfo {
  /** sha256 of the token; the token itself is never written down */
  hash: string;
}

/** How often a token's "last used" time is written back; it's for the 设置 list, not auditing. */
const TOUCH_EVERY_MS = 60_000;

/**
 * Pairing tokens for the browser extension (docs/cloud-guide.md). The extension's requests come
 * from chrome-extension://…, which the Origin check refuses, and can't carry the SameSite=Strict
 * login cookie, so `/api/ext/*` accepts a Bearer token instead — and only there. Kept in the data
 * dir so a restart doesn't unpair every browser.
 */
export class ExtTokenStore {
  private tokens: StoredToken[] = [];
  private readonly file: string;
  private writing: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'extension-tokens.json');
  }

  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8')) as { tokens?: StoredToken[] };
      if (Array.isArray(parsed?.tokens)) this.tokens = parsed.tokens.filter((t) => t && typeof t.hash === 'string' && typeof t.id === 'string');
    } catch {
      /* first run */
    }
  }

  list(): ExtTokenInfo[] {
    return this.tokens.map(({ hash: _hash, ...info }) => info);
  }

  async create(name: string, now = Date.now()): Promise<ExtTokenCreated> {
    const token = `pwx_${crypto.randomBytes(32).toString('base64url')}`;
    const stored: StoredToken = { id: crypto.randomBytes(6).toString('hex'), name, createdAt: now, hash: sha256(token) };
    this.tokens.push(stored);
    await this.save();
    const { hash: _hash, ...info } = stored;
    return { token, info };
  }

  async revoke(id: string): Promise<boolean> {
    const before = this.tokens.length;
    this.tokens = this.tokens.filter((t) => t.id !== id);
    if (this.tokens.length === before) return false;
    await this.save();
    return true;
  }

  /** The token's entry if it is one of ours; also records when it was last used. */
  verify(token: string, now = Date.now()): ExtTokenInfo | null {
    const digest = Buffer.from(sha256(token), 'hex');
    const hit = this.tokens.find((t) => crypto.timingSafeEqual(Buffer.from(t.hash, 'hex'), digest));
    if (!hit) return null;
    if (!hit.lastUsedAt || now - hit.lastUsedAt > TOUCH_EVERY_MS) {
      hit.lastUsedAt = now;
      void this.save().catch((e) => console.warn('[pixelweb] extension tokens:', e?.message ?? e));
    }
    const { hash: _hash, ...info } = hit;
    return info;
  }

  /** Writes are queued so two quick changes can't land out of order. */
  private save(): Promise<void> {
    const body = JSON.stringify({ tokens: this.tokens }, null, 2);
    this.writing = this.writing
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        await fs.writeFile(this.file, body, { mode: 0o600 });
      });
    return this.writing;
  }
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}
