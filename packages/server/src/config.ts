import path from 'node:path';
import os from 'node:os';

export interface PixelwebConfig {
  /** Port PixelWeb itself listens on. */
  port: number;
  host: string;
  /** Base URL of `opencode serve`. */
  opencodeUrl: string;
  /** Optional basic-auth credentials (OPENCODE_SERVER_USERNAME / _PASSWORD on the opencode side). */
  opencodeUsername: string;
  opencodePassword?: string;
  /** Password for the PixelWeb UI itself; unset = no login (only safe on 127.0.0.1). */
  password?: string;
  /** Project directory to visualise. Defaults to cwd; the UI can switch it at runtime (POST /api/project). */
  projectRoot: string;
  /** Where learning records are persisted. */
  dataDir: string;
  /** Print raw opencode events to stdout. */
  verbose: boolean;
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}

export function loadConfig(argv = process.argv.slice(2), env = process.env): PixelwebConfig {
  const projectRoot = path.resolve(flag(argv, 'project') ?? env.PIXELWEB_PROJECT ?? process.cwd());
  return {
    port: Number(flag(argv, 'port') ?? env.PIXELWEB_PORT ?? 7420),
    host: flag(argv, 'host') ?? env.PIXELWEB_HOST ?? '127.0.0.1',
    opencodeUrl: (flag(argv, 'opencode') ?? env.PIXELWEB_OPENCODE_URL ?? 'http://127.0.0.1:4096').replace(/\/$/, ''),
    opencodeUsername: flag(argv, 'opencode-username') ?? env.OPENCODE_SERVER_USERNAME ?? 'opencode',
    opencodePassword: flag(argv, 'opencode-password') ?? env.OPENCODE_SERVER_PASSWORD,
    password: flag(argv, 'password') ?? env.PIXELWEB_PASSWORD,
    projectRoot,
    dataDir: flag(argv, 'data-dir') ?? env.PIXELWEB_DATA_DIR ?? path.join(os.homedir(), '.pixelweb'),
    verbose: argv.includes('--verbose') || env.PIXELWEB_VERBOSE === '1',
  };
}

export function printUsage(): void {
  console.log(`pixelweb — visual, teaching-oriented workbench on top of OpenCode

Usage: pixelweb [options]

  --opencode <url>          opencode serve base URL   (default http://127.0.0.1:4096)
  --opencode-username <u>   basic-auth username for opencode (default opencode)
  --opencode-password <pw>  basic-auth password if opencode is protected
  --password <pw>           require this password to use PixelWeb (env PIXELWEB_PASSWORD)
  --project <dir>           project directory to visualise (default: cwd)
  --port <n>                PixelWeb port (default 7420)
  --host <addr>             PixelWeb bind address (default 127.0.0.1; set --password before exposing it)
  --data-dir <dir>          learning records location (default ~/.pixelweb)
  --verbose                 log every opencode event
`);
}
