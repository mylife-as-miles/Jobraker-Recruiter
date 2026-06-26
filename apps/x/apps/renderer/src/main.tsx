import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PostHogProvider } from 'posthog-js/react'
import { ThemeProvider } from '@/contexts/theme-context'
import { configureAnalyticsContext } from './lib/analytics'
import { RecruiterDownloadLanding } from '@/components/recruiter-download-landing'

// After a Vite dep-cache rebuild, lazy chunks (e.g. streamdown code blocks) can 404
// until the page reloads. Auto-reload once instead of leaving chat on a blank error boundary.
if (import.meta.env.DEV) {
  window.addEventListener('vite:preloadError', () => {
    window.location.reload()
  })
}

// Fetch the stable installation ID from main so renderer + main share one
// PostHog distinct_id. Falls back to PostHog's auto-generated anonymous ID
// if the IPC call fails (rare — main is always up before renderer).
async function bootstrap() {
  const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY?.trim()
  const isElectronRuntime = typeof window.ipc !== 'undefined'

  const app = (
    <ThemeProvider defaultTheme="dark">
      {isElectronRuntime ? <App /> : <RecruiterDownloadLanding />}
    </ThemeProvider>
  )

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {posthogKey ? (
        <PostHogProvider
          apiKey={posthogKey}
          options={{
            api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
            defaults: '2025-11-30' as const,
          }}
        >
          {app}
        </PostHogProvider>
      ) : (
        app
      )}
    </StrictMode>,
  )

  let apiUrl: string | undefined
  let appVersion: string | undefined
  if (isElectronRuntime) {
    try {
      const result = await window.ipc.invoke('analytics:bootstrap', null)
      apiUrl = result.apiUrl
      appVersion = result.appVersion
    } catch (err) {
      console.error('[Analytics] Failed to bootstrap from main:', err)
    }
  }

  if (posthogKey) {
    configureAnalyticsContext({ apiUrl, appVersion })
  }
}

bootstrap()
