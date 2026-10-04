/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { manifest } from './src/manifest.ts';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const { version } = JSON.parse(readFileSync(here('./package.json'), 'utf8')) as { version: string };

function emitManifest(e2e: boolean): Plugin {
  return {
    name: 'pixelweb-manifest',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify(manifest(version, { e2e }), null, 2) });
    },
  };
}

// The side panel page and the service worker. The content script is a separate IIFE build
// (vite.content.config.ts): scripts injected with chrome.scripting can't be ES modules.
// Load dist/ as an unpacked extension.
export default defineConfig(({ mode }) => ({
  plugins: [react(), emitManifest(mode === 'e2e')],
  base: './',
  resolve: {
    // the reply renderer is the web app's own (components/MarkdownView.tsx, lib/markdown.ts), not a copy
    alias: { '@web': here('../web/src') },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome116',
    modulePreload: false,
    rollupOptions: {
      input: { sidepanel: here('./sidepanel.html'), background: here('./src/background.ts') },
      output: { entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js', assetFileNames: 'assets/[name]-[hash][extname]' },
    },
  },
  // the extraction tests' iframes point at real sites: happy-dom must not fetch them
  test: { environmentOptions: { happyDOM: { settings: { disableIframePageLoading: true } } } },
}));
