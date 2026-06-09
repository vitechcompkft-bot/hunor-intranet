// Központi típusdefiníciók a HUNOR Intranet rendszerhez

export type Role = 'admin' | 'viewer' | 'kozpont' | 'trafik';

/** Bejelentkezett felhasználó, a Supabase auth.user app_metadata-jából származtatva */
export interface AppUser {
  id: string;
  email: string;
  username: string;
  role: Role;
  /** viewer / kozpont esetén pl. "B001" / "K01" */
  storeNumber?: string;
  /** trafik esetén pl. "T01" */
  trafikNumber?: string;
}

/** A felhasználóhoz rendelt bolt/trafik azonosító (szereptől függően) */
export function userScopeNumber(user: AppUser): string | undefined {
  return user.role === 'trafik' ? user.trafikNumber : user.storeNumber;
}

/** Menükulcsok — a *_menu_permissions táblákban és a navigációban használjuk */
export const MENU_KEYS = [
  'documentation',
  'chat',
  'message',
  'demand_form',
  'bug_report',
  'photo_submit',
  'video_conference',
  'store_folders',
] as const;
export type MenuKey = (typeof MENU_KEYS)[number];

/** Admin felhasználónkénti engedély-kulcsok (admin_menu_permissions oszlopok) */
export const ADMIN_MENU_KEYS = [
  'settings',
  'invoices',
  'work_assistant',
  'photo_download',
  'message',
  'demand_form',
  'bug_report',
  'chat',
  'video_conference',
  'documentation',
  'printers',
] as const;
export type AdminMenuKey = (typeof ADMIN_MENU_KEYS)[number];

export type BugStatus = 'Folyamatban' | 'Lezárva';
export type InvoiceType = 'B' | 'K';
export type InvoiceStatus = 'Kifizetésre vár' | 'Kifizetve';
export type StoreListType = 'store' | 'trafik';

export const BUG_NAMES = [
  'Internet probléma',
  'Kassza probléma',
  'Ügyfélkezelő probléma',
  'Nyomtató probléma',
  'Szerver probléma',
  'Vonalkód nyomtató probléma',
  'VPN zárolás',
  'Egyéb',
] as const;
export type BugName = (typeof BUG_NAMES)[number];

export const STORAGE_BUCKET = 'hunor-coop-files';

// --- Adatbázis sor-típusok --------------------------------------------------

export interface BugReport {
  id: string;
  report_number: number;
  store_number: string | null;
  bug_name: string;
  bug_description: string;
  attachment_path: string | null;
  status: BugStatus;
  completion_date: string | null;
  notes: string | null;
  reported_by: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  sender: string | null;
  invoice_type: InvoiceType | null;
  invoice_number: string | null;
  notes: string | null;
  net_amount: number | null;
  vat_amount: number | null;
  gross_amount: number | null;
  invoice_status: InvoiceStatus;
  invoice_date: string | null;
  store_number: string | null;
  created_at: string;
}

export interface DemandForm {
  id: string;
  title: string;
  rows: number;
  columns: number;
  headers: string[];
  first_column: string[];
  created_at: string;
}

export interface StoreListRow {
  id: string;
  type: StoreListType;
  number: string;
  label: string | null;
  sort_order: number;
}

export interface PhotoRow {
  id: string;
  store_number: string | null;
  trafik_number: string | null;
  photo_url: string;
  caption: string | null;
  created_at: string;
}
