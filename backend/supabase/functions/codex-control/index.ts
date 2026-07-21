import { handleOptions, json } from '../_shared/http.ts'
import { createAdminClient, requireWorkspace } from '../_shared/supabase.ts'

type CodexAction = 'status' | 'connect' | 'logout' | 'start_run' | 'cancel_run'

type Payload = {
  action?: CodexAction
  prompt?: string
  model?: string
  threadId?: string
  runId?: string
}

const workerConfig = () => {
  const url = Deno.env.get('CODEX_WORKER_URL')?.replace(/\/+$/, '')
  const secret = Deno.env.get('CODEX_WORKER_SECRET')
  return { url, secret, configured: Boolean(url && secret) }
}

const workerSetupPayload = () => {
  const config = workerConfig()
  const missingSecrets = [
    config.url ? null : 'CODEX_WORKER_URL',
    config.secret ? null : 'CODEX_WORKER_SECRET',
  ].filter(Boolean) as string[]

  return {
    configured: false,
    available: false,
    error: 'Codex worker setup required. Deploy services/codex-worker, then set CODEX_WORKER_URL and CODEX_WORKER_SECRET in Supabase Edge Function secrets.',
    missingSecrets,
    setup: {
      worker: 'Deploy services/codex-worker to a persistent Node/Docker host with HTTPS and a persistent JOBRAKER_CODEX_DATA_DIR volume.',
      supabaseSecrets: ['CODEX_WORKER_URL', 'CODEX_WORKER_SECRET'],
      workerEnv: ['JOBRAKER_CODEX_WORKER_SECRET', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY'],
    },
  }
}

const callWorker = async (
  body: Record<string, unknown>,
  timeoutMs = 15_000,
) => {
  const config = workerConfig()
  if (!config.url || !config.secret) {
    throw new Error('Hosted Codex worker is not configured.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${config.url}/v1/codex`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jobraker-worker-secret': config.secret,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const result = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) {
      throw new Error(String(result.error ?? `Codex worker returned ${response.status}`))
    }
    return result
  } finally {
    clearTimeout(timeout)
  }
}

Deno.serve(async (req) => {
  const early = handleOptions(req)
  if (early) return early

  try {
    const payload = await req.json().catch(() => ({})) as Payload
    const action = payload.action
    if (!action) return json({ error: 'Missing action.' }, 400)

    const { user, workspaceId } = await requireWorkspace(req)
    const admin = createAdminClient()
    const config = workerConfig()

    if (action === 'status') {
      const connectionResult = await admin
        .from('codex_connections')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      if (connectionResult.error) throw connectionResult.error

      if (!config.configured) {
        return json({
          ...workerSetupPayload(),
          connected: connectionResult.data?.status === 'connected',
          connection: connectionResult.data ?? null,
        })
      }

      try {
        const worker = await callWorker({
          action: 'status',
          userId: user.id,
          workspaceId,
        })

        const connection = {
          workspace_id: workspaceId,
          user_id: user.id,
          status: worker.connected ? 'connected' : 'disconnected',
          account_email: worker.accountEmail ?? null,
          plan_type: worker.planType ?? null,
          auth_mode: worker.authMode ?? null,
          runtime_id: worker.runtimeId ?? null,
          last_error: null,
          connected_at: worker.connected ? new Date().toISOString() : null,
        }

        const saved = await admin
          .from('codex_connections')
          .upsert(connection, { onConflict: 'workspace_id' })
          .select('*')
          .single()

        if (saved.error) throw saved.error

        return json({
          configured: true,
          available: true,
          connected: Boolean(worker.connected),
          connection: saved.data,
          login: worker.login ?? null,
        })
      } catch (error) {
        return json({
          configured: true,
          available: false,
          connected: connectionResult.data?.status === 'connected',
          connection: connectionResult.data ?? null,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (!config.configured) {
      return json(workerSetupPayload(), 503)
    }

    if (action === 'connect') {
      const worker = await callWorker({
        action: 'connect',
        userId: user.id,
        workspaceId,
      })

      const saved = await admin
        .from('codex_connections')
        .upsert({
          workspace_id: workspaceId,
          user_id: user.id,
          status: 'connecting',
          login_id: worker.loginId ?? null,
          last_error: null,
        }, { onConflict: 'workspace_id' })
        .select('*')
        .single()

      if (saved.error) throw saved.error
      return json({ ...worker, connection: saved.data })
    }

    if (action === 'logout') {
      await callWorker({ action: 'logout', userId: user.id, workspaceId })
      const updated = await admin
        .from('codex_connections')
        .upsert({
          workspace_id: workspaceId,
          user_id: user.id,
          status: 'disconnected',
          account_email: null,
          plan_type: null,
          auth_mode: null,
          login_id: null,
          last_error: null,
          connected_at: null,
        }, { onConflict: 'workspace_id' })
        .select('*')
        .single()

      if (updated.error) throw updated.error
      return json({ ok: true, connection: updated.data })
    }

    if (action === 'start_run') {
      const prompt = payload.prompt?.trim()
      if (!prompt) return json({ error: 'A Codex task is required.' }, 400)
      if (prompt.length > 20_000) return json({ error: 'Codex task is too long.' }, 400)

      const model = payload.model && /^[A-Za-z0-9._-]{1,80}$/.test(payload.model)
        ? payload.model
        : 'gpt-5.6'

      const created = await admin
        .from('codex_runs')
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          thread_id: payload.threadId ?? null,
          model,
          prompt,
          status: 'queued',
        })
        .select('*')
        .single()

      if (created.error) throw created.error

      try {
        await callWorker({
          action: 'start_run',
          userId: user.id,
          workspaceId,
          runId: created.data.id,
          threadId: payload.threadId ?? null,
          model,
          prompt,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await admin
          .from('codex_runs')
          .update({ status: 'failed', error: message, completed_at: new Date().toISOString() })
          .eq('id', created.data.id)
        return json({ error: message, run: { ...created.data, status: 'failed', error: message } }, 502)
      }

      return json({ run: created.data })
    }

    if (action === 'cancel_run') {
      if (!payload.runId) return json({ error: 'Missing runId.' }, 400)

      const run = await admin
        .from('codex_runs')
        .select('id,status')
        .eq('id', payload.runId)
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (run.error) throw run.error
      if (!run.data) return json({ error: 'Codex run not found.' }, 404)

      await admin
        .from('codex_runs')
        .update({ status: 'cancelling' })
        .eq('id', payload.runId)

      await callWorker({
        action: 'cancel_run',
        userId: user.id,
        workspaceId,
        runId: payload.runId,
      })

      return json({ ok: true })
    }

    return json({ error: 'Unsupported Codex action.' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json(
      { error: message },
      message === 'Authentication required' ? 401 : 500,
    )
  }
})
