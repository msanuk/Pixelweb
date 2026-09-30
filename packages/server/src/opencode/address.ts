/**
 * The OpenCode address typed into 设置: a full URL, `host:port`, or just a port
 * (`opencode serve` without `--port` comes back on a random one, and it's usually the only thing that changed).
 */
export function resolveAddress(input: string, current: string): { url: string } | { error: string } {
  const raw = input.trim();
  if (!raw) return { error: '请填写 OpenCode 的地址或端口' };
  let u: URL;
  try {
    if (/^\d+$/.test(raw)) {
      const port = Number(raw);
      if (port < 1 || port > 65535) return { error: `端口要在 1–65535 之间：${raw}` };
      u = new URL(current);
      u.port = raw;
    } else {
      u = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`);
    }
  } catch {
    return { error: `不是有效的地址：${raw}` };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: `只支持 http 和 https：${raw}` };
  if (!u.hostname) return { error: `地址里没有主机名：${raw}` };
  if (u.username || u.password) return { error: '用户名和密码请填在下面的输入框里，不要写进地址' };
  return { url: u.origin + u.pathname.replace(/\/+$/, '') };
}
