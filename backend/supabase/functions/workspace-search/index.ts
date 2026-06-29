import { handleOptions, json, readPayload } from '../_shared/http.ts'
import { requireWorkspace } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const early = handleOptions(req)
  if (early) return early

  try {
    const { channel = '', args = {} } = await readPayload(req)
    const { supabase, workspaceId } = await requireWorkspace(req)

    if (channel !== 'search:query') {
      return json({ error: `Unsupported search channel: ${channel}` }, 400)
    }

    const query = String(args.query ?? '').trim()
    if (!query) return json({ results: [] })

    const result = await supabase
      .from('recruiter_workspace_files')
      .select('path, kind, data, updated_at')
      .eq('workspace_id', workspaceId)
      .ilike('data', `%${query}%`)
      .limit(Number(args.limit ?? 20))

    if (result.error) throw result.error

    return json({
      results: (result.data ?? []).map((row) => ({
        type: 'knowledge',
        title: row.path.split('/').pop() ?? row.path,
        path: row.path,
        snippet: String(row.data ?? '').slice(0, 240),
        updatedAt: row.updated_at,
      })),
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, error instanceof Error && error.message === 'Authentication required' ? 401 : 500)
  }
})
