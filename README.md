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
--no-title-date            不给会话标题加日期前缀 (同 PIXELWEB_TITLE_DATE=0)
```

OpenCode 的地址、用户名和密码也能在运行中改：设置（⌘,）→ 连接，地址可以只填端口；连不上时顶栏的“OpenCode 未连接”旁边有“设置”入口，还能“立即重试”，不用等自动重连。界面里改的只在这次运行中有效，重启 PixelWeb 后回到上面的参数。

### 会话命名

会话标题统一成 `yyyymmdd-动词对象`，只用中文，整个标题不超过 25 个字，例如 `20260928-修复登录跳转`。分两半做：

1. **OpenCode 起标题**：OpenCode 在第一条消息后用隐藏的 `title` agent 起一次标题，它的提示词可以换掉。把 [`docs/opencode-title-prompt.txt`](docs/opencode-title-prompt.txt) 放到服务器上，在 OpenCode 的配置（全局 `~/.config/opencode/opencode.json`，或项目里的 `opencode.json`）里加上：

   ```json
   {
     "agent": {
       "title": { "prompt": "{file:./title-prompt.txt}" }
     }
   }
   ```

   `{file:...}` 的相对路径相对于这个配置文件。想用便宜的模型起标题，可以再加 `"model": "provider/model"`。改完重启 `opencode serve`，之后新建的会话才生效。
2. **PixelWeb 加日期**：`title` agent 看不到今天的日期，所以日期前缀由 PixelWeb 补：OpenCode 写入标题后，PixelWeb 马上按会话的创建日期改成 `yyyymmdd-…`，超出 25 个字的截掉。改名写回 OpenCode，终端里也能看到。时间线标题旁的铅笔图标（或双击标题）可以手动改名，同样会自动加日期。

不会动的：子任务（OpenCode 用任务描述加 `(@agent subagent)` 命名）、教学会话、还没起标题的会话、已经带日期的标题。旧会话不会批量改名，下次有动静（比如继续对话）时才会改。PixelWeb 没运行时起的标题没有日期，之后它在 PixelWeb 运行时有动静了才补上。

### 部署到服务器

PixelWeb 要读取项目的 git 和源码，并把项目路径传给 OpenCode，所以它必须和 `opencode serve`、项目文件在**同一台机器**上。OpenCode 只需监听本机：

```bash
# 服务器上（Windows 路径同理，如 D:\code\proj）
cd /path/to/project && opencode serve --port 4096
node packages/server/dist/index.js --project /path/to/project --host 0.0.0.0 --password <访问密码>
```

- PixelWeb 能替你给 agent 发 prompt、批准它执行 shell 命令。**不设 `--password` 就不要监听 127.0.0.1 以外的地址**，启动时也会给出警告。
- 普通 HTTP 下密码和登录 cookie 是明文传输的。在不可信的网络上，请放到 HTTPS 反向代理后面，或者不开放端口、改用 SSH 隧道：`ssh -L 7420:127.0.0.1:7420 user@server`。
- 浏览器只在 HTTPS 或 localhost 下允许系统通知。通过 `http://服务器IP:7420` 访问时，设置里的“提醒”只能在标签页标题上显示未读数；用 SSH 隧道访问 `http://localhost:7420` 就能收到系统通知。
- 反向代理需要保留 `Host` 或传 `X-Forwarded-Host`：PixelWeb 会拒绝来源（Origin）与之不符的写请求和 WebSocket 连接。
- `npm run dev` 依赖 shell 的 `&`，在 Windows 上请用 `npm run build` 加 `npm start`。

### 用 pm2 常驻

上面两条命令关掉终端就停了。仓库自带 pm2 配置（`ecosystem.config.cjs`），把 `opencode serve` 和 PixelWeb 都交给 pm2：进程崩了会自动拉起，连续 10 次启动不到 10 秒就不再重试。

```bash
npm run pm2:start      # 先 build，再启动两个进程；已在运行就重启，并重新读取 .env
npm run pm2:logs       # 看日志（~/.pm2/logs）
npm run pm2:stop
```

配置写在仓库根目录的 `.env` 里（已被 .gitignore 忽略），shell 里已经设置的同名变量优先：

```bash
PIXELWEB_PROJECT=/path/to/project   # 两个进程的工作目录，也是 PixelWeb 启动时显示的项目；不设就是本仓库
PIXELWEB_HOST=0.0.0.0
PIXELWEB_PASSWORD=<访问密码>
OPENCODE_PORT=4096                  # opencode serve 的端口，PixelWeb 自动连过去
OPENCODE_HOSTNAME=127.0.0.1
OPENCODE_SERVER_PASSWORD=<opencode 密码>   # 两边都会用到
```

- OpenCode 已经用别的方式在跑（比如桌面端）时，只启动 PixelWeb：`npx pm2 start ecosystem.config.cjs --only pixelweb`，再用 `PIXELWEB_OPENCODE_URL` 指过去。
- 开机自启：macOS / Linux 上先执行 `npx pm2 startup`，照它打印的命令做，然后 `npx pm2 save`。Windows 上 pm2 做不了开机自启，需要另装 [pm2-installer](https://github.com/jessety/pm2-installer) 之类的服务包装。
- 改了代码或 `git pull` 之后，再跑一次 `npm run pm2:start` 就会重新 build 并重启。

### 云控制台向导（浏览器插件）

在阿里云、AWS 等控制台里看不懂某个配置页时，用 Chrome / Edge 插件把这一页发给 PixelWeb：它在当前项目下开一个只读的 🧭 会话，结合项目代码告诉你每一项怎么填、要注意什么。回答显示在插件侧边栏里，PixelWeb 时间线里也能看到同一个会话。

```bash
npm run build --workspace=@pixelweb/extension   # 产物在 packages/extension/dist
```

1. Chrome 打开 `chrome://extensions`（Edge 是 `edge://extensions`），打开「开发者模式」，「加载已解压的扩展程序」，选 `packages/extension/dist`。
2. PixelWeb 里打开 设置 → 浏览器插件，生成一个 token（只显示一次）。
3. 点浏览器工具栏上的插件图标打开侧边栏，填 PixelWeb 地址和 token，点「连接」，按提示允许插件访问这个地址。
4. 在控制台里打开看不懂的那一页，点「捕捉这一页」，看过要发的内容再发送。

插件只读阿里云、AWS、华为云、Azure、GCP 控制台的页面，而且只在你点「捕捉」时读；密钥、密码类的值发送前就会被换成 `‹已隐藏›`，密码框从不读取。token 只能发起和查看向导会话，不能批准命令。设计见 [docs/cloud-guide.md](docs/cloud-guide.md)。

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
  shared/    前后端共享的 TypeScript 类型（OpenCode 事件、Git 快照、依赖图、卡片、WS 协议），外加两边共用的 token 统计（steps.js）
  server/    Fastify
    opencode/client.ts   ← 唯一与 OpenCode 打交道的适配器：REST + /global/event SSE（自动重连）
    git/service.ts       ← git log/for-each-ref/status 解析 + chokidar 监听 .git
    analysis/deps.ts     ← import 图提取（TS/JS/Python，正则级，够教学用）
    knowledge/           ← 卡片加载、搜索、学习记录、教学 prompt
    ws.ts / index.ts     ← WebSocket 广播 + /api 路由
  web/       React + Vite；单一 store，事件 reducer 把 SSE 事件合并进消息树
  extension/ 云控制台向导的浏览器插件（Chrome MV3）：页面提取、侧边栏；回答用 web 的 Markdown 渲染
knowledge/   知识卡片（Markdown + frontmatter），见 knowledge/README.md
```

数据流：`opencode serve` ─SSE─▶ `server` ─WebSocket─▶ `web`；浏览器只与 PixelWeb 同源通信，避免 CORS。

学习记录保存在 `~/.pixelweb/learning.json`；自定义卡片可放 `~/.pixelweb/knowledge/` 或 `<项目>/.pixelweb/knowledge/`。

## 路线图

- [ ] 更多 agent 适配器（Claude Code、Codex CLI）——只需实现 `opencode/client.ts` 同样的事件形状
- [ ] 基于 tree-sitter 的精确依赖分析、调用图
- [ ] 按学习记录推送「今天该复习的卡片」（间隔重复）
- [ ] 把 PixelWeb 暴露为 MCP server，让 agent 主动向你「讲解它刚做的事」
