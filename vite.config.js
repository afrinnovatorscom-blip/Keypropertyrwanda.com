import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Load the single root .env. Only VITE_* variables are exposed to browser code;
  // the rest (e.g. API_URL) is used here for the dev proxy only.
  const env = loadEnv(mode, rootDir, '');
  const apiTarget = env.API_URL || `http://localhost:${env.PORT || 4000}`;
  const proxy = Object.fromEntries(
    ['/api', '/uploads', '/sitemap.xml', '/robots.txt'].map((p) => [p, { target: apiTarget, changeOrigin: false }]),
  );

  return {
    root: rootDir,
    envDir: rootDir,
    envPrefix: 'VITE_',
    publicDir: path.join(rootDir, 'public'),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.join(rootDir, 'src') },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy,
    },
    preview: { port: 4173, proxy },
    build: {
      outDir: path.join(rootDir, 'dist'),
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 900,
    },
  };
});
