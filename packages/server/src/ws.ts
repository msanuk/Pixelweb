import type { WebSocket } from 'ws';
import type { ServerMessage } from '@pixelweb/shared';

/** Fan-out hub: every connected browser tab receives every ServerMessage. */
export class Hub {
  private readonly clients = new Set<WebSocket>();

  add(ws: WebSocket, onMessage: (raw: string) => void): void {
    this.clients.add(ws);
    ws.on('message', (data) => onMessage(data.toString()));
    ws.on('close', () => this.clients.delete(ws));
    ws.on('error', () => this.clients.delete(ws));
  }

  send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) ws.send(data);
    }
  }

  get size(): number {
    return this.clients.size;
  }
}
