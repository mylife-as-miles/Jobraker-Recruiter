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
