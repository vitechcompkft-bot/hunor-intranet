import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deleteDriveItem } from '@/lib/google-drive';

export const runtime = 'nodejs';

/** Admin/központ: fotó(k) vagy mappa törlése a Drive-ról. POST { ids: string[] } */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata as { role?: string } | undefined)?.role;
  if (role !== 'admin' && role !== 'kozpont') {
    return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 403 });
  }

  try {
    const { ids } = (await request.json()) as { ids?: string[] };
    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: 'Nincs törlendő elem' }, { status: 400 });
    }
    for (const id of ids) {
      await deleteDriveItem(id);
    }
    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Törlési hiba' }, { status: 500 });
  }
}
