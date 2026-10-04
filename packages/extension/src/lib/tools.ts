import type { OcToolState } from '@pixelweb/shared';

/** A tool call as one short line in the side panel: "读取 src/index.ts", "查文档 help.aliyun.com/…". */
export interface ToolLine {
  verb: string;
  target: string;
  /** a web page the call fetched */
  href?: string;
  status: OcToolState['status'];
}

/** A path inside the project as a project path; anything else as its last two segments. */
export function shortPath(p: string, root?: string): string {
  const norm = (s: string) => s.replace(/\\/g, '/').replace(/\/+$/, '');
  const path = norm(p);
  const base = root ? norm(root) : '';
  if (base && path.toLowerCase().startsWith(base.toLowerCase() + '/')) return path.slice(base.length + 1);
  if (base && path.toLowerCase() === base.toLowerCase()) return '.';
  return path.split('/').slice(-2).join('/');
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 40 ? u.pathname.slice(0, 39) + '…' : u.pathname;
    return u.hostname + (path === '/' ? '' : path);
  } catch {
    return url;
  }
}

export function toolLine(tool: string, state: OcToolState, root?: string): ToolLine {
  const input = (state.input ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '');
  const title = 'title' in state && typeof state.title === 'string' ? state.title : '';
  const base = { status: state.status };
  switch (tool) {
    case 'read':
      return { ...base, verb: '读取', target: shortPath(s('filePath'), root) };
    case 'list':
      return { ...base, verb: '查看目录', target: shortPath(s('path') || '.', root) };
    case 'glob':
      return { ...base, verb: '查找文件', target: s('pattern') };
    case 'grep':
      return { ...base, verb: '搜索代码', target: s('pattern') };
    case 'webfetch':
      return { ...base, verb: '查文档', target: shortUrl(s('url')), href: /^https?:\/\//.test(s('url')) ? s('url') : undefined };
    case 'websearch':
      return { ...base, verb: '搜索网页', target: s('query') };
    case 'bash':
      return { ...base, verb: '运行命令', target: s('command') };
    default:
      return { ...base, verb: tool, target: title };
  }
}
