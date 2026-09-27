# PixelWeb

**一个坐在 coding agent 之上、边干活边学的可视化工作台。**

PixelWeb 本身不是 agent。它连接并监听 [OpenCode](https://opencode.ai) 的 `opencode serve`，把 agent 正在做的事变成可视、可点、可学的结构：

| 面板 | 你能看到 | 你能学到 |
| --- | --- | --- |
| **时间线** | 每个 session 的消息、工具调用（bash / read / edit / grep …）、token 与费用、权限请求、todo | 点任何工具名、模型名、`step` 都会弹出对应概念卡片 |
| **Git** | 分支 DAG、HEAD、远程分支、工作区状态、stash，随 agent 改动实时刷新 | 点 commit / branch / HEAD / 状态码即可查看解释 |
| **架构** | 由 import 语句生成的模块依赖图（TS/JS/Python），节点大小 = 代码行，红边 = 循环依赖 | 点节点看耦合，一键让 OpenCode 解释某个模块的职责 |
| **知识库** | 50+ 张中文知识卡片：AI（token、context window、tool call、MCP…）、Git、Web（webhook、SSE、CORS…）、工具链、架构 | 每张卡片带一句话定义、为什么重要、在 PixelWeb 里出现在哪、检索练习、来源链接 |

界面里任何出现过的术语都会带虚线下划线，点一下就是卡片。卡片底部的「📖 让 OpenCode 结合项目深入解释」会开一个**只读的教学 session**（自带教学系统提示、禁用写文件与 shell），结合你当前项目往深一层讲，并以一道检索练习收尾——这部分教学法参考了 Matt Pocock 的 [`teach` skill](https://github.com/mattpocock/skills)。

## 截图

| 时间线 + 概念卡片 | 架构依赖图 |
| --- | --- |
| ![timeline](docs/screenshots/timeline-card.png) | ![arch](docs/screenshots/arch.png) |

| Git 分支图 | 知识库 |
| --- | --- |
| ![git](docs/screenshots/git.png) | ![knowledge](docs/screenshots/knowledge.png) |

## 快速开始

```bash
# 1. 在你的项目里启动 opencode 的 HTTP 服务（默认 4096 端口）
cd ~/your-project && opencode serve

# 2. 启动 PixelWeb（另一个终端）
git clone <this repo> pixelweb && cd pixelweb
npm install
npm run build
node packages/server/dist/index.js --project ~/your-project
# → http://127.0.0.1:7420
```

常用参数（也可用同名环境变量 `PIXELWEB_*`）：

```
--opencode <url>           opencode serve 地址   (默认 http://127.0.0.1:4096)
--opencode-username <u>    opencode 的用户名     (默认 opencode，同 OPENCODE_SERVER_USERNAME)
--opencode-password <pw>   如果 opencode 设置了 OPENCODE_SERVER_PASSWORD
--project <dir>            要可视化的项目目录   (默认当前目录)
--port <n>                 PixelWeb 端口        (默认 7420)
--host <addr>              PixelWeb 监听地址     (默认 127.0.0.1)
--password <pw>            访问 PixelWeb 需要的密码 (同 PIXELWEB_PASSWORD)
--verbose                  打印每个 opencode 事件
```

### 部署到服务器

PixelWeb 要读取项目的 git 和源码，并把项目路径传给 OpenCode，所以它必须和 `opencode serve`、项目文件在**同一台机器**上。OpenCode 只需监听本机：

```bash
# 服务器上（Windows 路径同理，如 D:\code\proj）
cd /path/to/project && opencode serve --port 4096
node packages/server/dist/index.js --project /path/to/project --host 0.0.0.0 --password <访问密码>
```

- PixelWeb 能替你给 agent 发 prompt、批准它执行 shell 命令。**不设 `--password` 就不要监听 127.0.0.1 以外的地址**，启动时也会给出警告。
- 普通 HTTP 下密码和登录 cookie 是明文传输的。在不可信的网络上，请放到 HTTPS 反向代理后面，或者不开放端口、改用 SSH 隧道：`ssh -L 7420:127.0.0.1:7420 user@server`。
- 反向代理需要保留 `Host` 或传 `X-Forwarded-Host`：PixelWeb 会拒绝来源（Origin）与之不符的写请求和 WebSocket 连接。
- `npm run dev` 依赖 shell 的 `&`，在 Windows 上请用 `npm run build` 加 `npm start`。

## 开发

```bash
npm install
npm run dev            # 同时启动后端 (7420, tsx watch) 与前端 (5173, vite, 代理 /api 与 /ws)
npm run dev:mock       # 没有 opencode 时：一个假的 opencode serve（4096），带示例会话并会流式回复
npm run typecheck
npm test               # vitest：git 解析、依赖分析、知识卡片（每张卡片都会被解析校验）
```

## 架构

```
packages/
  shared/    前后端共享的 TypeScript 类型（OpenCode 事件、Git 快照、依赖图、卡片、WS 协议）
  server/    Fastify
    opencode/client.ts   ← 唯一与 OpenCode 打交道的适配器：REST + /global/event SSE（自动重连）
    git/service.ts       ← git log/for-each-ref/status 解析 + chokidar 监听 .git
    analysis/deps.ts     ← import 图提取（TS/JS/Python，正则级，够教学用）
    knowledge/           ← 卡片加载、搜索、学习记录、教学 prompt
    ws.ts / index.ts     ← WebSocket 广播 + /api 路由
  web/       React + Vite；单一 store，事件 reducer 把 SSE 事件合并进消息树
knowledge/   知识卡片（Markdown + frontmatter），见 knowledge/README.md
```

数据流：`opencode serve` ─SSE─▶ `server` ─WebSocket─▶ `web`；浏览器只与 PixelWeb 同源通信，避免 CORS。

学习记录保存在 `~/.pixelweb/learning.json`；自定义卡片可放 `~/.pixelweb/knowledge/` 或 `<项目>/.pixelweb/knowledge/`。

## 路线图

- [ ] 更多 agent 适配器（Claude Code、Codex CLI）——只需实现 `opencode/client.ts` 同样的事件形状
- [ ] 基于 tree-sitter 的精确依赖分析、调用图
- [ ] 按学习记录推送「今天该复习的卡片」（间隔重复）
- [ ] 把 PixelWeb 暴露为 MCP server，让 agent 主动向你「讲解它刚做的事」
