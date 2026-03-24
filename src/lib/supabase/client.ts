import { createBrowserClient } from '@supabase/ssr'

// This client runs in the BROWSER (client components)
// It uses the public anon key — safe to expose because Supabase
// Row Level Security policies control what users can actually access
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
