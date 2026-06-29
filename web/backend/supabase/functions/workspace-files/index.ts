import { handleOptions, json, readPayload } from '../_shared/http.ts'
import { requireWorkspace } from '../_shared/supabase.ts'
import { normalizePath, stat } from '../_shared/workspace.ts'

Deno.serve(async (req) => {
  const early = handleOptions(req)
  if (early) return early

  try {
    const { channel = '', args = {} } = await readPayload(req)
    const { supabase, workspaceId } = await requireWorkspace(req)

    const readFileRow = async (path: string) => {
      const result = await supabase
        .from('recruiter_workspace_files')
        .select('path, kind, data, encoding, byte_size, created_at, updated_at')
        .eq('workspace_id', workspaceId)
        .eq('path', normalizePath(path))
        .maybeSingle()
      if (result.error) throw result.error
      return result.data
    }

    switch (channel) {
      case 'workspace:getRoot':
        return json({ root: 'supabase-edge-workspace' })
      case 'workspace:exists': {
        const path = normalizePath(String(args.path ?? ''))
        if (!path) return json({ exists: true })
        const row = await readFileRow(path)
        if (row) return json({ exists: true })
        const children = await supabase.from('recruiter_workspace_files').select('id').eq('workspace_id', workspaceId).like('path', `${path}/%`).limit(1)
        if (children.error) throw children.error
        return json({ exists: (children.data?.length ?? 0) > 0 })
      }
      case 'workspace:stat': {
        const row = await readFileRow(String(args.path ?? ''))
        return json(row ? stat(row) : stat({ kind: 'dir', data: '' }))
      }
      case 'workspace:readFile': {
        const path = normalizePath(String(args.path ?? ''))
        const row = await readFileRow(path)
        const data = row?.data ?? ''
        return json({ path, encoding: args.encoding ?? row?.encoding ?? 'utf8', data, stat: stat(row ?? { data }), etag: `${data.length}:${row?.updated_at ?? ''}` })
      }
      case 'workspace:writeFile': {
        const path = normalizePath(String(args.path ?? ''))
        const data = String(args.data ?? '')
        const byteSize = new TextEncoder().encode(data).length
        const result = await supabase
          .from('recruiter_workspace_files')
          .upsert({ workspace_id: workspaceId, path, kind: 'file', data, encoding: 'utf8', byte_size: byteSize }, { onConflict: 'workspace_id,path' })
          .select('path, kind, data, byte_size, created_at, updated_at')
          .single()
        if (result.error) throw result.error
        return json({ path, stat: stat(result.data), etag: `${byteSize}:${result.data.updated_at}` })
      }
      case 'workspace:mkdir': {
        const path = normalizePath(String(args.path ?? ''))
        if (!path) return json({ ok: true, success: true })
        const result = await supabase.from('recruiter_workspace_files').upsert({ workspace_id: workspaceId, path, kind: 'dir', data: null, byte_size: 0 }, { onConflict: 'workspace_id,path' })
        if (result.error) throw result.error
        return json({ ok: true, success: true })
      }
      case 'workspace:readdir': {
        const path = normalizePath(String(args.path ?? ''))
        const recursive = Boolean((args.opts as Record<string, unknown> | undefined)?.recursive)
        const prefix = path ? `${path}/` : ''
        const result = await supabase.from('recruiter_workspace_files').select('path, kind, data, byte_size, created_at, updated_at').eq('workspace_id', workspaceId).like('path', `${prefix}%`).order('path')
        if (result.error) throw result.error
        const entries = new Map<string, Record<string, unknown>>()
        for (const row of result.data ?? []) {
          if (row.path === path) continue
          const rest = row.path.slice(prefix.length)
          if (!rest) continue
          if (recursive || !rest.includes('/')) {
            entries.set(row.path, { name: row.path.split('/').pop() ?? row.path, path: row.path, kind: row.kind, stat: stat(row) })
          } else {
            const name = rest.split('/')[0]
            const dirPath = prefix ? `${prefix}${name}` : name
            entries.set(dirPath, { name, path: dirPath, kind: 'dir', stat: stat({ kind: 'dir', data: '' }) })
          }
        }
        return json(Array.from(entries.values()).sort((a, b) => String(a.name).localeCompare(String(b.name))))
      }
      case 'workspace:rename':
      case 'workspace:copy': {
        const from = normalizePath(String(args.from ?? ''))
        const to = normalizePath(String(args.to ?? ''))
        if (!from || !to) return json({ success: false, error: 'Missing source or destination path' }, 400)
        const files = await supabase
          .from('recruiter_workspace_files')
          .select('path, kind, data, encoding, mime_type, byte_size, metadata')
          .eq('workspace_id', workspaceId)
          .or(`path.eq.${from},path.like.${from}/%`)
        if (files.error) throw files.error
        for (const file of files.data ?? []) {
          const nextPath = file.path === from ? to : `${to}${file.path.slice(from.length)}`
          const write = await supabase.from('recruiter_workspace_files').upsert({
            workspace_id: workspaceId,
            path: nextPath,
            kind: file.kind,
            data: file.data,
            encoding: file.encoding,
            mime_type: file.mime_type,
            byte_size: file.byte_size,
            metadata: file.metadata,
          }, { onConflict: 'workspace_id,path' })
          if (write.error) throw write.error
        }
        if (channel === 'workspace:rename') {
          const remove = await supabase
            .from('recruiter_workspace_files')
            .delete()
            .eq('workspace_id', workspaceId)
            .or(`path.eq.${from},path.like.${from}/%`)
          if (remove.error) throw remove.error
        }
        return json({ ok: true, success: true })
      }
      case 'workspace:remove': {
        const path = normalizePath(String(args.path ?? ''))
        const result = await supabase.from('recruiter_workspace_files').delete().eq('workspace_id', workspaceId).or(`path.eq.${path},path.like.${path}/%`)
        if (result.error) throw result.error
        return json({ ok: true, success: true })
      }
      default:
        return json({ error: `Unsupported workspace channel: ${channel}` }, 400)
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, error instanceof Error && error.message === 'Authentication required' ? 401 : 500)
  }
})
