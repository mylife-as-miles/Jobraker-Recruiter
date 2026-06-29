import { createClient } from '@supabase/supabase-js'

export const createRequestClient = (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY.')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
}

export const requireWorkspace = async (req: Request) => {
  const supabase = createRequestClient(req)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Authentication required')
  }

  const existing = await supabase
    .from('recruiter_workspaces')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing.error) throw existing.error
  if (existing.data?.id) return { supabase, user, workspaceId: existing.data.id as string }

  const created = await supabase
    .from('recruiter_workspaces')
    .insert({ user_id: user.id, name: 'Jobraker Recruiter Workspace' })
    .select('id')
    .single()

  if (created.error) throw created.error
  return { supabase, user, workspaceId: created.data.id as string }
}
