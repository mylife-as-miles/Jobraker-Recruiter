import { useEffect } from 'react'
import posthog from 'posthog-js'
import { identifyUser, isAnalyticsEnabled, resetAnalyticsIdentity } from '@/lib/analytics'

/**
 * Identifies the user in PostHog when signed into JobrakerRecruiter,
 * and sets user properties for connected OAuth providers.
 * Call once at the App level.
 */
export function useAnalyticsIdentity() {
  // On mount: check current OAuth state and identify if signed in
  useEffect(() => {
    if (!isAnalyticsEnabled()) return

    async function init() {
      try {
        const result = await window.ipc.invoke('oauth:getState', null)
        const config = result.config || {}

        // Identify if Jobraker Recruiter account is connected
        const jobrakerRecruiter = config['jobraker-recruiter']
        if (jobrakerRecruiter?.connected && jobrakerRecruiter?.userId) {
          identifyUser(jobrakerRecruiter.userId)
        }

        // Set provider connection flags
        const providers = ['gmail', 'calendar', 'slack', 'jobraker-recruiter']
        const props: Record<string, boolean> = { signed_in: !!jobrakerRecruiter?.connected }
        for (const p of providers) {
          props[`${p}_connected`] = !!config[p]?.connected
        }
        posthog.people.set(props)

        // Count notes for total_notes property
        try {
          const entries = await window.ipc.invoke('workspace:readdir', { path: '' })
          let totalNotes = 0
          if (entries) {
            for (const entry of entries) {
              if (entry.kind === 'dir') {
                try {
                  const sub = await window.ipc.invoke('workspace:readdir', { path: `${entry.name}` })
                  totalNotes += sub?.length ?? 0
                } catch {
                  // skip inaccessible dirs
                }
              }
            }
          }
          posthog.people.set({ total_notes: totalNotes })
        } catch {
          // workspace may not be available
        }
      } catch {
        // oauth state unavailable
      }
    }
    init()
  }, [])

  // Listen for OAuth connect/disconnect events to update identity
  useEffect(() => {
    if (!isAnalyticsEnabled()) return

    const cleanup = window.ipc.on('oauth:didConnect', (event) => {
      if (event.provider !== 'jobraker-recruiter') {
        // Other providers: just toggle the connection flag
        if (event.success) {
          posthog.people.set({ [`${event.provider}_connected`]: true })
        }
        return
      }

      // Jobraker Recruiter sign-in
      if (event.success) {
        if (event.userId) {
          identifyUser(event.userId)
        }
        posthog.people.set({ signed_in: true, jobraker_recruiter_connected: true })
        posthog.capture('user_signed_in')
        return
      }

      // Jobraker Recruiter sign-out — flip flags, capture, and reset distinct_id so
      // future events on this device don't get attributed to the prior user.
      posthog.people.set({ signed_in: false, jobraker_recruiter_connected: false })
      posthog.capture('user_signed_out')
      resetAnalyticsIdentity()
    })

    return cleanup
  }, [])
}
