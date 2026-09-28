export function fmtTime(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms < 1e12 ? ms * 1000 : ms);
  return d.toLocaleTimeString('zh-CN', { hour12: false });
}

export function fmtDate(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms < 1e12 ? ms * 1000 : ms);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
}

export function relTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

/** Teaching sessions are titled "📖 <term>" by the server; the UI marks them with an icon instead. */
const TEACH_PREFIX = /^(?:📖\s*)+/u;

export function isTeachingTitle(title: string): boolean {
  return TEACH_PREFIX.test(title);
}

/** OpenCode's placeholder until its title agent has named the session. */
const UNTITLED = /^(New|Child) session - (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/;

export function displayTitle(title: string): string {
  const u = UNTITLED.exec(title);
  if (u) return `${u[1] === 'New' ? '新会话' : '子会话'} · ${fmtDate(Date.parse(u[2]))}`;
  return title.replace(TEACH_PREFIX, '');
}
