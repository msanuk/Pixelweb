import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: Vite serves the UI on 5173 and proxies /api + /ws to the PixelWeb server on 7420.
// Prod: `vite build` emits into ../server/public, which the server serves statically.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // keep the browser's Host header: the server checks it against Origin to refuse cross-site requests
    proxy: {
      '/api': { target: 'http://127.0.0.1:7420', changeOrigin: false },
      '/ws': { target: 'ws://127.0.0.1:7420', ws: true, changeOrigin: false },
    },
  },
});
