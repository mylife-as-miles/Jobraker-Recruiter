import path from "path"
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const settingsDialogPath = path
  .resolve(__dirname, "./src/components/settings-dialog.tsx")
  .replaceAll("\\", "/")
const codexSettingsImport = 'import { CodexAppServerSettings } from "@/components/settings/codex-app-server-settings"'

function codexAppServerSettings(): Plugin {
  return {
    name: 'jobraker-codex-app-server-settings',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll("\\", "/")
      if (cleanId !== settingsDialogPath) return null

      const importAnchor = 'import { ConnectorApiKeysSettings } from "@/components/settings/connector-api-keys-settings"'
      const startMarker = '// --- Codex Settings UI ---'
      const endMarker = '// --- Tools Library Settings ---'

      let transformed = code
      if (!transformed.includes(codexSettingsImport)) {
        if (!transformed.includes(importAnchor)) {
          throw new Error('Could not locate the Jobraker settings import anchor')
        }
        transformed = transformed.replace(importAnchor, `${importAnchor}\n${codexSettingsImport}`)
      }

      const start = transformed.indexOf(startMarker)
      const end = transformed.indexOf(endMarker)
      if (start < 0 || end < 0 || end <= start) {
        throw new Error('Could not locate the legacy Codex settings section')
      }

      const replacement = `${startMarker}\n\nfunction ModelSettings({ dialogOpen }: { dialogOpen: boolean }) {\n  return <CodexAppServerSettings dialogOpen={dialogOpen} />\n}\n\n`

      return {
        code: `${transformed.slice(0, start)}${replacement}${transformed.slice(end)}`,
        map: null,
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5174,
    strictPort: false,
  },
  plugins: [
    codexAppServerSettings(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: "@x/shared/src", replacement: path.resolve(__dirname, "./src/lib/x-shared") },
      { find: "@x/shared/dist", replacement: path.resolve(__dirname, "./src/lib/x-shared") },
      { find: "@x/shared", replacement: path.resolve(__dirname, "./src/lib/x-shared/index.ts") },
      { find: "zod", replacement: path.resolve(__dirname, "./node_modules/zod/index.js") },
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
