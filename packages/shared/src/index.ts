// ---------------------------------------------------------------------------
// Shared types between the PixelWeb server and the web UI.
// PixelWeb is NOT an agent: it observes and steers a coding agent (OpenCode)
// and turns what happens into visual, teachable structure.
// ---------------------------------------------------------------------------

// ---- OpenCode mirror types (subset of @opencode-ai/sdk, kept dependency-free)

export interface OcSession {
  id: string;
  projectID?: string;
  directory?: string;
  parentID?: string;
  title: string;
  version?: string;
  time: { created: number; updated: number };
  summary?: { additions: number; deletions: number; files: number };
}

export interface OcTokens {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
}

export interface OcUserMessage {
  id: string;
  sessionID: string;
  role: 'user';
  time: { created: number };
  agent?: string;
  model?: { providerID: string; modelID: string };
}

export interface OcAssistantMessage {
  id: string;
  sessionID: string;
  role: 'assistant';
  time: { created: number; completed?: number };
  parentID: string;
  modelID: string;
  providerID: string;
  mode?: string;
  cost: number;
  tokens: OcTokens;
  error?: { name: string; data: { message?: string } };
  finish?: string;
}

export type OcMessage = OcUserMessage | OcAssistantMessage;

export type OcToolState =
  | { status: 'pending'; input: Record<string, unknown> }
  | { status: 'running'; input: Record<string, unknown>; title?: string; time: { start: number } }
  | {
      status: 'completed';
      input: Record<string, unknown>;
      output: string;
      title: string;
      metadata: Record<string, unknown>;
      time: { start: number; end: number };
    }
  | { status: 'error'; input: Record<string, unknown>; error: string; time: { start: number; end: number } };

interface OcPartBase {
  id: string;
  sessionID: string;
  messageID: string;
}

export type OcPart =
  | (OcPartBase & { type: 'text'; text: string; synthetic?: boolean; time?: { start: number; end?: number } })
  | (OcPartBase & { type: 'reasoning'; text: string; time: { start: number; end?: number } })
  | (OcPartBase & { type: 'tool'; callID: string; tool: string; state: OcToolState })
  | (OcPartBase & { type: 'file'; mime: string; filename?: string; url: string })
  | (OcPartBase & { type: 'step-start'; snapshot?: string })
  | (OcPartBase & { type: 'step-finish'; reason: string; cost: number; tokens: OcTokens })
  | (OcPartBase & { type: 'patch'; hash: string; files: string[] })
  | (OcPartBase & { type: 'subtask'; prompt: string; description: string; agent: string })
  | (OcPartBase & { type: 'agent'; name: string })
  | (OcPartBase & { type: 'snapshot'; snapshot: string })
  | (OcPartBase & { type: 'retry'; attempt: number })
  | (OcPartBase & { type: 'compaction'; auto: boolean })
  | (OcPartBase & { type: string });

export interface OcMessageWithParts {
  info: OcMessage;
  parts: OcPart[];
}

export interface OcPermission {
  id: string;
  type: string;
  sessionID: string;
  messageID: string;
  callID?: string;
  title: string;
  metadata: Record<string, unknown>;
  time: { created: number };
}

export interface OcTodo {
  id: string;
  content: string;
  status: string;
  priority: string;
}

/** Raw OpenCode SSE event. `type` is the discriminator, `properties` the payload. */
export interface OcEvent {
  type: string;
  properties: Record<string, unknown>;
}

// ---- Git

export interface GitCommit {
  hash: string;
  shortHash: string;
  parents: string[];
  author: string;
  date: number; // unix seconds
  subject: string;
  refs: string[]; // e.g. ["HEAD -> main", "origin/main", "tag: v1"]
}

export interface GitBranch {
  name: string;
  hash: string;
  current: boolean;
  remote: boolean;
  upstream?: string;
  ahead?: number;
  behind?: number;
}

export interface GitStatusEntry {
  path: string;
  /** two-letter porcelain code, e.g. " M", "??", "A " */
  code: string;
}

export interface GitSnapshot {
  root: string;
  head: string | null;
  currentBranch: string | null;
  detached: boolean;
  commits: GitCommit[];
  branches: GitBranch[];
  status: GitStatusEntry[];
  stashCount: number;
}

// ---- Architecture graph

export interface ArchNode {
  id: string; // module path relative to root, e.g. "src/git/service.ts" or dir "src/git"
  label: string;
  kind: 'file' | 'dir' | 'external';
  language?: 'ts' | 'js' | 'py' | 'other';
  loc: number;
  fileCount?: number;
}

export interface ArchEdge {
  source: string;
  target: string;
  weight: number; // number of import statements
}

export interface ArchGraph {
  root: string;
  level: 'file' | 'dir';
  nodes: ArchNode[];
  edges: ArchEdge[];
  generatedAt: number;
  stats: { files: number; imports: number; externals: number; skipped: number };
}

// ---- Knowledge cards

export type CardCategory = 'ai' | 'git' | 'web' | 'tooling' | 'architecture' | 'general';

export interface QuizItem {
  q: string;
  options: string[];
  answer: number; // index into options
  why?: string;
}

export interface KnowledgeCard {
  id: string;
  title: string;
  aliases: string[];
  category: CardCategory;
  /** One sentence. Fits working memory. */
  summary: string;
  /** Markdown body: 为什么重要 / 在 PixelWeb 里出现在哪 / 动手试试 */
  body: string;
  related: string[];
  /** Where in the UI this concept shows up, e.g. ["timeline.tool.bash", "git.branch"] */
  appearsIn: string[];
  quiz: QuizItem[];
  sources: { title: string; url: string }[];
  /** 1 (基础) – 3 (进阶) */
  level: 1 | 2 | 3;
}

export interface KnowledgeIndexEntry {
  id: string;
  title: string;
  aliases: string[];
  category: CardCategory;
  summary: string;
  level: 1 | 2 | 3;
}

export type MasteryLevel = 'seen' | 'learning' | 'mastered';

export interface LearningRecord {
  cardId: string;
  mastery: MasteryLevel;
  seenCount: number;
  lastSeen: number;
  quizCorrect: number;
  quizTotal: number;
  notes?: string;
}

export interface LearningState {
  records: Record<string, LearningRecord>;
  updatedAt: number;
}

// ---- Explain-via-OpenCode

export interface ExplainRequest {
  term: string;
  /** free text describing what the user was looking at (a tool call, a commit, a module) */
  context?: string;
  /** which cards to hand the agent as grounding */
  cardId?: string;
  /** opencode model override, provider/model */
  model?: { providerID: string; modelID: string };
}

export interface ExplainResponse {
  sessionID: string;
  title: string;
}

// ---- Server -> Web WebSocket protocol

export type ServerMessage =
  | { type: 'hello'; server: { version: string; opencodeUrl: string; projectRoot: string } }
  | { type: 'opencode.status'; connected: boolean; error?: string }
  | { type: 'opencode.event'; event: OcEvent; directory?: string; receivedAt: number }
  | { type: 'git.snapshot'; snapshot: GitSnapshot }
  | { type: 'arch.graph'; graph: ArchGraph }
  | { type: 'learning.state'; state: LearningState };

export type ClientMessage =
  | { type: 'git.refresh' }
  | { type: 'arch.refresh'; level?: 'file' | 'dir' };

export interface ServerInfo {
  version: string;
  opencodeUrl: string;
  projectRoot: string;
  opencodeConnected: boolean;
  teachingSessions: string[];
}
