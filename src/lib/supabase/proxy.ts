import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Az auth nélkül is elérhető útvonalak (login + auth API). */
const PUBLIC_PATHS = ['/login', '/api/auth'];

/**
 * Session frissítés + útvonalvédelem a Next.js 16 Proxy-ban (régen middleware).
 * Bejelentkezés nélkül minden védett oldal a /login-re irányít.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // FONTOS: getUser() validálja a tokent a Supabase szerverrel — ne getSession()-t használj.
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    // Supabase nem elérhető (pl. még placeholder a konfiguráció) — ne dobjunk 500-at.
    // A nyilvános útvonalak (login) így is betöltődnek, a védettek a loginra visznek.
    user = null;
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  // Az API route-ok maguk kezelik a jogosultságot (401 JSON), ne irányítsuk át őket a /login-ra.
  const isApi = pathname.startsWith('/api');

  if (!user && !isPublic && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Bejelentkezve a /login-re tévedt felhasználót a főoldalra visszük.
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
