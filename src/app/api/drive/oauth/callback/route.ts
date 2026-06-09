import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangeCodeAndStore } from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');
  const settingsUrl = `${url.origin}/beallitasok`;

  // Csak admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata as { role?: string } | undefined)?.role;
  if (role !== 'admin') {
    return NextResponse.redirect(`${settingsUrl}?drive=forbidden`);
  }

  if (oauthError || !code) {
    return NextResponse.redirect(`${settingsUrl}?drive=error`);
  }

  try {
    const redirectUri = `${url.origin}/api/drive/oauth/callback`;
    await exchangeCodeAndStore(code, redirectUri);
    return NextResponse.redirect(`${settingsUrl}?drive=connected`);
  } catch {
    return NextResponse.redirect(`${settingsUrl}?drive=error`);
  }
}
