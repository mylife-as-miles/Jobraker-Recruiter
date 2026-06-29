import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5174,
    strictPort: false,
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: "@x/shared/src", replacement: path.resolve(__dirname, "../desktop/apps/x/packages/shared/src") },
      { find: "@x/shared/dist", replacement: path.resolve(__dirname, "../desktop/apps/x/packages/shared/src") },
      { find: "@x/shared", replacement: path.resolve(__dirname, "../desktop/apps/x/packages/shared/src/index.ts") },
    ],
  },
  optimizeDeps: {
    // Streamdown lazy-loads a shiki code-block chunk; pre-bundle to avoid stale .vite/deps hashes.
    include: ['streamdown', 'shiki'],
  },
  build: {
    outDir: 'dist',
  },
})
