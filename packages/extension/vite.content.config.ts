import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The page reader, injected into the console page with chrome.scripting.executeScript({ files }).
// Runs after vite.config.ts and adds dist/content.js next to its output.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    copyPublicDir: false,
    target: 'chrome116',
    lib: {
      entry: fileURLToPath(new URL('./src/content/index.ts', import.meta.url)),
      formats: ['iife'],
      name: 'PixelWebCapture',
      fileName: () => 'content.js',
    },
  },
});
