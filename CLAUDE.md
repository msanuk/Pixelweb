# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PixelWeb is **not** an agent. It is a visual, teaching-oriented workbench that connects to a running `opencode serve` (OpenCode's HTTP server), observes what the agent does, and renders it as clickable, learnable structure (timeline, git graph, module dependency graph, knowledge cards). User-facing text, knowledge cards, and teaching prompts are written in Chinese.

## Commands

npm workspaces monorepo (`packages/*`), Node >= 20. Run everything from the repo root.

```bash
npm install
npm run dev          # server (tsx watch, :7420) + web (vite, :5173, proxies /api and /ws to 7420)
npm run dev:mock     # fake `opencode serve` on :4096 with sample sessions + streaming replies (PORT / DIR env override)
npm run build        # server: tsc → packages/server/dist; web: vite build → packages/server/public
npm run typecheck
npm test             # vitest, server and web packages
node packages/server/dist/index.js --project <dir>   # run built app (see --help for flags)
```

Single test file / single test (tests live in `packages/server/test/` and, for pure `web/src/lib` helpers, `packages/web/test/`):

```bash
npm test --workspace=@pixelweb/server -- test/git.test.ts
npm test --workspace=@pixelweb/server -- -t "parseLog"
npm test --workspace=@pixelweb/web
```

Server config comes from CLI flags or env (`packages/server/src/config.ts`): `--opencode`/`PIXELWEB_OPENCODE_URL` (default `http://127.0.0.1:4096`), `--opencode-username`/`OPENCODE_SERVER_USERNAME` (default `opencode`), `--opencode-password`/`OPENCODE_SERVER_PASSWORD`, `--project`/`PIXELWEB_PROJECT` (default cwd), `--port`/`PIXELWEB_PORT` (7420), `--host`, `--password`/`PIXELWEB_PASSWORD` (PixelWeb login), `--data-dir`/`PIXELWEB_DATA_DIR` (`~/.pixelweb`), `--verbose`.

## Architecture

Data flow: `opencode serve` —SSE (`/global/event`)→ **server** —WebSocket (`/ws`)→ **web**. The browser only ever talks to the PixelWeb server (same origin); the server proxies all OpenCode REST calls under `/api/sessions/*`. Keep it that way — one origin, one place for auth.

Access control lives in `server/src/auth.ts` (`registerAuth`, an `onRequest` hook): there is deliberately **no CORS**; non-GET `/api` requests and the `/ws` handshake must have an `Origin` matching `Host` (or `X-Forwarded-Host`); with `--password`, `/api` and `/ws` also need the `pixelweb_session` HttpOnly cookie from `POST /api/login` (static UI files stay public). The PixelWeb server can prompt the agent and approve shell commands, so treat any new endpoint as privileged. The Vite dev proxy must keep `changeOrigin: false` or the Origin check rejects requests.

- **`packages/shared`** — the contract. Types only, consumed as raw `.ts` (`main: src/index.ts`, no build step). Contains mirror types of OpenCode's SDK (`Oc*`, kept dependency-free on purpose), git/arch/knowledge/learning types, and the WS protocol (`ServerMessage` / `ClientMessage`). Changing a server↔web payload means editing this file first.
- **`packages/server`** (Fastify, ESM, `NodeNext` — relative imports need `.js` extensions):
  - `index.ts` wires everything: services, all `/api` routes, the `/ws` handler, and event-driven refreshes (opencode `file.edited` / `session.idle` etc. debounce a git refresh and an arch re-analysis). On WS connect it replays current state (`hello`, status, git snapshot, arch graph, learning state).
  - `opencode/client.ts` — the **only** module that talks to OpenCode: hand-rolled fetch + SSE parser with exponential-backoff reconnect, `?directory=` scoping, basic auth. It deliberately avoids `@opencode-ai/sdk`. Other agents (Claude Code, Codex) are meant to be added as adapters emitting the same `status`/`event` shape.
  - `ws.ts` — `Hub` broadcasts every `ServerMessage` to every tab.
  - `git/service.ts` — shells out to `git` (fields separated by `\u001f`), pure `parseLog`/`parseBranches`/`parseStatus` functions (unit-tested), chokidar watch on `.git`.
  - `activity/commits.ts` — `CommitIndex` links commits to the session that made them by spotting completed bash `git commit` tool calls (hash from the `[branch abc1234]` output, else the commit timestamped inside the call). Fed live from `message.part.updated`, backfilled from the 40 most recent sessions on connect, re-resolved against the log on every git snapshot, pushed as `activity.commits`.
  - `analysis/deps.ts` — regex-level import extraction for TS/JS/Python, resolves workspace package names to their entry files, builds file- or dir-level graphs with cycle detection.
  - `knowledge/` — `store.ts` loads cards from three dirs in order (repo `knowledge/`, `~/.pixelweb/knowledge/`, `<project>/.pixelweb/knowledge/`; later wins on same id); `learning.ts` persists to `<dataDir>/learning.json`; `explain.ts` holds the teaching system prompt and `TEACHING_TOOLS` (write/shell disabled).
  - "Explain" (`POST /api/explain`) creates a new OpenCode session, marks it as a teaching session in memory, and prompts it with the teaching system prompt + read-only tools. Follow-up prompts to a teaching session re-apply the same restrictions.
  - If `packages/server/public/index.html` exists (from `npm run build`), the server also serves the UI with SPA fallback.
- **`packages/web`** (React 18 + Vite, no router or state library):
  - `lib/store.ts` — a single hand-written global store (`useSyncExternalStore`) plus `applyEvent`, a reducer that merges raw OpenCode SSE events (`message.updated`, `message.part.updated`, `session.status`, `permission.*`, `todo.updated`…) into a per-session message/part tree. Parts for sessions whose messages aren't loaded yet are dropped and fetched on open.
  - `lib/terms.ts` + `components/Highlight.tsx` — every term/alias from the knowledge index becomes a click-to-open-card highlight (longest match first; `\b` boundaries only for ASCII terms).
  - `lib/activity.ts` — which project files a session read/edited (tool inputs + `patch` parts; OpenCode passes absolute, possibly Windows, paths → `toProjectPath`) and `nodeForPath` to map them onto arch-graph nodes.
  - Cross-panel jumps go through one-shot store fields (`archFocus`, `gitFocus`, `partFocus`, set by `showInArch`/`showCommit`/`showPart`) that the target panel consumes and clears.
  - `panels/` — one component per tab (Timeline, GitGraph, ArchGraph via d3-force, Knowledge).

## Knowledge cards

`knowledge/*.md` are Markdown + frontmatter (schema in `knowledge/README.md`). `test/cards.test.ts` parses **every** bundled card and enforces: `id` equals the filename, non-empty `title`, `summary` > 10 chars, body contains `## 为什么重要`, at least one quiz item with a valid 0-based `answer`, and at least one `sources` entry. Run `npm test` after adding or editing cards. `appearsIn` keys (e.g. `timeline.tool.bash`, `timeline.part.step-finish`) are how the UI attaches a card to a specific element; `KnowledgeStore.forTool` looks up `timeline.tool.<name>`.
