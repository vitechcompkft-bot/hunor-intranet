import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isDriveConfigured, buildAuthUrl } from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  // Csak admin indíthatja a csatlakoztatást
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata as { role?: string } | undefined)?.role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Csak admin csatlakoztathatja a Drive-ot' }, { status: 403 });
  }
  if (!isDriveConfigured()) {
    return NextResponse.json(
      { error: 'Hiányzik a GOOGLE_OAUTH_CLIENT_ID / SECRET a .env.local-ból.' },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/drive/oauth/callback`;
  const authUrl = buildAuthUrl(redirectUri, user!.id);
  return NextResponse.redirect(authUrl);
}
