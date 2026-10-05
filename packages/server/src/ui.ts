import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';

export const UI_NOT_BUILT =
  'PixelWeb UI not built yet. Run `npm run build` (or `npm run dev:web` for the Vite dev server on :5173) — no server restart needed.';

/**
 * Serves the built web UI from `publicDir` with an SPA fallback.
 *
 * The directory may not exist yet (fresh clone, `npm run dev` before `vite build`): we create it
 * so @fastify/static can register, and check for index.html per request rather than at startup,
 * so a later build is picked up without restarting the server.
 */
export async function registerUi(app: FastifyInstance, publicDir: string): Promise<void> {
  fs.mkdirSync(publicDir, { recursive: true });
  await app.register(fastifyStatic, { root: publicDir, prefix: '/' });
  app.setNotFoundHandler((req, reply) => {
    const url = req.raw.url ?? '';
    if (url.startsWith('/api') || url.startsWith('/ws')) return reply.code(404).send({ error: 'not found' });
    if (!fs.existsSync(path.join(publicDir, 'index.html'))) return reply.code(503).type('text/plain; charset=utf-8').send(UI_NOT_BUILT);
    return reply.sendFile('index.html');
  });
}
