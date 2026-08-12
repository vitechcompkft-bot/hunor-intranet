import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { toAppUser } from '@/lib/auth';
import { SCOPE_COOKIE, isValidScope } from '@/lib/scope';
import type { AppUser } from '@/lib/types';

/** Aktuális bejelentkezett felhasználó (vagy null) — szerver oldalon. */
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const appUser = toAppUser(user);
  if (!appUser) return null;

  // Munkamenet-szintű bolt/trafik szám: a belépéskor választott érték a
  // cookie-ból jön (nem a megosztott fiók app_metadata-jából). Így párhuzamos
  // belépéseknél a boltok nem írják felül egymás boltszámát. Ha nincs cookie
  // (pl. központ/admin fix számmal), marad az app_metadata-beli érték.
  const scope = (await cookies()).get(SCOPE_COOKIE)?.value?.trim();
  if (scope && isValidScope(scope)) {
    if (appUser.role === 'trafik') appUser.trafikNumber = scope;
    else appUser.storeNumber = scope;
  }
  return appUser;
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
