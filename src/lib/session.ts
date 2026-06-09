import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { toAppUser } from '@/lib/auth';
import type { AppUser } from '@/lib/types';

/** Aktuális bejelentkezett felhasználó (vagy null) — szerver oldalon. */
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return toAppUser(user);
}

/** Bejelentkezést igénylő oldalakhoz — ha nincs user, a /login-ra irányít. */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Staff (admin/kozpont) jogosultságot igénylő oldalakhoz. */
export async function requireStaff(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== 'admin' && user.role !== 'kozpont') redirect('/');
  return user;
}
