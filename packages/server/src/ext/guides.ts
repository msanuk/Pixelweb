import fs from 'node:fs/promises';
import path from 'node:path';

export interface GuideEntry {
  /** the project the session was created in; OpenCode only finds it with this `?directory=` */
  directory: string;
  createdAt: number;
}

const KEEP = 500;

/**
 * Which OpenCode sessions are cloud console guides. A pairing token may only touch these, and
 * their follow-ups get the guide's system prompt back, so the list has to survive a restart
 * (unlike the teaching sessions, which only lose that prompt).
 */
export class GuideRegistry {
  private guides = new Map<string, GuideEntry>();
  private readonly file: string;
  private writing: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'guides.json');
  }

  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8')) as { guides?: Record<string, GuideEntry> };
      for (const [id, g] of Object.entries(parsed?.guides ?? {})) {
        if (g && typeof g.directory === 'string') this.guides.set(id, { directory: g.directory, createdAt: Number(g.createdAt) || 0 });
      }
    } catch {
      /* first run */
    }
  }

  get(id: string): GuideEntry | undefined {
    return this.guides.get(id);
  }

  has(id: string): boolean {
    return this.guides.has(id);
  }

  async add(id: string, directory: string, now = Date.now()): Promise<void> {
    this.guides.set(id, { directory, createdAt: now });
    // oldest first in insertion order; old guides lose the extension's access, not their history
    for (const old of this.guides.keys()) {
      if (this.guides.size <= KEEP) break;
      this.guides.delete(old);
    }
    const body = JSON.stringify({ guides: Object.fromEntries(this.guides) }, null, 2);
    this.writing = this.writing
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        await fs.writeFile(this.file, body);
      });
    return this.writing;
  }
}
