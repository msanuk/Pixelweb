import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ExtHello } from '@pixelweb/shared';
import { Icon } from '@web/components/Icon';
import { buildMatcher, type TermMatcher } from '@web/lib/terms';
import { ApiError, hello, terms as fetchTerms, type ServerConfig } from '../lib/api';
import { loadCaptures, loadServer, loadThread, panelWindowId, saveThread, watchCaptures, type CaptureRecord, type Thread } from '../lib/chrome';
import { Composer } from './Composer';
import { Setup } from './Setup';
import { ThreadView } from './ThreadView';
import { useGuide } from './useGuide';

type Conn = { state: 'checking' } | { state: 'ok'; hello: ExtHello } | { state: 'error'; error: string; status: number };

const basename = (p: string) => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? p;

export function App() {
  const [server, setServer] = useState<ServerConfig | null>();
  const [setup, setSetup] = useState(false);
  const [conn, setConn] = useState<Conn>({ state: 'checking' });
  const [windowId, setWindowId] = useState<number>();
  const [thread, setThreadState] = useState<Thread | null>(null);
  const guide = useGuide(server, thread?.sessionID);
  const [captures, setCaptures] = useState<CaptureRecord[]>([]);
  const [terms, setTerms] = useState<TermMatcher | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    void (async () => {
      const w = await panelWindowId();
      setWindowId(w);
      setThreadState(await loadThread(w));
      setServer(await loadServer());
    })();
  }, []);

  const check = useCallback(async (cfg: ServerConfig) => {
    setConn({ state: 'checking' });
    try {
      setConn({ state: 'ok', hello: await hello(cfg) });
    } catch (e) {
      setConn({ state: 'error', error: e instanceof Error ? e.message : String(e), status: e instanceof ApiError ? e.status : 0 });
    }
  }, []);

  useEffect(() => {
    if (server) void check(server);
  }, [server, check]);

  // knowledge terms become links to their card; without them replies are just plain text
  useEffect(() => {
    setTerms(null);
    if (server) fetchTerms(server).then((list) => setTerms(buildMatcher(list)), () => undefined);
  }, [server]);

  useEffect(() => {
    setCaptures([]);
    const id = thread?.sessionID;
    if (!id) return;
    void loadCaptures(id).then(setCaptures);
    return watchCaptures(id, setCaptures);
  }, [thread?.sessionID]);

  const setThread = (t: Thread | null) => {
    setThreadState(t);
    pinned.current = true;
    if (windowId !== undefined) void saveThread(windowId, t);
  };

  // keep the newest text in view while it streams, unless the user scrolled up to read
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  });

  if (server === undefined) return null;
  if (!server || setup)
    return (
      <Setup
        current={server}
        onConnected={(cfg, h) => {
          setServer(cfg);
          setConn({ state: 'ok', hello: h });
          setSetup(false);
        }}
        onCancel={server ? () => setSetup(false) : undefined}
        onDisconnected={() => {
          setServer(null);
          setSetup(false);
        }}
      />
    );

  const info = conn.state === 'ok' ? conn.hello : null;
  const opencode = !!info?.opencodeConnected && guide.opencode;

  return (
    <div className="app">
      <header className="bar">
        <strong>PixelWeb 向导</strong>
        {info && (
          <span className="project" title={`${info.projectRoot}\nOpenCode ${opencode ? '已连接' : '未连接'}`}>
            <span className={`dot ${opencode ? 'on' : ''}`} />
            {basename(info.projectRoot)}
          </span>
        )}
        <span className="spacer" />
        <button className="icon-btn" title="连接设置" onClick={() => setSetup(true)}>
          <Icon name="settings" />
        </button>
      </header>

      {conn.state === 'error' && (
        <div className="banner bad">
          {conn.error}{' '}
          {conn.status === 401 ? (
            <button className="link" onClick={() => setSetup(true)}>
              重新配对
            </button>
          ) : (
            <button className="link" onClick={() => void check(server)}>
              重试
            </button>
          )}
        </div>
      )}

      {thread && (
        <div className="thread-head">
          <span className="title" title={thread.title}>
            {thread.title}
          </span>
          <a href={server.origin} target="_blank" rel="noreferrer" title="同一个对话在 PixelWeb 的时间线里也能看">
            在 PixelWeb 里看
          </a>
          <button className="link" onClick={() => setThread(null)} disabled={guide.busy} title={guide.busy ? '等这次回答结束' : undefined}>
            新对话
          </button>
        </div>
      )}

      <div
        className="scroll"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {thread ? (
          <ThreadView guide={guide} root={info?.projectRoot} origin={server.origin} captures={captures} terms={terms} />
        ) : (
          <Welcome project={info ? basename(info.projectRoot) : ''} />
        )}
      </div>

      <Composer
        server={server}
        thread={thread}
        busy={guide.busy}
        windowId={windowId}
        model={thread ? guide.model : info?.model}
        onStarted={setThread}
      />
    </div>
  );
}

function Welcome({ project }: { project: string }) {
  return (
    <div className="welcome">
      <h2>看不懂云控制台的配置页？</h2>
      <ol className="steps">
        <li>在阿里云、AWS 等控制台打开那一页。</li>
        <li>
          点下面的 <strong>捕捉这一页</strong>：插件把页面上的字段和说明整理出来，隐藏密钥，先给你过目。
        </li>
        <li>发送后，PixelWeb 结合{project ? `项目 ${project}` : '当前项目'}告诉你每一项怎么填、要注意什么。</li>
      </ol>
      <p className="muted small">
        分好几步的向导，填完一页可以点「捕捉下一页」接着问。回答里的字段标签点一下，页面上就会标出那一项。插件只读页面，不会替你填写或点击。
      </p>
      <p className="muted small">别的网站，或者只想问页面上的一部分：在页面上点右键，选「用 PixelWeb 向导看这一页」或「解释选中的部分」。</p>
    </div>
  );
}
