import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isDriveConnected, findOrCreateFolder } from '@/lib/google-drive';

export const runtime = 'nodejs';

/** Admin/központ: új mappa létrehozása a megadott szülő alatt. POST { parentId, name } */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata as { role?: string } | undefined)?.role;
  if (role !== 'admin' && role !== 'kozpont') {
    return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 403 });
  }
  if (!(await isDriveConnected())) {
    return NextResponse.json({ error: 'A Google Drive nincs csatlakoztatva.' }, { status: 400 });
  }

  try {
    const { parentId, name } = (await request.json()) as { parentId?: string; name?: string };
    if (!parentId || !name?.trim()) {
      return NextResponse.json({ error: 'Hiányzó mappanév' }, { status: 400 });
    }
    const id = await findOrCreateFolder(parentId, name.trim());
    return NextResponse.json({ ok: true, id, name: name.trim() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Hiba' }, { status: 500 });
  }
}
