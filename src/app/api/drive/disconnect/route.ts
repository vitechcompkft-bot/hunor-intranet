import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { disconnectDrive } from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata as { role?: string } | undefined)?.role;
  if (role !== 'admin') return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 403 });

  await disconnectDrive();
  return NextResponse.json({ ok: true });
}
