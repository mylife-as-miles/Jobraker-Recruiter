import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './web-ipc'
import './index.css'
import { RecruiterAuthView } from '@/components/recruiter-auth-view'
import { RecruiterDownloadLanding } from '@/components/recruiter-download-landing'
import { PostHogProvider } from 'posthog-js/react'
import { ThemeProvider } from '@/contexts/theme-context'
import { configureAnalyticsContext } from './lib/analytics'

// After a Vite dep-cache rebuild, lazy chunks (e.g. streamdown code blocks) can 404
// until the page reloads. Auto-reload once instead of leaving chat on a blank error boundary.
if (import.meta.env.DEV) {
  window.addEventListener('vite:preloadError', () => {
    window.location.reload()
  })
}

function Root() {
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    const refreshPath = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', refreshPath)
    return () => window.removeEventListener('popstate', refreshPath)
  }, [])

  if (pathname.startsWith('/signup')) {
    return <RecruiterAuthView initialMode="signup" />
  }

  if (pathname.startsWith('/login') || pathname.startsWith('/auth')) {
    return <RecruiterAuthView />
  }

  return <RecruiterDownloadLanding />
}

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY?.trim()
const app = (
  <ThemeProvider defaultTheme="dark">
    <Root />
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

window.ipc.invoke('analytics:bootstrap', null).then((result) => {
  if (posthogKey) {
    configureAnalyticsContext({ apiUrl: result.apiUrl, appVersion: result.appVersion })
  }
}).catch((err) => {
  console.error('[Analytics] Failed to bootstrap web analytics:', err)
})
