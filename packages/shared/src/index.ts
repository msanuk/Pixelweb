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
  /** newer OpenCode versions report the sum directly */
  total?: number;
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
  /** `variant` (e.g. a reasoning level) since OpenCode 1.x */
  model?: { providerID: string; modelID: string; variant?: string };
  /** extra system prompt and tool switches the prompt was sent with */
  system?: string;
  tools?: Record<string, boolean>;
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
  /** the summary written by a compaction */
  summary?: boolean;
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
  /** what is being asked for, e.g. the bash command; a list for multi-pattern requests */
  pattern?: string | string[];
  sessionID: string;
  messageID: string;
  callID?: string;
  title: string;
  metadata: Record<string, unknown>;
  time: { created: number };
}

/** One rule of a session's own permission set (OpenCode 1.x, `POST /session { permission }`); the last match wins. */
export interface OcPermissionRule {
  /** tool permission key: bash, edit, webfetch… */
  permission: string;
  pattern: string;
  action: 'allow' | 'ask' | 'deny';
}

/** A model's token limits, from OpenCode's `/config/providers`. */
export interface OcModelLimit {
  context: number;
  /** some models cap the prompt separately from the whole window */
  input?: number;
  output: number;
}

/** What PixelWeb needs to draw a context meter: limits per "providerID/modelID", plus compaction settings. */
export interface ModelInfo {
  limits: Record<string, OcModelLimit>;
  compaction: { auto: boolean; reserved?: number };
}

/** Allowed answers to an OpenCode permission request. */
export type PermissionResponse = 'once' | 'always' | 'reject';

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

/**
 * A commit the agent made itself — a completed bash `git commit` tool call —
 * tied back to the session and tool part that ran it.
 */
export interface CommitLink {
  sessionID: string;
  messageID: string;
  partID: string;
  /** full hash once matched against the git log; else the short hash printed by `git commit`; absent if neither is known */
  hash?: string;
  /** when the tool call ran, ms since epoch */
  start: number;
  end: number;
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

export type CardCategory = 'ai' | 'git' | 'web' | 'tooling' | 'architecture' | 'cloud' | 'general';

export interface QuizItem {
  q: string;
  options: string[];
  answer: number; // index into options
  why?: string;
}

export interface KnowledgeCard {
  id: string;
  title: string;
  /** Highlighted wherever they appear in agent text — keep them specific. */
  aliases: string[];
  /** Search-only synonyms: too generic to highlight (请求, API, fetch…). */
  keywords: string[];
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
  keywords?: string[];
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
  | { type: 'learning.state'; state: LearningState }
  | { type: 'activity.commits'; links: CommitLink[] };

export type ClientMessage =
  | { type: 'git.refresh' }
  | { type: 'arch.refresh'; level?: 'file' | 'dir' };

// ---- Token usage (the 用量 page)

/** Token and cost sums over some model requests (OpenCode steps). `input` excludes cached tokens. */
export interface UsageTotals {
  steps: number;
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
}

export interface UsageModelRow extends UsageTotals {
  providerID: string;
  modelID: string;
  /** sessions (subtasks included) that used this model in the range */
  sessions: number;
}

export interface UsageReport {
  /** ms since epoch, `to` exclusive */
  from: number;
  to: number;
  sessions: number;
  total: UsageTotals;
  /** most prompt tokens first */
  models: UsageModelRow[];
  /** one entry per local day that had requests, oldest first; `models` is keyed "providerID/modelID" */
  days: { day: string; total: UsageTotals; models: Record<string, UsageTotals> }[];
  /** sessions whose messages couldn't be loaded, so are missing from the sums */
  failed: number;
}

// ---- Projects (which directory PixelWeb visualises; switchable at runtime)

export interface ProjectOption {
  /** absolute path of the project's root directory */
  dir: string;
  /** folder name, for display */
  name: string;
  /** last activity OpenCode recorded for the project, ms since epoch */
  updated?: number;
  current: boolean;
}

/** How PixelWeb reaches `opencode serve` (GET / POST /api/opencode). Changeable from 设置; a restart goes back to --opencode. */
export interface OpencodeConnection {
  url: string;
  username: string;
  /** the password itself never goes back to the browser */
  hasPassword: boolean;
  connected: boolean;
  error?: string;
}

export interface ServerInfo {
  version: string;
  opencodeUrl: string;
  projectRoot: string;
  opencodeConnected: boolean;
  teachingSessions: string[];
}

// ---- Cloud console guide (browser extension, docs/cloud-guide.md)

export type CloudVendor = 'aliyun' | 'aws' | 'huaweicloud' | 'azure' | 'gcp';

export type CapturedFieldKind = 'text' | 'number' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'switch' | 'other';

/** One form control on the captured page. */
export interface CapturedField {
  /** f1…fn, valid for this capture only; the agent cites fields as ⟦f12⟧ */
  ref: string;
  label: string;
  kind: CapturedFieldKind;
  /** already redacted; absent for password inputs */
  value?: string;
  options?: string[];
  required?: boolean;
  disabled?: boolean;
  help?: string;
  error?: string;
  /** title of the group the field sits in, e.g. "网络和安全组" */
  section?: string;
}

/** A cloud console page as the extension saw it when the user clicked capture. */
export interface PageCapture {
  /** with secret-looking query parameters removed */
  url: string;
  title: string;
  vendor: CloudVendor | null;
  breadcrumbs: string[];
  heading: string;
  fields: CapturedField[];
  /** visible text, cut to a budget */
  text: string;
  selection?: string;
  /** how many values were replaced by the mask */
  redactions: number;
  capturedAt: number;
}

/** A paired extension, as listed in 设置; the token itself is only shown once, at creation. */
export interface ExtTokenInfo {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt?: number;
}

export interface ExtTokenCreated {
  token: string;
  info: ExtTokenInfo;
}

/** The model a guide runs on, and whether it can look at a screenshot (null: OpenCode doesn't say). */
export interface GuideModel {
  /** "providerID/modelID" */
  id: string;
  name: string;
  image: boolean | null;
}

/** `GET /api/ext/hello`: the extension checks its token and shows where guides will run. */
export interface ExtHello {
  version: string;
  projectRoot: string;
  opencodeConnected: boolean;
  device: string;
  /** the model a new guide starts on; null if OpenCode couldn't be asked */
  model: GuideModel | null;
}

/** `POST /api/ext/guide` starts a guide session; `POST /api/ext/guide/:id/prompt` continues it. */
export interface GuideRequest {
  capture?: PageCapture;
  question?: string;
  /** the visible part of the tab as a data: URL (JPEG or PNG); only with a capture, and never redacted */
  screenshot?: string;
}

export interface GuideResponse {
  sessionID: string;
  title: string;
}

/** What `GET /api/ext/guide/:id/events` streams, one per SSE `data:` line. */
export type GuideStreamMessage =
  | { type: 'snapshot'; messages: OcMessageWithParts[]; busy: boolean; permissions: unknown[]; model: GuideModel | null }
  | { type: 'event'; event: OcEvent }
  | { type: 'opencode.status'; connected: boolean }
  | { type: 'error'; error: string };
