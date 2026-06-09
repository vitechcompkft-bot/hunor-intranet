import { NextResponse } from 'next/server';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/** Ellenőrzi, hogy a hívó admin-e. */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata as { role?: string } | undefined)?.role;
  return role === 'admin' ? user : null;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 403 });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;

    const users = data.users.map((u: SupabaseUser) => ({
      id: u.id,
      email: u.email ?? '',
      role: (u.app_metadata as { role?: string })?.role ?? 'viewer',
      store_number: (u.app_metadata as { store_number?: string })?.store_number ?? null,
      trafik_number: (u.app_metadata as { trafik_number?: string })?.trafik_number ?? null,
      username: (u.user_metadata as { username?: string })?.username ?? null,
    }));
    return NextResponse.json({ users });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Lekérési hiba (service role kulcs?)' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 403 });

  try {
    const { user_id, action, value } = await request.json();
    if (!user_id || !action) return NextResponse.json({ error: 'Hiányzó paraméter' }, { status: 400 });

    const admin = createAdminClient();

    if (action === 'update_password') {
      const { error } = await admin.auth.admin.updateUserById(user_id, { password: value });
      if (error) throw error;
    } else if (action === 'update_username') {
      const { data: u } = await admin.auth.admin.getUserById(user_id);
      const meta = { ...(u?.user?.user_metadata ?? {}), username: value };
      const { error } = await admin.auth.admin.updateUserById(user_id, { user_metadata: meta });
      if (error) throw error;
    } else if (action === 'update_store') {
      const { error } = await admin.rpc('update_user_store_number', {
        user_id,
        new_store_number: value,
      });
      if (error) throw error;
    } else {
      return NextResponse.json({ error: 'Ismeretlen művelet' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Hiba' }, { status: 500 });
  }
}
