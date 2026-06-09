import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isDriveConfigured, isDriveConnected } from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 401 });

  return NextResponse.json({
    configured: isDriveConfigured(),
    connected: await isDriveConnected(),
  });
}
