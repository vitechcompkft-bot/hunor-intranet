import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isDriveConnected, findOrCreateStoreFolder, uploadFileToDrive } from '@/lib/google-drive';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Fotó(k) feltöltése a Drive-ra.
 * - bolt/trafik: a SAJÁT boltszám-mappájába (a session alapján)
 * - admin/központ: a 'store' mezőben megadott bolt mappájába
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 401 });

  if (!(await isDriveConnected())) {
    return NextResponse.json({ error: 'A Google Drive nincs csatlakoztatva.' }, { status: 400 });
  }

  const app = (user.app_metadata ?? {}) as { role?: string; store_number?: string; trafik_number?: string };
  const role = app.role ?? 'viewer';
  const isStaff = role === 'admin' || role === 'kozpont';

  try {
    const form = await request.formData();
    const targetStore = isStaff
      ? (form.get('store') as string | null)
      : role === 'trafik'
        ? app.trafik_number
        : app.store_number;

    if (!targetStore) {
      return NextResponse.json({ error: 'Nincs boltszám a feltöltéshez.' }, { status: 400 });
    }

    const files = form.getAll('file').filter((f): f is File => f instanceof File);
    if (files.length === 0) return NextResponse.json({ error: 'Nincs fájl.' }, { status: 400 });

    const folderId = await findOrCreateStoreFolder(targetStore);
    const uploaded: { id: string; name: string }[] = [];
    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const safeName = file.name.replace(/[\\/]/g, '_');
      const result = await uploadFileToDrive(folderId, safeName, file.type, bytes);
      uploaded.push(result);
    }

    return NextResponse.json({ ok: true, uploaded });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Feltöltési hiba' }, { status: 500 });
  }
}
