import { createClient } from '@supabase/supabase-js'

export const createRequestClient = (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey =
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
    Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or a Supabase publishable key.')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const secretKey =
    Deno.env.get('SUPABASE_SECRET_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !secretKey) {
    throw new Error('Missing SUPABASE_URL or a Supabase server secret key.')
  }

  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
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
