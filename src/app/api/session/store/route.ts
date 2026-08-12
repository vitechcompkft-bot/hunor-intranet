import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { SCOPE_COOKIE, isValidScope } from '@/lib/scope';

/**
 * A bejelentkezéskor választott bolt/trafik szám munkamenet-szintű beállítása.
 * A számot httpOnly cookie-ban tároljuk (nem a megosztott fiók app_metadata-jában),
 * így párhuzamos belépéseknél nem íródik felül más bolt száma. Lásd: src/lib/scope.ts
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let number: unknown;
  try {
    ({ number } = (await req.json()) as { number?: unknown });
  } catch {
    number = undefined;
  }
  if (typeof number !== 'string' || !isValidScope(number.trim())) {
    return new Response('Érvénytelen bolt/trafik szám', { status: 400 });
  }

  const store = await cookies();
  store.set(SCOPE_COOKIE, number.trim(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // belső LAN-on http is előfordulhat — így ott is beállítódik
    path: '/',
  });
  return new Response(null, { status: 204 });
}

/** Kijelentkezéskor a munkamenet-szintű boltszám törlése. */
export async function DELETE() {
  const store = await cookies();
  store.delete(SCOPE_COOKIE);
  return new Response(null, { status: 204 });
}
