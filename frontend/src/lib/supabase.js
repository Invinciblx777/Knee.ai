import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// These are baked in at build time. If the build ran without them, createClient
// throws while this module is still being evaluated, which kills the import
// graph before React mounts and leaves an unexplained blank page. Fail with
// something a human can act on instead.
export const configError = !supabaseUrl || !supabaseAnonKey
  ? 'Supabase is not configured: ' +
    [!supabaseUrl && 'VITE_SUPABASE_URL', !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY']
      .filter(Boolean).join(' and ') +
    ' was missing when this build ran. Set it in frontend/.env.production or as a ' +
    'Vercel environment variable, then redeploy.'
  : null

export const supabase = configError ? null : createClient(supabaseUrl, supabaseAnonKey)
