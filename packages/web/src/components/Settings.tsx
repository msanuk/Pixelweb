import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { PALETTES, THEMES, setPalette, setTheme, usePalette, useTheme } from '../lib/theme';
import { SCALES, resetSettings, updateSettings, useSettings, type Settings as Prefs } from '../lib/settings';
import { deliver, enableNotifications, notifyPermission, notifySupport } from '../lib/notify';
import { Icon } from './Icon';

/** Per-browser preferences. Server-side settings (project, OpenCode URL, password) are start-up flags, shown read-only. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
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
          <ConnectionSection />
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

function ConnectionSection() {
  const server = useStore((s) => s.server);
  const oc = useStore((s) => s.opencodeConnected);
  const authRequired = useStore((s) => s.authRequired);
  return (
    <section>
      <h3>连接</h3>
      <dl className="settings-dl">
        <dt>项目目录</dt>
        <dd className="mono">{server?.projectRoot ?? '—'}</dd>
        <dt>OpenCode</dt>
        <dd>
          <span className="mono">{server?.opencodeUrl ?? '—'}</span> · {oc ? '已连接' : '未连接'}
        </dd>
        <dt>访问密码</dt>
        <dd>{authRequired ? '已开启' : '未开启'}</dd>
        <dt>PixelWeb</dt>
        <dd className="mono">v{server?.version ?? '?'}</dd>
      </dl>
      <p className="muted small">
        这几项由启动参数决定（<code>--project</code>、<code>--opencode</code>、<code>--password</code>），修改后需要重启 PixelWeb。
      </p>
    </section>
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
