import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isDriveConnected, listRootFolders } from '@/lib/google-drive';

export const runtime = 'nodejs';

/** Admin/központ: a Drive gyökerében lévő boltszám-mappák listája. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata as { role?: string } | undefined)?.role;
  if (role !== 'admin' && role !== 'kozpont') {
    return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 403 });
  }
  if (!(await isDriveConnected())) {
    return NextResponse.json({ configured: false, folders: [] });
  }
  try {
    const folders = await listRootFolders();
    return NextResponse.json({ configured: true, folders });
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : 'Drive hiba', folders: [] },
      { status: 500 }
    );
  }
}
