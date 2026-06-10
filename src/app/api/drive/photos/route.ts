import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isDriveConnected, listDriveFolder, findOrCreateStoreFolder } from '@/lib/google-drive';

export const runtime = 'nodejs';

/**
 * Fotók listája egy mappából.
 * - admin/központ: a query ?folderId= mappa képei
 * - bolt/trafik: a SAJÁT boltszám-mappája (a session alapján), a kliens nem adhatja meg
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 401 });

  const app = (user.app_metadata ?? {}) as { role?: string; store_number?: string; trafik_number?: string };
  const role = app.role ?? 'viewer';
  const isStaff = role === 'admin' || role === 'kozpont';

  if (!(await isDriveConnected())) {
    return NextResponse.json({ configured: false, photos: [] });
  }

  try {
    let folderId: string | null = null;
    if (isStaff) {
      folderId = new URL(request.url).searchParams.get('folderId');
      if (!folderId) return NextResponse.json({ error: 'Hiányzó folderId' }, { status: 400 });
    } else {
      const scope = role === 'trafik' ? app.trafik_number : app.store_number;
      if (!scope) return NextResponse.json({ configured: true, photos: [] });
      folderId = await findOrCreateStoreFolder(scope);
    }

    const items = await listDriveFolder(folderId);
    const photos = items
      .filter((i) => !i.isFolder && i.mimeType.startsWith('image/'))
      .map((i) => ({ id: i.id, name: i.name, modifiedTime: i.modifiedTime }));
    return NextResponse.json({ configured: true, folderId, photos });
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : 'Drive hiba', photos: [] },
      { status: 500 }
    );
  }
}
