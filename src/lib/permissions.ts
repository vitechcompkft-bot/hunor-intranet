import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUser } from './types';
import type { NavKey } from './nav';

/** A bolt/trafik szintű menü-engedély táblák menu_key → NavKey leképezése */
const STORE_KEY_MAP: Record<string, NavKey> = {
  store_folders: 'store_folders',
  bug_report: 'bug_report',
  demand_form: 'demand_form',
  message: 'message',
  photo_submit: 'photo',
  video_conference: 'video_conference',
  documentation: 'documentation',
  chat: 'chat',
};

/** Az admin_menu_permissions oszlop → NavKey leképezése */
const ADMIN_COL_MAP: Record<string, NavKey> = {
  settings: 'settings',
  photo_download: 'photo',
  message: 'message',
  demand_form: 'demand_form',
  bug_report: 'bug_report',
  chat: 'chat',
  video_conference: 'video_conference',
  documentation: 'documentation',
};

/** Staff-only NavKey-k, amelyek a központnál alapból engedélyezettek */
const KOZPONT_STAFF_DEFAULTS: NavKey[] = ['settings', 'photo'];

/**
 * Feloldja, hogy az adott felhasználó mely menüpontokat láthatja.
 * Hibatűrő: ha egy lekérdezés elhasal, ésszerű alapértékre esik vissza.
 */
export async function resolveAllowedMenus(
  supabase: SupabaseClient,
  user: AppUser
): Promise<Set<NavKey>> {
  const allowed = new Set<NavKey>();
  // A fájlböngésző (kezdőlap) mindenkinek elérhető
  allowed.add('store_folders');

  try {
    if (user.role === 'admin') {
      const { data } = await supabase
        .from('admin_menu_permissions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        for (const [col, navKey] of Object.entries(ADMIN_COL_MAP)) {
          if (data[col]) allowed.add(navKey);
        }
      } else {
        // Nincs egyedi sor → admin mindent lát
        Object.values(ADMIN_COL_MAP).forEach((k) => allowed.add(k));
      }
      return allowed;
    }

    if (user.role === 'kozpont') {
      KOZPONT_STAFF_DEFAULTS.forEach((k) => allowed.add(k));
      const { data } = await supabase
        .from('kozpont_menu_permissions')
        .select('menu_key,is_enabled');
      (data ?? []).forEach((row) => {
        if (row.is_enabled) {
          const nav = STORE_KEY_MAP[row.menu_key];
          if (nav) allowed.add(nav);
        }
      });
      return allowed;
    }

    // viewer / trafik
    const table = user.role === 'trafik' ? 'trafik_menu_permissions' : 'viewer_menu_permissions';
    const { data } = await supabase.from(table).select('menu_key,is_enabled');
    (data ?? []).forEach((row) => {
      if (row.is_enabled) {
        const nav = STORE_KEY_MAP[row.menu_key];
        if (nav) allowed.add(nav);
      }
    });
  } catch {
    // Hiba esetén legalább a kezdőlap maradjon elérhető
  }

  return allowed;
}
