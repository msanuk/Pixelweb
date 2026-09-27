import type { CommitLink, GitCommit, OcMessageWithParts, OcPart } from '@pixelweb/shared';

/** `git commit`, also with global options in between (`git -c user.name=x commit`, `git -C dir commit`). */
const COMMIT_CMD = /\bgit(?:\s+(?:-[cC]\s+\S+|--?[\w-]+(?:=\S+)?))*\s+commit\b/;
/** First line of `git commit` output: "[main 1a2b3c4] subject", "[main (root-commit) 1a2b3c4] subject". */
const COMMIT_OUT = /^\[[^\]\n]*?\s([0-9a-f]{7,40})\]/m;
/** Slack between the tool call's clock and the commit's (whole-second) timestamp. */
const TIME_SLACK_MS = 2000;

/** The commit a bash tool call made, if it ran `git commit` successfully. */
export function commitLinkFromPart(part: OcPart): CommitLink | null {
  if (part.type !== 'tool') return null;
  const tool = part as Extract<OcPart, { type: 'tool' }>;
  if (tool.tool.toLowerCase() !== 'bash' || tool.state.status !== 'completed') return null;
  const st = tool.state;
  const cmd = st.input.command;
  if (typeof cmd !== 'string' || !COMMIT_CMD.test(cmd)) return null;
  const metaOut = st.metadata?.output;
  const out = `${st.output ?? ''}\n${typeof metaOut === 'string' ? metaOut : ''}`;
  if (/nothing to commit|no changes added to commit/.test(out) && !COMMIT_OUT.test(out)) return null;
  const hash = COMMIT_OUT.exec(out)?.[1];
  return { sessionID: part.sessionID, messageID: part.messageID, partID: part.id, hash, start: st.time.start, end: st.time.end };
}

/**
 * Pins each link to a full hash from the log: by the printed short hash when
 * there is one, else (`git commit -q`, output cut off) by the commit whose
 * timestamp falls inside the tool call's run.
 */
export function resolveLinks(links: CommitLink[], commits: GitCommit[]): CommitLink[] {
  return links.map((l) => {
    if (l.hash) {
      const c = commits.find((c) => c.hash.startsWith(l.hash!));
      return c ? { ...l, hash: c.hash } : l;
    }
    const inRun = commits.filter((c) => c.date * 1000 >= l.start - TIME_SLACK_MS && c.date * 1000 <= l.end + TIME_SLACK_MS);
    return inRun.length === 1 ? { ...l, hash: inRun[0].hash } : l;
  });
}

/** Commit links from every tool call seen so far, keyed by part id (a part is re-sent as it runs). */
export class CommitIndex {
  private readonly links = new Map<string, CommitLink>();

  /** Returns true when the index changed. */
  addPart(part: OcPart): boolean {
    const link = commitLinkFromPart(part);
    if (!link) return false;
    const prev = this.links.get(part.id);
    if (prev && prev.hash === link.hash && prev.end === link.end) return false;
    this.links.set(part.id, link);
    return true;
  }

  addMessages(messages: OcMessageWithParts[]): boolean {
    let changed = false;
    for (const m of messages) for (const p of m.parts) changed = this.addPart(p) || changed;
    return changed;
  }

  list(): CommitLink[] {
    return [...this.links.values()].sort((a, b) => a.start - b.start);
  }
}
