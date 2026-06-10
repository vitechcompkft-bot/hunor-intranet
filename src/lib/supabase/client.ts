'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Böngésző oldali Supabase kliens (Client Componentekhez).
 *
 * VPN kompatibilitás: éles környezetben (nem localhost) a Supabase REST/Auth
 * kéréseket az /api/supabase proxyn keresztül küldjük, mert a bolti gépek a
 * VPN miatt nem érik el közvetlenül a supabase.co-t. A kliens URL-je marad a
 * valódi Supabase URL (így a session-süti neve egyezik a szerver oldallal),
 * csak a tényleges hálózati hívást irányítjuk át egy egyedi fetch-csel.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const isLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const options =
    isLocal || typeof window === 'undefined'
      ? undefined
      : {
          global: {
            fetch: ((input: RequestInfo | URL, init?: RequestInit) => {
              let u =
                typeof input === 'string'
                  ? input
                  : input instanceof URL
                    ? input.toString()
                    : (input as Request).url;
              if (u.startsWith(url)) {
                u = window.location.origin + '/api/supabase' + u.slice(url.length);
              }
              return fetch(u, init);
            }) as typeof fetch,
          },
        };

  return createBrowserClient(url, key, options);
}
