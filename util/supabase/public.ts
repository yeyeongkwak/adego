// Anonymous, cookie-free Supabase client for public-read API routes (GTFS
// lookups) — no user session involved, so util/supabase/server.ts's
// cookie-aware client would just be dead weight here.

import { createClient } from '@supabase/supabase-js'

export function createPublicClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) return null
    return createClient(url, key, { auth: { persistSession: false } })
}