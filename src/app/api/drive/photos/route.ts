import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  isDriveConnected,
  listFolderContents,
  findOrCreateStoreFolder,
  getFolderParents,
} from '@/lib/google-drive';

export const runtime = 'nodejs';

/**
 * Egy mappa tartalma (almappák + képek).
 * - admin/központ: a query ?folderId= mappa tartalma
 * - bolt/trafik: a SAJÁT boltszám-mappája, vagy annak egy almappája (dátum-mappa).
 *   A kliens nem érhet el más bolt mappáját (szülő-ellenőrzés).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 401 });

  const app = (user.app_metadata ?? {}) as {
    role?: string;
    store_number?: string;
    trafik_number?: string;
  };
  const role = app.role ?? 'viewer';
  const isStaff = role === 'admin' || role === 'kozpont';

  if (!(await isDriveConnected())) {
    return NextResponse.json({ configured: false, folders: [], photos: [] });
  }

  try {
    const requested = new URL(request.url).searchParams.get('folderId');
    let folderId: string;

    if (isStaff) {
      if (!requested) return NextResponse.json({ error: 'Hiányzó folderId' }, { status: 400 });
      folderId = requested;
    } else {
      const scope = role === 'trafik' ? app.trafik_number : app.store_number;
      if (!scope) return NextResponse.json({ configured: true, folders: [], photos: [] });
      const storeFolderId = await findOrCreateStoreFolder(scope);
      if (!requested || requested === storeFolderId) {
        folderId = storeFolderId;
      } else {
        // csak a saját bolt-mappa közvetlen almappája engedélyezett
        const parents = await getFolderParents(requested);
        if (!parents.includes(storeFolderId)) {
          return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 403 });
        }
        folderId = requested;
      }
    }

    const { folders, photos } = await listFolderContents(folderId);
    return NextResponse.json({ configured: true, folderId, folders, photos });
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : 'Drive hiba', folders: [], photos: [] },
      { status: 500 }
    );
  }
}
