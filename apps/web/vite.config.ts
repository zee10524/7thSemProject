import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiTarget = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin in dev, like the Vercel rewrite in production: cookies stay first party.
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
    },
  },
  preview: { port: 4173 },
  build: {
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
