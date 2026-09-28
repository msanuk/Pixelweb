// pm2 process file: `npm run pm2:start` builds, then starts (or reloads) both processes.
// Settings come from the shell or from a `.env` next to this file; see README "用 pm2 常驻".
// Only PixelWeb (e.g. OpenCode runs elsewhere): `npx pm2 start ecosystem.config.cjs --only pixelweb`.
const fs = require('node:fs');
const path = require('node:path');

const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const env = process.env;

const opencodeHost = env.OPENCODE_HOSTNAME ?? '127.0.0.1';
const opencodePort = env.OPENCODE_PORT ?? '4096';
const project = env.PIXELWEB_PROJECT ? path.resolve(env.PIXELWEB_PROJECT) : __dirname;

/** Only the variables that are set, so the processes' own defaults apply to the rest. */
const pick = (...keys) => Object.fromEntries(keys.filter((k) => env[k] !== undefined).map((k) => [k, env[k]]));

const restart = {
  autorestart: true,
  // a process that dies within 10s of starting counts as a failed start; pm2 gives up after 10 in a row
  min_uptime: '10s',
  max_restarts: 10,
  // 100ms, 150ms, 225ms… up to 15s between restarts while it keeps crashing
  exp_backoff_restart_delay: 100,
  // PixelWeb closes the git watcher and open sockets on SIGINT before exiting
  kill_timeout: 5000,
  time: true,
};

module.exports = {
  apps: [
    {
      name: 'opencode',
      // npm installs opencode as a .cmd shim on Windows, which can't be spawned without a shell
      ...(process.platform === 'win32'
        ? { script: 'cmd.exe', args: ['/c', 'opencode', 'serve', '--hostname', opencodeHost, '--port', opencodePort] }
        : { script: 'opencode', args: ['serve', '--hostname', opencodeHost, '--port', opencodePort] }),
      interpreter: 'none',
      cwd: project,
      env: pick('OPENCODE_SERVER_USERNAME', 'OPENCODE_SERVER_PASSWORD'),
      ...restart,
    },
    {
      name: 'pixelweb',
      script: 'packages/server/dist/index.js',
      cwd: __dirname,
      env: {
        PIXELWEB_OPENCODE_URL: `http://${opencodeHost === '0.0.0.0' ? '127.0.0.1' : opencodeHost}:${opencodePort}`,
        PIXELWEB_PROJECT: project,
        ...pick(
          'PIXELWEB_OPENCODE_URL',
          'PIXELWEB_PORT',
          'PIXELWEB_HOST',
          'PIXELWEB_PASSWORD',
          'PIXELWEB_DATA_DIR',
          'PIXELWEB_VERBOSE',
          'OPENCODE_SERVER_USERNAME',
          'OPENCODE_SERVER_PASSWORD',
        ),
      },
      ...restart,
    },
  ],
};
