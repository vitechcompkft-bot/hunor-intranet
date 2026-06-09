import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

/**
 * Next.js 16 Proxy (a korábbi middleware). Minden kérésnél frissíti a Supabase
 * sessiont és gondoskodik az útvonalvédelemről.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Minden kérésre fut, kivéve:
     * - _next/static, _next/image (build assetek)
     * - favicon és gyakori statikus képkiterjesztések
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
