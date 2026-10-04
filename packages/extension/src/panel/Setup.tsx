import { useState, type FormEvent } from 'react';
import type { ExtHello } from '@pixelweb/shared';
import { hello, originPattern, serverOrigin, type ServerConfig } from '../lib/api';
import { clearServer, saveServer } from '../lib/chrome';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Pairing: the PixelWeb address plus a token made in its 设置 → 浏览器插件. */
export function Setup({
  current,
  onConnected,
  onCancel,
  onDisconnected,
}: {
  current: ServerConfig | null;
  onConnected: (cfg: ServerConfig, hello: ExtHello) => void;
  onCancel?: () => void;
  onDisconnected: () => void;
}) {
  const [address, setAddress] = useState(current?.origin ?? '');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const connect = (e: FormEvent) => {
    e.preventDefault();
    const origin = serverOrigin(address);
    if (!origin) return setError('地址不对：填 PixelWeb 的网址，比如 http://192.168.1.10:7420');
    // leaving the token empty keeps the saved one, as long as the address is the same
    const tok = token.trim() || (current?.origin === origin ? current.token : '');
    if (!tok) return setError('请粘贴配对 token。');
    if (!tok.startsWith('pwx_')) return setError('这不像配对 token：PixelWeb 生成的 token 以 pwx_ 开头。');
    setBusy(true);
    setError('');
    // asked straight from the click: Chrome only shows the prompt while the user gesture lasts
    chrome.permissions
      .request({ origins: [originPattern(origin)] })
      .then(async (granted) => {
        if (!granted) throw new Error('要允许插件访问这个地址，才能连上 PixelWeb。');
        const cfg = { origin, token: tok };
        const h = await hello(cfg);
        await saveServer(cfg);
        onConnected(cfg, h);
      })
      .catch((err) => setError(message(err)))
      .finally(() => setBusy(false));
  };

  const disconnect = async () => {
    await clearServer();
    if (current) await chrome.permissions.remove({ origins: [originPattern(current.origin)] }).catch(() => undefined);
    onDisconnected();
  };

  return (
    <form className="setup" onSubmit={connect}>
      <h2>连接 PixelWeb</h2>
      <ol className="steps">
        <li>
          打开 PixelWeb，进入 <strong>设置 → 浏览器插件</strong>，生成一个 token。
        </li>
        <li>把 PixelWeb 的地址和 token 粘贴到下面。</li>
      </ol>
      <label>
        PixelWeb 地址
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="http://192.168.1.10:7420" autoFocus={!current} spellCheck={false} />
      </label>
      <label>
        配对 token
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={current ? '不换 token 就留空' : 'pwx_…'}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {error && <div className="banner bad">{error}</div>}
      <div className="row">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? '连接中…' : '连接'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            取消
          </button>
        )}
        <span className="spacer" />
        {current && (
          <button type="button" className="danger" onClick={() => void disconnect()}>
            断开
          </button>
        )}
      </div>
      <p className="muted small">
        token 只存在这个浏览器里。它只能发起和查看向导对话：不能批准命令，也碰不到 PixelWeb 里别的会话。不用了可以在 PixelWeb 里撤销。
      </p>
    </form>
  );
}
