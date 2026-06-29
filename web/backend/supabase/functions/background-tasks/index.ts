import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import { handleOptions, json, readPayload } from '../_shared/http.ts'
import { requireWorkspace } from '../_shared/supabase.ts'

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || `task-${Date.now()}`

type DynamoConfigRow = {
  region: string
  table_name: string
  access_key_id: string
  secret_access_key: string
  enabled: boolean
}

async function writeWorkflowState(
  supabase: Awaited<ReturnType<typeof requireWorkspace>>['supabase'],
  workspaceId: string,
  slug: string,
  action: string,
  status: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    const { data, error } = await supabase
      .from('recruiter_aws_dynamodb_connections')
      .select('region, table_name, access_key_id, secret_access_key, enabled')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (error || !data?.enabled) return

    const config = data as DynamoConfigRow
    const now = new Date().toISOString()
    const client = new DynamoDBClient({
      region: config.region,
      credentials: {
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      },
    })

    await client.send(new PutItemCommand({
      TableName: config.table_name,
      Item: marshall({
        pk: `WORKSPACE#${workspaceId}`,
        sk: `WORKFLOW_STATE#background-task#${slug}`,
        gsi1pk: `WORKFLOW_STATE#${workspaceId}`,
        gsi1sk: now,
        recordType: 'WORKFLOW_STATE',
        workspaceId,
        action,
        entityType: 'background-task',
        entityId: slug,
        title: `Background task ${slug}`,
        status,
        metadata,
        updatedAt: now,
      }, { removeUndefinedValues: true }),
    }))
  } catch {
    // DynamoDB is optional; background task CRUD should not fail because the operational mirror is unavailable.
  }
}

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
        await writeWorkflowState(supabase, workspaceId, result.data.slug, 'bg-task.created', 'inactive', { name, triggers: args.triggers ?? {} })
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
        await writeWorkflowState(supabase, workspaceId, String(args.slug ?? ''), 'bg-task.patched', partial.active === false ? 'inactive' : 'active', { partial })
        return json({ success: true, task: result.data })
      }
      case 'bg-task:delete': {
        const slug = String(args.slug ?? '')
        const result = await supabase.from('recruiter_agents').delete().eq('workspace_id', workspaceId).eq('slug', String(args.slug ?? ''))
        if (result.error) throw result.error
        await writeWorkflowState(supabase, workspaceId, slug, 'bg-task.deleted', 'deleted')
        return json({ success: true })
      }
      case 'bg-task:run': {
        const agent = await supabase.from('recruiter_agents').select('id').eq('workspace_id', workspaceId).eq('slug', String(args.slug ?? '')).maybeSingle()
        if (agent.error) throw agent.error
        if (!agent.data?.id) return json({ success: false, error: 'Task not found' })
        const run = await supabase.from('recruiter_agent_runs').insert({ agent_id: agent.data.id, status: 'queued', input: args.context ?? {} }).select('id').single()
        if (run.error) throw run.error
        await writeWorkflowState(supabase, workspaceId, String(args.slug ?? ''), 'bg-task.run_queued', 'queued', { runId: run.data.id, context: args.context ?? {} })
        return json({ success: true, runId: run.data.id, summary: 'Queued in Supabase Edge Functions.' })
      }
      case 'bg-task:listRunIds':
        return json({ runIds: [] })
      case 'bg-task:stop': {
        await writeWorkflowState(supabase, workspaceId, String(args.slug ?? ''), 'bg-task.stopped', 'stopped')
        return json({ success: true })
      }
      default:
        return json({ error: `Unsupported background-task channel: ${channel}` }, 400)
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, error instanceof Error && error.message === 'Authentication required' ? 401 : 500)
  }
})
