# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PixelWeb is **not** an agent. It is a visual, teaching-oriented workbench that connects to a running `opencode serve` (OpenCode's HTTP server), observes what the agent does, and renders it as clickable, learnable structure (timeline, git graph, module dependency graph, knowledge cards). User-facing text, knowledge cards, and teaching prompts are written in Chinese.

## Commands

npm workspaces monorepo (`packages/*`), Node >= 20. Run everything from the repo root.

```bash
npm install
npm run dev          # server (tsx watch, :7420) + web (vite, :5173, proxies /api and /ws to 7420)
npm run dev:mock     # fake `opencode serve` on :4096 with sample sessions + streaming replies (PORT / DIR env override; PROJECTS=dir1:dir2 adds more projects to switch to)
npm run build        # server: tsc → packages/server/dist; web: vite build → packages/server/public
npm run typecheck
npm test             # vitest, server and web packages
node packages/server/dist/index.js --project <dir>   # run built app (see --help for flags)
npm run pm2:start    # build, then keep `opencode serve` + the built server running under pm2 (ecosystem.config.cjs, settings from env or .env); pm2:logs, pm2:stop
```

Single test file / single test (tests live in `packages/server/test/` and, for pure `web/src/lib` helpers, `packages/web/test/`):

```bash
npm test --workspace=@pixelweb/server -- test/git.test.ts
npm test --workspace=@pixelweb/server -- -t "parseLog"
npm test --workspace=@pixelweb/web
```

Server config comes from CLI flags or env (`packages/server/src/config.ts`): `--opencode`/`PIXELWEB_OPENCODE_URL` (default `http://127.0.0.1:4096`), `--opencode-username`/`OPENCODE_SERVER_USERNAME` (default `opencode`), `--opencode-password`/`OPENCODE_SERVER_PASSWORD`, `--project`/`PIXELWEB_PROJECT` (default cwd — which for `npm run dev` is `packages/server`; only the startup project, see project switching below), `--port`/`PIXELWEB_PORT` (7420), `--host`, `--password`/`PIXELWEB_PASSWORD` (PixelWeb login), `--data-dir`/`PIXELWEB_DATA_DIR` (`~/.pixelweb`), `--verbose`.

## Architecture

Data flow: `opencode serve` —SSE (`/global/event`)→ **server** —WebSocket (`/ws`)→ **web**. The browser only ever talks to the PixelWeb server (same origin); the server proxies all OpenCode REST calls under `/api/sessions/*`. Keep it that way — one origin, one place for auth.

Access control lives in `server/src/auth.ts` (`registerAuth`, an `onRequest` hook): there is deliberately **no CORS**; non-GET `/api` requests and the `/ws` handshake must have an `Origin` matching `Host` (or `X-Forwarded-Host`); with `--password`, `/api` and `/ws` also need the `pixelweb_session` HttpOnly cookie from `POST /api/login` (static UI files stay public). The PixelWeb server can prompt the agent and approve shell commands, so treat any new endpoint as privileged. The Vite dev proxy must keep `changeOrigin: false` or the Origin check rejects requests.

- **`packages/shared`** — the contract. Types only, consumed as raw `.ts` (`main: src/index.ts`, no build step). Contains mirror types of OpenCode's SDK (`Oc*`, kept dependency-free on purpose), git/arch/knowledge/learning types, and the WS protocol (`ServerMessage` / `ClientMessage`). Changing a server↔web payload means editing this file first. The one runtime module is `src/steps.js` (`@pixelweb/shared/steps`): `stepsOf` / `sessionTotals`, how token usage is read out of messages, used by both the server's 用量 page and the timeline header. It is plain JS typed by `steps.d.ts` (checked with `checkJs`) because the built server runs under plain Node and imports it at runtime, and Node ≥ 20.19 can't load `.ts`; keep it dependency-free and don't add runtime code to `index.ts`.
- **`packages/server`** (Fastify, ESM, `NodeNext` — relative imports need `.js` extensions):
  - `index.ts` wires everything: services, all `/api` routes, the `/ws` handler, and event-driven refreshes (opencode `file.edited` / `session.idle` etc. debounce a git refresh and an arch re-analysis). On WS connect it replays current state (`hello`, status, git snapshot, arch graph, learning state).
  - Project switching: one `opencode serve` holds many projects (each REST call is scoped by `?directory=`), PixelWeb visualises one at a time. `GET /api/projects` lists OpenCode's `GET /project` plus projects used this run (`project.ts`, pure, tested); `POST /api/project { dir }` runs `switchProject`, which swaps every project-scoped service (`cfg.projectRoot`, the client's directory, `GitService`, `KnowledgeStore` with the project's cards, arch cache, `CommitIndex`, models cache) and broadcasts a fresh `hello`. Those services are `let` bindings, so route handlers must read them at request time and async work must check the project didn't change mid-flight. `/global/event` carries every project's events; `belongsTo` drops those whose `directory` isn't nested with the current root. The choice isn't persisted — a restart goes back to `--project`.
  - `opencode/client.ts` — the **only** module that talks to OpenCode: hand-rolled fetch + SSE parser with exponential-backoff reconnect, `?directory=` scoping, basic auth. It deliberately avoids `@opencode-ai/sdk`. Other agents (Claude Code, Codex) are meant to be added as adapters emitting the same `status`/`event` shape.
  - `ws.ts` — `Hub` broadcasts every `ServerMessage` to every tab.
  - `git/service.ts` — shells out to `git` (fields separated by `\u001f`), pure `parseLog`/`parseBranches`/`parseStatus` functions (unit-tested), chokidar watch on `.git`.
  - `activity/commits.ts` — `CommitIndex` links commits to the session that made them by spotting completed bash `git commit` tool calls (hash from the `[branch abc1234]` output, else the commit timestamped inside the call). Fed live from `message.part.updated`, backfilled from the 40 most recent sessions on connect, re-resolved against the log on every git snapshot, pushed as `activity.commits`.
  - `analysis/deps.ts` — regex-level import extraction for TS/JS/Python, resolves workspace package names to their entry files, builds file- or dir-level graphs with cycle detection. The walk skips what git ignores (`git ls-files --others --ignored --directory`, nothing outside a git work tree) — the only reliable way to drop a bundler's small split chunks, which `isGenerated`'s size check can't tell from short source.
  - `knowledge/` — `store.ts` loads cards from three dirs in order (repo `knowledge/`, `~/.pixelweb/knowledge/`, `<project>/.pixelweb/knowledge/`; later wins on same id); `learning.ts` persists to `<dataDir>/learning.json`; `explain.ts` holds the teaching system prompt and `TEACHING_PERMISSION` (file edits denied, every shell command asks).
  - "Explain" (`POST /api/explain`) creates a new OpenCode session with `TEACHING_PERMISSION` as its own rules (stored by OpenCode, so they survive a PixelWeb restart), marks it as a teaching session in memory, and prompts it with the teaching system prompt; follow-ups re-apply that prompt. Never send `tools` to a teaching session: OpenCode replaces the session's rules with that map, and removing bash makes OpenCode Zen's free models reject the request.
  - Every follow-up prompt (`POST /api/sessions/:id/prompt`) repeats the last user turn's agent, model, variant, system prompt and tools (`opencode/followup.ts`, pure, tested). OpenCode doesn't carry them over — without `agent` it runs the default agent — which would change the request prefix and miss the provider's prompt cache for the whole conversation (and turn a `plan` session into `build`).
  - Session naming (`opencode/naming.ts`, pure, tested): titles follow `yyyymmdd-动词对象`, ≤ 25 chars. OpenCode's hidden `title` agent writes the title once after the first message; its prompt can be replaced in opencode.json with `docs/opencode-title-prompt.txt` (Chinese 动词对象), but it never sees the date, so on `session.updated` the server PATCHes the date prefix in (from `time.created`) unless `--no-title-date`. Subtasks, teaching sessions (`📖`), untitled (`New session - <ISO>`) and already-dated titles are left alone. `PATCH /api/sessions/:id { title }` renames from the UI with the same prefix.
  - `usage.ts` — the 用量 page's `GET /api/usage?from&to&tz`: sums every session's steps in the range per `provider/model` and per local day. It counts `step-finish` parts, not assistant messages — OpenCode overwrites a message's `tokens` with its last step's (cost is summed), so message tokens undercount multi-step turns (the counting itself is `stepsOf` in `@pixelweb/shared/steps`, shared with the timeline header). Step lists are cached per session until its `time.updated` changes.
  - If `packages/server/public/index.html` exists (from `npm run build`), the server also serves the UI with SPA fallback.
- **`packages/web`** (React 18 + Vite, no router or state library):
  - `lib/store.ts` — a single hand-written global store (`useSyncExternalStore`) plus `applyEvent`, a reducer that merges raw OpenCode SSE events (`message.updated`, `message.part.updated`, `session.status`, `permission.*`, `todo.updated`…) into a per-session message/part tree. Parts for sessions whose messages aren't loaded yet are dropped and fetched on open.
  - `lib/terms.ts` + `components/Highlight.tsx` — every term/alias from the knowledge index becomes a click-to-open-card highlight (longest match first; ASCII terms need a boundary that also excludes paths, file names and identifiers, so `ts` doesn't fire in `auth.ts`; keywords are never highlighted).
  - `lib/activity.ts` — which project files a session read/edited (tool inputs + `patch` parts; OpenCode passes absolute, possibly Windows, paths → `toProjectPath`) and `nodeForPath` to map them onto arch-graph nodes.
  - `lib/context.ts` — the timeline's context meter. `compactionThreshold` mirrors OpenCode's own overflow check (v1.17: window minus `min(output limit, 32k)`, or `limit.input` minus `compaction.reserved` ?? 20k); limits come from `GET /api/models` (OpenCode `/config/providers` + `/config`). Re-check it when bumping the OpenCode version.
  - `lib/cache.ts` — the timeline's prompt-cache line: per-step hit rate (`cache.read` / (input + cache read + write); OpenCode's `input` excludes cached tokens for every provider) and "cache breaks", a step that re-reads < 50% of the previous prompt, with the causes visible in between (compaction, model/agent/system/tools/variant change, an AGENTS.md/CLAUDE.md edit, > 5 min idle). Sessions whose provider never reports cache usage show no rates at all.
  - `lib/sessions.ts` — nests subtask sessions (`parentID`) under their parent in the session list and splits OpenCode's fixed subtask title `<description> (@<agent> subagent)`; the parent's `task` tool part links to the child via `state.metadata.sessionId`.
  - `lib/permissions.ts` — OpenCode changed its permission API: 1.x sends `permission.asked` ({ permission, patterns, tool }) and `permission.replied` ({ requestID }), older versions `permission.updated` / `permissionID`. `normalizePermission` maps both onto `OcPermission`; the server replies via `POST /permission/:id/reply`, falling back to the deprecated `/session/:id/permissions/:id` on 404, and `GET /api/permissions` loads requests already pending when the page opens.
  - `lib/theme.ts` — two independent per-browser choices on `<html>`: light/dark (`data-theme`: `paper` / `graphite`, absent = follow the system) and the colour family (`data-palette`: absent = 纸墨, the monochrome default; `clay` = 陶土, cream and slate with a clay accent and serif `--prose` for replies and cards). Each clay rule has one more attribute than its ink counterpart in `styles.css`, so it wins regardless of order. Components only use the CSS variables, never literal colours; in 纸墨 `--accent` is the ink colour, in 陶土 it is clay, so use `--accent` for "the highlight" and `--text` for "ink".
  - `lib/settings.ts` (per-browser prefs in localStorage, applied pre-paint by the inline script in `index.html` like the theme) and `lib/notify.ts` (system notifications + an unread count in the tab title; the rules in `lib/alerts.ts` are pure). System notifications need a secure context, so over plain `http://<server-ip>` only the title count works.
  - `setServer` (on every `hello`) is where a project change lands: if `projectRoot` differs from the last one it clears all project-scoped state and reloads sessions, models, permissions and the knowledge index. The top-bar crumb is `components/ProjectPicker.tsx`.
  - Cross-panel jumps go through one-shot store fields (`archFocus`, `gitFocus`, `partFocus`, set by `showInArch`/`showCommit`/`showPart`) that the target panel consumes and clears.
  - `components/Markdown.tsx` — the hand-rolled renderer for agent replies and card bodies (parsing in `lib/markdown.ts`, tested): headings, lists, GFM tables, fenced code, inline code/bold/links; text goes through `<Highlight/>`. A closed ```mermaid fence becomes `components/Mermaid.tsx`: mermaid is imported lazily (its own chunks, never in the main bundle), rendered with `securityLevel: 'strict'` because the source is agent output, and themed from the page's CSS variables (`lib/mermaid.ts`), redrawn on a theme change. While a reply is still streaming the fence is open, so the source shows until it closes.
  - `panels/` — one component per tab (Timeline, GitGraph, ArchGraph via d3-force, Knowledge, Usage — tokens and cache hit rate per model over a date range; range and chart helpers in `lib/usage.ts`).

## Knowledge cards

`knowledge/*.md` are Markdown + frontmatter (schema in `knowledge/README.md`). `test/cards.test.ts` parses **every** bundled card and enforces: `id` equals the filename, non-empty `title`, `summary` > 10 chars, body contains `## 为什么重要`, at least one quiz item with a valid 0-based `answer`, and at least one `sources` entry. Run `npm test` after adding or editing cards. Titles and `aliases` are highlighted wherever they appear in agent text, so they must be specific and unique across cards (also tested); generic synonyms (请求, API, fetch…) go in `keywords`, which are search-only. `appearsIn` keys (e.g. `timeline.tool.bash`, `timeline.part.step-finish`) are how the UI attaches a card to a specific element; `KnowledgeStore.forTool` looks up `timeline.tool.<name>`.
