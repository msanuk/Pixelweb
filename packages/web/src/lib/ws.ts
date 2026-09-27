import type { ClientMessage, ServerMessage } from '@pixelweb/shared';
import { applyEvent, getState, loadModels, setState } from './store';

let socket: WebSocket | null = null;
let retry = 1000;

export function connect(): void {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${proto}://${location.host}/ws`);
  socket.onopen = () => {
    retry = 1000;
    setState({ wsConnected: true });
  };
  socket.onclose = () => {
    setState({ wsConnected: false });
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
        setState({ server: msg.server });
        break;
      case 'opencode.status':
        setState({ opencodeConnected: msg.connected, opencodeError: msg.error });
        if (msg.connected && !getState().modelInfo && !getState().needLogin) void loadModels();
        break;
      case 'opencode.event':
        applyEvent(msg.event, msg.receivedAt);
        break;
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
