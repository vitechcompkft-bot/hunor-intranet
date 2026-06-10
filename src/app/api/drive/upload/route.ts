import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isDriveConnected, uploadFileToDrive } from '@/lib/google-drive';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Admin/központ: fájl(ok) feltöltése egy megadott Drive mappába.
 * POST multipart: folderId + file(s)
 * Megjegyzés: a Vercel kérés-mérete max ~4,5 MB/kérés.
 */
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
    const form = await request.formData();
    const folderId = form.get('folderId') as string | null;
    if (!folderId) return NextResponse.json({ error: 'Hiányzó célmappa' }, { status: 400 });

    const files = form.getAll('file').filter((f): f is File => f instanceof File);
    if (files.length === 0) return NextResponse.json({ error: 'Nincs fájl.' }, { status: 400 });

    const uploaded: { id: string; name: string }[] = [];
    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const safeName = file.name.replace(/[\\/]/g, '_');
      const result = await uploadFileToDrive(
        folderId,
        safeName,
        file.type || 'application/octet-stream',
        bytes
      );
      uploaded.push(result);
    }
    return NextResponse.json({ ok: true, uploaded });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Feltöltési hiba' }, { status: 500 });
  }
}
