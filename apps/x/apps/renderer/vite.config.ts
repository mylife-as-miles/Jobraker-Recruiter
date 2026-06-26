import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',  // Use relative paths for assets (required for Electron custom protocol)
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Streamdown lazy-loads a shiki code-block chunk; pre-bundle to avoid stale .vite/deps hashes.
    include: ['streamdown', 'shiki'],
  },
  build: {
    outDir: 'dist',
  },
})
