# 部署

PixelWeb 需要读取项目的源码和 git 仓库，还要把项目路径传给 OpenCode，所以它必须和 `opencode serve`、项目文件在同一台机器上。OpenCode 只需要监听本机。

```bash
# 服务器上（Windows 路径同理，例如 D:\code\proj）
cd /path/to/project && opencode serve --port 4096
node packages/server/dist/index.js --project /path/to/project --host 0.0.0.0 --password <访问密码>
```

## 安全

PixelWeb 可以替你给 agent 发 prompt、批准 shell 命令，对外开放前请注意：

- 没有设置 `--password` 时不要监听 `127.0.0.1` 以外的地址，否则启动时会打印警告。
- 普通 HTTP 下密码和登录 cookie 都是明文传输。在不可信的网络上，请放到 HTTPS 反向代理后面，或者不开放端口，改用 SSH 隧道：`ssh -L 7420:127.0.0.1:7420 user@server`。
- 反向代理要保留 `Host` 头，或者传 `X-Forwarded-Host`。PixelWeb 会拒绝 `Origin` 和它不一致的写请求和 WebSocket 连接。

## 系统通知

浏览器只在 HTTPS 或 localhost 下允许系统通知。通过 `http://<服务器 IP>:7420` 访问时，设置里的「提醒」只能在标签页标题上显示未读数；用 SSH 隧道访问 `http://localhost:7420` 就能收到系统通知。

## 用 pm2 常驻

上面的两条命令在终端关闭后就会停止。仓库里带了 pm2 配置（`ecosystem.config.cjs`），可以把 `opencode serve` 和 PixelWeb 一起交给 pm2 管理。进程崩溃后会自动重启；如果连续 10 次在启动后 10 秒内退出，pm2 就不再重试。

```bash
npm run pm2:start      # 先 build，再启动两个进程；已经在运行时会重启并重新读取 .env
npm run pm2:logs       # 查看日志（~/.pm2/logs）
npm run pm2:stop
```

配置写在仓库根目录的 `.env` 里（已加入 `.gitignore`），shell 里已经设置的同名变量优先：

```bash
PIXELWEB_PROJECT=/path/to/project          # 两个进程的工作目录，也是 PixelWeb 启动时打开的项目；不设置时是本仓库
PIXELWEB_HOST=0.0.0.0
PIXELWEB_PASSWORD=<访问密码>
OPENCODE_PORT=4096                         # opencode serve 的端口，PixelWeb 会自动连接
OPENCODE_HOSTNAME=127.0.0.1
OPENCODE_SERVER_PASSWORD=<opencode 密码>    # 两个进程都会用到
```

其他情况：

- OpenCode 已经用别的方式在运行（比如桌面端）时，只启动 PixelWeb：`npx pm2 start ecosystem.config.cjs --only pixelweb`，并用 `PIXELWEB_OPENCODE_URL` 指向它。
- 开机自启：macOS 和 Linux 上先执行 `npx pm2 startup`，按它打印的命令操作，再执行 `npx pm2 save`。pm2 在 Windows 上不支持开机自启，需要另外安装 [pm2-installer](https://github.com/jessety/pm2-installer) 这类服务包装。
- 修改代码或 `git pull` 之后，再执行一次 `npm run pm2:start` 就会重新构建并重启。
