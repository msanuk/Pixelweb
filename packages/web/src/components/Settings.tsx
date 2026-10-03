import { useEffect, useRef, useState } from 'react';
import type { ExtTokenCreated, ExtTokenInfo, OpencodeConnection } from '@pixelweb/shared';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { PALETTES, THEMES, setPalette, setTheme, usePalette, useTheme } from '../lib/theme';
import { SCALES, resetSettings, updateSettings, useSettings, type Settings as Prefs } from '../lib/settings';
import { deliver, enableNotifications, notifyPermission, notifySupport } from '../lib/notify';
import { fmtDate, relTime } from '../lib/format';
import { Icon } from './Icon';

/** Per-browser preferences, plus the server's OpenCode connection (changeable for this run; project and password are shown read-only). */
export function SettingsDialog({ onClose, focusConnection = false }: { onClose: () => void; focusConnection?: boolean }) {
  const prefs = useSettings();
  const theme = useTheme();
  const palette = usePalette();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="modal-head">
          <h2 id="settings-title">设置</h2>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="关闭设置">
            <Icon name="close" />
          </button>
        </header>

        <div className="modal-body">
          <section>
            <h3>外观</h3>
            <Row label="配色" hint="纸墨是黑白灰；陶土是奶油底色加陶土橙，回复正文用衬线字体">
              <Seg value={palette} options={PALETTES.map((p) => [p.id, p.label])} onChange={setPalette} label="配色" />
            </Row>
            <Row label="明暗">
              <Seg value={theme} options={THEMES.map((t) => [t.id, t.label])} onChange={setTheme} label="明暗" />
            </Row>
            <Row label="界面缩放">
              <Seg value={prefs.scale} options={SCALES.map((s) => [s, `${s}%`])} onChange={(scale) => updateSettings({ scale })} label="界面缩放" />
            </Row>
            <Row label="密度" hint="紧凑模式缩小时间线和会话列表的间距">
              <Seg
                value={prefs.density}
                options={[
                  ['comfortable', '舒适'],
                  ['compact', '紧凑'],
                ]}
                onChange={(density) => updateSettings({ density })}
                label="密度"
              />
            </Row>
          </section>

          <section>
            <h3>学习</h3>
            <Check checked={prefs.highlightTerms} onChange={(highlightTerms) => updateSettings({ highlightTerms })} hint="在 agent 的回复和说明文字里，给认识的概念加虚线，点开就是知识卡片">
              术语高亮
            </Check>
          </section>

          <NotifySection prefs={prefs} />
          <ConnectionSection focus={focusConnection} />
          <ExtensionSection />
        </div>

        <footer className="modal-foot">
          <button
            onClick={() => {
              resetSettings();
              setTheme('system');
            }}
          >
            恢复默认
          </button>
          <span className="spacer" />
          <button className="primary" onClick={onClose}>
            完成
          </button>
        </footer>
      </div>
    </div>
  );
}

function NotifySection({ prefs }: { prefs: Prefs }) {
  const support = notifySupport();
  const [perm, setPerm] = useState(notifyPermission());
  const n = prefs.notify;

  const toggle = async (enabled: boolean) => {
    updateSettings({ notify: { enabled } });
    if (enabled) setPerm(await enableNotifications());
  };

  let status: React.ReactNode;
  if (support === 'insecure') {
    status = (
      <>
        浏览器只在 HTTPS 或 localhost 下允许系统通知，现在是通过 <code>{location.host}</code> 的 HTTP 访问。开启后仍会在标签页标题上显示未读数，比如「(2) PixelWeb」。
      </>
    );
  } else if (support === 'unsupported') {
    status = '这个浏览器不支持系统通知；开启后会在标签页标题上显示未读数。';
  } else if (perm === 'denied') {
    status = '浏览器拒绝了通知权限：点地址栏左侧的站点设置，把“通知”改为允许。';
  } else if (perm === 'granted') {
    status = '系统通知已允许。';
  } else {
    status = '开启时浏览器会询问是否允许通知。';
  }

  return (
    <section>
      <h3>通知</h3>
      <Check checked={n.enabled} onChange={(v) => void toggle(v)} hint="不用一直盯着页面：agent 做完、要你批准或出错时提醒你">
        开启提醒
      </Check>
      <div className={`sub-options ${n.enabled ? '' : 'disabled'}`}>
        <Check checked={n.done} disabled={!n.enabled} onChange={(done) => updateSettings({ notify: { done } })}>
          agent 完成一轮回复
        </Check>
        <Check checked={n.permission} disabled={!n.enabled} onChange={(permission) => updateSettings({ notify: { permission } })}>
          需要批准权限
        </Check>
        <Check checked={n.error} disabled={!n.enabled} onChange={(error) => updateSettings({ notify: { error } })}>
          出错
        </Check>
        <Check checked={n.onlyWhenHidden} disabled={!n.enabled} onChange={(onlyWhenHidden) => updateSettings({ notify: { onlyWhenHidden } })}>
          只在切到别的窗口或标签页时提醒
        </Check>
      </div>
      <p className="muted small">
        {status}
        {n.enabled && perm === 'granted' && (
          <>
            {' '}
            <button className="link-btn" onClick={() => deliver({ tag: 'pixelweb-test', title: 'PixelWeb 测试通知', body: '通知可以正常弹出。' }, false)}>
              发一条测试通知
            </button>
          </>
        )}
      </p>
    </section>
  );
}

function ConnectionSection({ focus }: { focus: boolean }) {
  const server = useStore((s) => s.server);
  const oc = useStore((s) => s.opencodeConnected);
  const ocError = useStore((s) => s.opencodeError);
  const authRequired = useStore((s) => s.authRequired);
  const [conn, setConn] = useState<OpencodeConnection | null>(null);
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const focused = useRef(false);

  const show = (c: OpencodeConnection) => {
    setConn(c);
    setUrl(c.url);
    setUsername(c.username);
    setPassword('');
  };
  // again when another tab changes the address (every tab gets the new `hello`)
  useEffect(() => {
    api.opencode().then(show).catch(() => {});
  }, [server?.opencodeUrl]);
  useEffect(() => {
    if (!focus || !conn || focused.current || !urlRef.current) return;
    focused.current = true;
    urlRef.current.scrollIntoView({ block: 'center' });
    urlRef.current.focus();
    urlRef.current.select();
  }, [focus, conn]);

  const dirty = !!conn && (url.trim() !== conn.url || username.trim() !== conn.username || password !== '');
  const connect = async (changes: Parameters<typeof api.connectOpencode>[0]) => {
    setBusy(true);
    setFormError(null);
    try {
      show(await api.connectOpencode(changes));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h3>连接</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) void connect({ url, username, ...(password ? { password } : {}) });
        }}
      >
        <dl className="settings-dl">
          <dt>OpenCode</dt>
          <dd className={busy ? 'muted' : oc ? '' : 'error'}>
            {busy ? '连接中…' : oc ? '已连接' : `未连接${ocError ? `：${ocError}` : ''}`}
          </dd>
          <dt>
            <label htmlFor="oc-url">地址</label>
          </dt>
          <dd>
            <input ref={urlRef} id="oc-url" className="mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://127.0.0.1:4096" spellCheck={false} disabled={!conn} />
          </dd>
          <dt>
            <label htmlFor="oc-user">用户名</label>
          </dt>
          <dd>
            <input id="oc-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="opencode" autoComplete="off" spellCheck={false} disabled={!conn} />
          </dd>
          <dt>
            <label htmlFor="oc-pass">密码</label>
          </dt>
          <dd>
            <input
              id="oc-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={conn?.hasPassword ? '已设置，留空不改' : '未设置'}
              autoComplete="new-password"
              disabled={!conn}
            />
          </dd>
          <dt />
          <dd className="conn-actions">
            <button type="submit" className="primary" disabled={busy || !dirty}>
              保存并重连
            </button>
            {!oc && (
              <button type="button" disabled={busy} onClick={() => void connect({})}>
                立即重试
              </button>
            )}
            {formError && <span className="error small">{formError}</span>}
          </dd>
          <dt>项目目录</dt>
          <dd className="mono">{server?.projectRoot ?? '—'}</dd>
          <dt>访问密码</dt>
          <dd>{authRequired ? '已开启' : '未开启'}</dd>
          <dt>PixelWeb</dt>
          <dd className="mono">v{server?.version ?? '?'}</dd>
        </dl>
      </form>
      <p className="muted small">
        OpenCode 地址可以只填端口（比如 <code>4097</code>），主机沿用现在的。在这里改的只在这次运行中有效，重启 PixelWeb 后回到启动参数 <code>--opencode</code>。项目在顶栏切换；访问密码由 <code>--password</code> 决定，修改要重启。
      </p>
    </section>
  );
}

/** Pairing the cloud guide browser extension (docs/cloud-guide.md): make a token, see who's paired, revoke. */
function ExtensionSection() {
  const [tokens, setTokens] = useState<ExtTokenInfo[] | null>(null);
  const [name, setName] = useState('');
  const [created, setCreated] = useState<ExtTokenCreated | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newRef = useRef<HTMLDivElement>(null);

  const load = () =>
    api
      .extTokens()
      .then(setTokens)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => {
    void load();
  }, []);
  // the token is the one thing to see now, and it lands below the fold
  useEffect(() => {
    if (created) newRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [created]);
  // "撤销" asks once more; the second click has to come soon
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(null), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const create = () =>
    run(async () => {
      setCreated(await api.createExtToken(name.trim()));
      setName('');
      await load();
    });
  const revoke = (id: string) =>
    run(async () => {
      await api.revokeExtToken(id);
      setConfirming(null);
      if (created?.info.id === id) setCreated(null);
      await load();
    });

  return (
    <section>
      <h3>浏览器插件</h3>
      <p className="muted small">
        云控制台向导插件用配对 token 连接 PixelWeb。token 只能新建和追问 🧭 指导会话：碰不到别的会话，也不能批准 agent 运行命令，那些仍然只能在这里批准。
      </p>

      {created && (
        <div ref={newRef} className="ext-new" role="status">
          <p>
            「{created.info.name}」的 token 已生成。<strong>它只显示这一次</strong>，关掉设置就看不到了，请复制到插件的设置里：
          </p>
          <dl className="settings-dl">
            <dt>服务器地址</dt>
            <dd>
              <CopyField value={location.origin} label="服务器地址" />
            </dd>
            <dt>Token</dt>
            <dd>
              <CopyField value={created.token} label="Token" />
            </dd>
          </dl>
          <button className="link-btn small" onClick={() => setCreated(null)}>
            已经复制好了
          </button>
        </div>
      )}

      <form
        className="ext-create"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="设备名称，比如 MacBook Chrome" maxLength={40} aria-label="设备名称" />
        <button type="submit" className="primary" disabled={busy}>
          生成 token
        </button>
      </form>
      {error && <p className="error small">{error}</p>}

      {tokens && tokens.length > 0 && (
        <ul className="ext-list">
          {tokens.map((t) => (
            <li key={t.id}>
              <div className="ext-name">{t.name}</div>
              <div className="muted small">
                {fmtDate(t.createdAt)} 配对 · {t.lastUsedAt ? `${relTime(t.lastUsedAt)}用过` : '还没用过'}
              </div>
              <button className={confirming === t.id ? 'danger' : ''} disabled={busy} onClick={() => (confirming === t.id ? void revoke(t.id) : setConfirming(t.id))}>
                {confirming === t.id ? '确定撤销' : '撤销'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {tokens?.length === 0 && !created && <p className="muted small">还没有配对的浏览器。</p>}
    </section>
  );
}

/**
 * A read-only value with a copy button. The Clipboard API only exists on HTTPS or localhost;
 * over plain http://<server-ip> the text is selected and copied the old way instead.
 */
function CopyField({ value, label }: { value: string; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      ref.current?.select();
      ok = document.execCommand('copy');
    }
    if (!ok) return; // the text stays selected for ⌘C
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <span className="copy-field">
      <input ref={ref} className="mono" value={value} readOnly onFocus={(e) => e.target.select()} aria-label={label} />
      <button type="button" onClick={() => void copy()}>
        {copied ? '已复制' : '复制'}
      </button>
    </span>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div>
        <div>{label}</div>
        {hint && <div className="muted small">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Check({ checked, onChange, disabled, hint, children }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="settings-check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {children}
        {hint && <span className="muted small block">{hint}</span>}
      </span>
    </label>
  );
}

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={String(v)} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}
