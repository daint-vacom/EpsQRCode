import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const certificatePath = fileURLToPath(
  new URL('./.cert/localhost.pfx', import.meta.url),
);

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE_URL || '/',
  server: {
    // Honor PORT env (used by preview tooling); fall back to Vite default.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    https:
      command === 'serve'
        ? {
            pfx: readFileSync(certificatePath),
            passphrase: 'epsqrcode-local-dev',
          }
        : undefined,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 3000,
  },
}));
