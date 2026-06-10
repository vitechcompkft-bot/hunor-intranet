import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Supabase proxy — VPN kompatibilitás.
 * A bolti gépek a VPN miatt nem érik el közvetlenül a supabase.co-t, az
 * intranet.hunorcoop.hu-t (Vercel) viszont igen. A böngésző supabase-js
 * kliense ezért minden REST/Auth kérést ide küld, a szerver pedig
 * továbbítja a valódi Supabase felé (a Vercel eléri).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Csak ezeket a fejléceket továbbítjuk a Supabase felé
const FORWARD_HEADERS = [
  'authorization',
  'apikey',
  'content-type',
  'prefer',
  'accept',
  'accept-profile',
  'content-profile',
  'x-client-info',
  'x-supabase-api-version',
  'range',
];

async function handler(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  if (!SUPABASE_URL) {
    return NextResponse.json({ error: 'Supabase URL nincs beállítva' }, { status: 500 });
  }

  const { path } = await ctx.params;
  const search = new URL(request.url).search;
  const target = `${SUPABASE_URL}/${path.join('/')}${search}`;

  const headers = new Headers();
  for (const h of FORWARD_HEADERS) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has('apikey')) headers.set('apikey', ANON_KEY);

  const init: RequestInit = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  let resp: Response;
  try {
    resp = await fetch(target, init);
  } catch {
    return NextResponse.json({ error: 'Supabase nem elérhető a szerverről' }, { status: 502 });
  }

  // Válasz fejlécek átvétele (a tömörítési/hosszúsági fejléceket kihagyva)
  const respHeaders = new Headers();
  resp.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (
      k !== 'content-encoding' &&
      k !== 'transfer-encoding' &&
      k !== 'connection' &&
      k !== 'content-length'
    ) {
      respHeaders.set(key, value);
    }
  });

  const buf = await resp.arrayBuffer();
  return new Response(buf, { status: resp.status, headers: respHeaders });
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
  handler as HEAD,
};
