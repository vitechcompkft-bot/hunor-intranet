import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchDriveFile } from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Hiányzó fájl azonosító' }, { status: 400 });

  try {
    const { body, contentType, filename } = await fetchDriveFile(id);
    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        // inline → a böngésző megpróbálja megjeleníteni (PDF/kép), egyébként letölti
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Hiba' }, { status: 500 });
  }
}
