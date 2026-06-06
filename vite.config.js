import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // simple-peer + readable-stream pull these in; force Vite to use the
      // npm packages (with browser-friendly builds) instead of Node builtins.
      events: 'events',
      buffer: 'buffer',
      process: 'process',
    },
  },
  define: {
    // simple-peer checks this in some code paths
    global: 'globalThis',
  },
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
