import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-extension-assets',
      closeBundle() {
        copyFileSync('manifest.json', 'dist/manifest.json');
        if (!existsSync('dist/icons')) mkdirSync('dist/icons', { recursive: true });
        for (const size of ['16', '48', '128']) {
          try {
            copyFileSync(`public/icons/icon${size}.png`, `dist/icons/icon${size}.png`);
          } catch {}
        }
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/service_worker.ts'),
        content: resolve(__dirname, 'src/content/inject.ts'),
        inpage: resolve(__dirname, 'src/inpage/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    target: 'chrome100',
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: { '@lib': resolve(__dirname, 'src/lib') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/__tests__/setup.ts'],
  },
});
