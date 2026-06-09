import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { AppUser, Role } from './types';

/**
 * Supabase auth user → alkalmazás-szintű AppUser.
 * A szerepkör és a bolt/trafik szám az app_metadata-ban van (RLS innen olvas),
 * a megjelenítendő név a user_metadata-ban (vagy az email helyi része).
 */
export function toAppUser(u: SupabaseUser | null | undefined): AppUser | null {
  if (!u) return null;
  const app = (u.app_metadata ?? {}) as Record<string, unknown>;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;

  const role = (app.role as Role) ?? 'viewer';
  const username =
    (meta.username as string) ||
    (meta.full_name as string) ||
    (u.email ? u.email.split('@')[0] : 'felhasználó');

  return {
    id: u.id,
    email: u.email ?? '',
    username,
    role,
    storeNumber: (app.store_number as string) || undefined,
    trafikNumber: (app.trafik_number as string) || undefined,
  };
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Adminisztrátor',
  kozpont: 'Központ',
  viewer: 'Bolt',
  trafik: 'Trafik',
};

/** Badge színosztályok szerepkörönként (Tailwind) */
export const ROLE_BADGE: Record<Role, string> = {
  admin: 'bg-blue-100 text-blue-700',
  kozpont: 'bg-purple-100 text-purple-700',
  viewer: 'bg-green-100 text-green-700',
  trafik: 'bg-orange-100 text-orange-700',
};
