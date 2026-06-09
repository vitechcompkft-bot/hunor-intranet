import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Szerver oldali Supabase kliens (Server Componentek, Route Handlerek, Server Actionök).
 * Next.js 16: a cookies() aszinkron, ezért await szükséges.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // A setAll Server Componentből hívva eldobható — a proxy frissíti a sessiont.
          }
        },
      },
    }
  );
}

/**
 * Admin (service role) kliens — csak szerver oldalon, kizárólag privilegizált
 * műveletekhez (felhasználókezelés, RPC bypass). SOHA ne kerüljön a böngészőbe.
 */
export function createAdminClient() {
  const { createClient: createSb } = require('@supabase/supabase-js');
  return createSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
