import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './web-ipc'
import './index.css'
import {
  RecruiterAuthView,
  RecruiterForgotPasswordView,
  RecruiterResetPasswordView,
} from '@/components/recruiter-auth-view'
import App from './App'
import { RecruiterDownloadLanding } from '@/components/recruiter-download-landing'
import { RecruiterOnboardingView } from '@/components/recruiter-onboarding-view'
import { PostHogProvider } from 'posthog-js/react'
import { ThemeProvider } from '@/contexts/theme-context'
import { configureAnalyticsContext } from './lib/analytics'
import { useAuth } from '@/hooks/use-auth'

// After a Vite dep-cache rebuild, lazy chunks (e.g. streamdown code blocks) can 404
// until the page reloads. Auto-reload once instead of leaving chat on a blank error boundary.
if (import.meta.env.DEV) {
  window.addEventListener('vite:preloadError', () => {
    window.location.reload()
  })
}

function redirectTo(path: string) {
  window.history.replaceState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function Root() {
  const [pathname, setPathname] = useState(window.location.pathname)
  const { loading, isAuthenticated } = useAuth()

  useEffect(() => {
    const refreshPath = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', refreshPath)
    return () => window.removeEventListener('popstate', refreshPath)
  }, [])

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth')
  const isProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding')

  useEffect(() => {
    if (loading) return
    if (isAuthRoute && isAuthenticated) {
      redirectTo('/dashboard')
      return
    }
    if (isProtectedRoute && !isAuthenticated) {
      redirectTo('/login')
    }
  }, [isAuthRoute, isAuthenticated, isProtectedRoute, loading])

  if (loading && (isAuthRoute || isProtectedRoute)) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 text-sm text-zinc-300 shadow-2xl shadow-lime-500/10">
          Checking your session...
        </div>
      </div>
    )
  }

  if (isAuthRoute && isAuthenticated) {
    return null
  }

  if (isProtectedRoute && !isAuthenticated) {
    return null
  }

  if (pathname.startsWith('/signup')) {
    return <RecruiterAuthView initialMode="signup" />
  }

  if (pathname.startsWith('/forgot-password')) {
    return <RecruiterForgotPasswordView />
  }

  if (pathname.startsWith('/reset-password')) {
    return <RecruiterResetPasswordView />
  }

  if (pathname.startsWith('/onboarding')) {
    return <RecruiterOnboardingView />
  }

  if (pathname.startsWith('/dashboard')) {
    return <App />
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
