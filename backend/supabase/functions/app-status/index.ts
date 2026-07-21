import { handleOptions, json, readPayload } from '../_shared/http.ts'
import { requireWorkspace } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const early = handleOptions(req)
  if (early) return early

  try {
    const { channel = '' } = await readPayload(req)

    if (channel === 'analytics:bootstrap') {
      return json({ installationId: 'web-edge', apiUrl: Deno.env.get('SUPABASE_URL') ?? '', appVersion: 'web' })
    }

    await requireWorkspace(req)

    switch (channel) {
      case 'models:list':
        return json({ providers: [], defaults: {}, models: [] })
      case 'oauth:getState':
      case 'oauth:list-providers':
        return json({ providers: [], config: { providers: [] } })
      case 'onboarding:getStatus':
        return json({ completed: true, showOnboarding: false })
      case 'onboarding:markComplete':
      case 'migration:check-composio-google':
      case 'mcp:resetServers':
        return json({ ok: true, success: true, needed: false })
      case 'browser:getState':
        return json({ tabs: [], activeTabId: null })
      case 'voice:getConfig':
        return json({ enabled: false })
      case 'codeMode:getConfig':
        return json({ enabled: false, webFallback: true })
      case 'codeMode:setConfig':
        return json({ success: true, enabled: false, webFallback: true })
      case 'codeMode:checkAgentStatus':
        return json({
          claude: { installed: false, signedIn: false },
          codex: { installed: false, signedIn: false },
          webFallback: true,
          reason: 'Hosted web apps cannot inspect or execute a local Codex App Server without the trusted local gateway.',
        })
      case 'meeting:checkScreenPermission':
        return json({ granted: false })
      case 'knowledge:history':
        return json({ commits: [] })
      case 'app:consumePendingDeepLink':
        return json({ url: null })
      case 'gmail:getImportant':
      case 'gmail:getEverythingElse':
        return json({ threads: [], nextCursor: null })
      case 'account:getJobrakerRecruiter':
        return json({ signedIn: true, accessToken: null, config: null })
      default:
        return json({ ok: true, success: true, webFallback: true, channel })
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, error instanceof Error && error.message === 'Authentication required' ? 401 : 500)
  }
})
