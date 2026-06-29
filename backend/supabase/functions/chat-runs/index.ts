import { handleOptions, json, readPayload } from '../_shared/http.ts'
import { requireWorkspace } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const early = handleOptions(req)
  if (early) return early

  try {
    const { channel = '', args = {} } = await readPayload(req)
    const { supabase, workspaceId } = await requireWorkspace(req)

    switch (channel) {
      case 'runs:create': {
        const title = String(args.title ?? args.prompt ?? 'Web chat')
        const created = await supabase
          .from('recruiter_chats')
          .insert({ workspace_id: workspaceId, title, agent_slug: String(args.agentId ?? 'copilot'), last_message_at: new Date().toISOString() })
          .select('id, title, agent_slug, created_at')
          .single()
        if (created.error) throw created.error
        return json({ id: created.data.id, title: created.data.title, createdAt: created.data.created_at, agentId: created.data.agent_slug ?? 'copilot', model: 'web-edge', provider: 'supabase-edge', log: [], messages: [] })
      }
      case 'runs:createMessage': {
        const message = (args.message ?? {}) as Record<string, unknown>
        const role = String(message.role ?? 'user')
        const created = await supabase
          .from('recruiter_chat_messages')
          .insert({
            chat_id: String(args.runId ?? ''),
            role: ['user', 'assistant', 'system', 'tool'].includes(role) ? role : 'user',
            content: String(message.content ?? args.content ?? ''),
            metadata: message,
          })
          .select('id')
          .single()
        if (created.error) throw created.error
        await supabase.from('recruiter_chats').update({ last_message_at: new Date().toISOString() }).eq('id', String(args.runId ?? ''))
        return json({ messageId: created.data.id, success: true })
      }
      case 'runs:fetch': {
        const runId = String(args.runId ?? '')
        const chat = await supabase.from('recruiter_chats').select('*').eq('id', runId).maybeSingle()
        if (chat.error) throw chat.error
        const messages = await supabase.from('recruiter_chat_messages').select('*').eq('chat_id', runId).order('created_at')
        if (messages.error) throw messages.error
        return json({ id: chat.data?.id ?? runId, title: chat.data?.title ?? 'Web chat', createdAt: chat.data?.created_at ?? new Date().toISOString(), agentId: chat.data?.agent_slug ?? 'copilot', model: 'web-edge', provider: 'supabase-edge', log: messages.data ?? [], messages: messages.data ?? [] })
      }
      case 'runs:list': {
        const chats = await supabase.from('recruiter_chats').select('id, title, agent_slug, created_at, last_message_at').eq('workspace_id', workspaceId).order('last_message_at', { ascending: false, nullsFirst: false }).limit(Number(args.limit ?? 50))
        if (chats.error) throw chats.error
        return json({ runs: (chats.data ?? []).map((chat) => ({ id: chat.id, title: chat.title, agentId: chat.agent_slug ?? 'copilot', createdAt: chat.created_at, updatedAt: chat.last_message_at })), nextCursor: null })
      }
      case 'runs:delete': {
        const result = await supabase.from('recruiter_chats').delete().eq('id', String(args.runId ?? ''))
        if (result.error) throw result.error
        return json({ success: true })
      }
      case 'runs:stop':
      case 'runs:authorizePermission':
      case 'runs:provideHumanInput':
        return json({ ok: true, success: true })
      default:
        return json({ error: `Unsupported chat channel: ${channel}` }, 400)
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, error instanceof Error && error.message === 'Authentication required' ? 401 : 500)
  }
})
