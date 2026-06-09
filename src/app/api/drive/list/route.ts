import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  isDriveConnected,
  resolveIntranetFolderId,
  listDriveFolder,
  getFolderName,
} from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  // Csak bejelentkezett felhasználó
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 401 });

  if (!(await isDriveConnected())) {
    return NextResponse.json({ configured: false, items: [] });
  }

  try {
    const url = new URL(request.url);
    let folderId = url.searchParams.get('folderId');
    if (!folderId) {
      folderId = await resolveIntranetFolderId();
      if (!folderId) {
        return NextResponse.json({
          configured: true,
          error: 'Nem található az "Intranet" mappa. Oszd meg a service accounttal, vagy add meg a mappa ID-t.',
          items: [],
        });
      }
    }

    const [items, name] = await Promise.all([listDriveFolder(folderId), getFolderName(folderId)]);
    return NextResponse.json({ configured: true, folderId, folderName: name, items });
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : 'Drive hiba', items: [] },
      { status: 500 }
    );
  }
}
