import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let browserClient: ReturnType<typeof createSupabaseClient> | undefined

export function createClient() {
  browserClient ??= createSupabaseClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  )
  return browserClient
}
