import { defineConfig } from 'vite';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: browserslistToEsbuild(),
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
