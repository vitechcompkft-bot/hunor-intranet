'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Böngésző oldali Supabase kliens (Client Componentekhez).
 * A session sütiken keresztül szinkronban marad a szerverrel (@supabase/ssr).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
