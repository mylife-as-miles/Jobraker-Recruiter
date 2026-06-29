import { handleOptions, json, readPayload } from '../_shared/http.ts'
import { requireWorkspace } from '../_shared/supabase.ts'

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || `task-${Date.now()}`

Deno.serve(async (req) => {
  const early = handleOptions(req)
  if (early) return early

  try {
    const { channel = '', args = {} } = await readPayload(req)
    const { supabase, workspaceId } = await requireWorkspace(req)

    switch (channel) {
      case 'bg-task:create': {
        const name = String(args.name ?? 'Background task')
        const slug = slugify(String(args.slug ?? name))
        const result = await supabase.from('recruiter_agents').upsert({ workspace_id: workspaceId, slug, name, description: String(args.instructions ?? ''), status: 'inactive', trigger_config: args.triggers ?? {}, metadata: args }, { onConflict: 'workspace_id,slug' }).select('slug').single()
        if (result.error) throw result.error
        return json({ success: true, slug: result.data.slug })
      }
      case 'bg-task:list': {
        const result = await supabase.from('recruiter_agents').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
        if (result.error) throw result.error
        return json({ items: result.data ?? [], tasks: result.data ?? [], nextCursor: null })
      }
      case 'bg-task:get': {
        const result = await supabase.from('recruiter_agents').select('*').eq('workspace_id', workspaceId).eq('slug', String(args.slug ?? '')).maybeSingle()
        if (result.error) throw result.error
        return json({ success: true, task: result.data })
      }
      case 'bg-task:patch': {
        const partial = (args.partial ?? {}) as Record<string, unknown>
        const result = await supabase.from('recruiter_agents').update({ metadata: partial, enabled: partial.active ?? undefined }).eq('workspace_id', workspaceId).eq('slug', String(args.slug ?? '')).select('*').maybeSingle()
        if (result.error) throw result.error
        return json({ success: true, task: result.data })
      }
      case 'bg-task:delete': {
        const result = await supabase.from('recruiter_agents').delete().eq('workspace_id', workspaceId).eq('slug', String(args.slug ?? ''))
        if (result.error) throw result.error
        return json({ success: true })
      }
      case 'bg-task:run': {
        const agent = await supabase.from('recruiter_agents').select('id').eq('workspace_id', workspaceId).eq('slug', String(args.slug ?? '')).maybeSingle()
        if (agent.error) throw agent.error
        if (!agent.data?.id) return json({ success: false, error: 'Task not found' })
        const run = await supabase.from('recruiter_agent_runs').insert({ agent_id: agent.data.id, status: 'queued', input: args.context ?? {} }).select('id').single()
        if (run.error) throw run.error
        return json({ success: true, runId: run.data.id, summary: 'Queued in Supabase Edge Functions.' })
      }
      case 'bg-task:listRunIds':
        return json({ runIds: [] })
      case 'bg-task:stop':
        return json({ success: true })
      default:
        return json({ error: `Unsupported background-task channel: ${channel}` }, 400)
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, error instanceof Error && error.message === 'Authentication required' ? 401 : 500)
  }
})
