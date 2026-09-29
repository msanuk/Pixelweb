import type { ClientMessage, ServerMessage } from '@pixelweb/shared';
import { applyEvent, getState, loadModels, loadOpencodeData, setServer, setState } from './store';
import { onOpencodeEvent } from './notify';

let socket: WebSocket | null = null;
let retry = 1000;
/** The page's first status is covered by loadInitial; later ones that bring OpenCode up mean reloading. */
let statusSeen = false;

export function connect(): void {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${proto}://${location.host}/ws`);
  socket.onopen = () => {
    retry = 1000;
    setState({ wsConnected: true });
  };
  socket.onclose = () => {
    // unknown until the server says again; if it restarted, reconnecting reloads what it may have missed
    setState({ wsConnected: false, opencodeConnected: false });
    if (getState().needLogin) return; // the login screen reloads the page once signed in
    setTimeout(connect, retry);
    retry = Math.min(retry * 2, 10000);
  };
  socket.onerror = () => socket?.close();
  socket.onmessage = (e) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    switch (msg.type) {
      case 'hello':
        setServer(msg.server);
        break;
      case 'opencode.status': {
        const cameUp = statusSeen && msg.connected && !getState().opencodeConnected;
        statusSeen = true;
        setState({ opencodeConnected: msg.connected, opencodeError: msg.error });
        if (getState().needLogin) break;
        // started after PixelWeb, restarted, or another address from 设置
        if (cameUp) void loadOpencodeData();
        else if (msg.connected && !getState().modelInfo) void loadModels();
        break;
      }
      case 'opencode.event': {
        const sid = (msg.event.properties as { sessionID?: string }).sessionID;
        const prevStatus = sid ? getState().status[sid] : undefined;
        applyEvent(msg.event, msg.receivedAt);
        onOpencodeEvent(msg.event, prevStatus);
        break;
      }
      case 'git.snapshot':
        setState({ git: msg.snapshot });
        break;
      case 'arch.graph':
        setState({ arch: msg.graph });
        break;
      case 'learning.state':
        setState({ learning: msg.state });
        break;
      case 'activity.commits':
        setState({ commitLinks: msg.links });
        break;
    }
  };
}

export function send(msg: ClientMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}
