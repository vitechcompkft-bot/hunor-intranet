import type { SupabaseClient } from '@supabase/supabase-js';
import type { BugReport } from '@/lib/types';

/**
 * El nem küldött hibajegyek helyi sora (localStorage) + háttér-újraküldés.
 *
 * Miért: a bolti VPN/WAN ingadozása miatt egy-egy hibajegy-mentés percekig nem
 * jut el a szerverhez (lásd a 649/701/503 eseteket). Ahelyett, hogy a bolt
 * sokszor újrapróbálná (és újragépelné), a beküldést elmentjük ide, és a
 * háttérben addig próbáljuk, amíg a kapcsolat helyre nem áll. A mentés
 * IDEMPOTENS (tartalmi dedup), hogy a lost-ack újrapróbák ne hozzanak létre
 * duplikált jegyet.
 */

export interface PendingBugPayload {
  store_number: string | null;
  bug_name: string;
  bug_description: string;
  attachment_path: string | null;
  reported_by: string;
}

export interface PendingBugNotification {
  cim: string;
  prioritas: string;
  bekuldo: string;
  idopont: string;
  melleklet: string;
  leiras: string;
}

export interface PendingBug {
  id: string;
  payload: PendingBugPayload;
  notification: PendingBugNotification;
  createdAt: string; // ISO
  tries: number;
}

const KEY = 'hunor_pending_bugs';

/** FF93-kompatibilis azonosító (nincs crypto.randomUUID FF95 előtt). */
export function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getPendingBugs(): PendingBug[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as PendingBug[]) : [];
  } catch {
    return [];
  }
}

function savePendingBugs(list: PendingBug[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* privát mód / tele tároló — ilyenkor nincs háttér-sor */
  }
}

export function enqueuePendingBug(item: PendingBug): void {
  const list = getPendingBugs();
  list.push(item);
  savePendingBugs(list);
}

export function removePendingBug(id: string): void {
  savePendingBugs(getPendingBugs().filter((i) => i.id !== id));
}

export function updatePendingBug(id: string, patch: Partial<PendingBug>): void {
  savePendingBugs(getPendingBugs().map((i) => (i.id === id ? { ...i, ...patch } : i)));
}

// === Hibabesorolás (a sor és az űrlap is ezt használja) =====================

export function errMessage(e: unknown): string {
  return (
    (typeof e === 'object' && e !== null && 'message' in e
      ? String((e as { message: unknown }).message)
      : e instanceof Error
        ? e.message
        : String(e ?? '')) || ''
  );
}

/** Lejárt / érvénytelen munkamenet. */
export function isAuthError(e: unknown): boolean {
  const low = errMessage(e).toLowerCase();
  return (
    low.includes('jwt') ||
    low.includes('expired') ||
    low.includes('unauthorized') ||
    low.includes('not authenticated') ||
    low.includes('refresh token') ||
    low.includes('invalid token') ||
    low.includes('401')
  );
}

/** Átmeneti hálózati/kapcsolati hiba (érdemes újrapróbálni). */
export function isNetworkError(e: unknown): boolean {
  const raw = errMessage(e);
  const low = raw.toLowerCase();
  return (
    raw === '' ||
    low.includes('failed to fetch') ||
    low.includes('load failed') ||
    low.includes('networkerror') ||
    low.includes('network request') ||
    low.includes('fetch') ||
    low.includes('timeout') ||
    low.includes('nem elérhető') ||
    low.includes('502') ||
    low.includes('503') ||
    low.includes('504')
  );
}

// === Idempotens küldés ======================================================

async function fireTelegram(n: PendingBugNotification): Promise<void> {
  try {
    await fetch('/api/telegram/notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n),
    });
  } catch {
    /* a Telegram legjobb-szándékú, hibája nem számít */
  }
}

/** Beküldte-e már egy korábbi (lost-ack) próbánk ugyanezt a jegyet? */
async function alreadySaved(supabase: SupabaseClient, item: PendingBug): Promise<boolean> {
  const since = new Date(new Date(item.createdAt).getTime() - 15000).toISOString();
  let q = supabase
    .from('bug_reports')
    .select('id')
    .eq('reported_by', item.payload.reported_by)
    .eq('bug_description', item.payload.bug_description)
    .gte('created_at', since)
    .limit(1);
  q =
    item.payload.store_number == null
      ? q.is('store_number', null)
      : q.eq('store_number', item.payload.store_number);
  const { data, error } = await q;
  if (error) throw error; // olvasási hiba → a hívó eldönti (kimaradás alatt ne dedupláljon)
  return Array.isArray(data) && data.length > 0;
}

export type SendResult = 'sent' | 'retry' | 'failed';

/** Egy várakozó jegy elküldése. Nem dob — a visszatérés dönti el a teendőt. */
export async function sendPendingBug(supabase: SupabaseClient, item: PendingBug): Promise<SendResult> {
  // Idempotencia: ha egy korábbi próbánk mégis bement, ne hozzunk létre duplát.
  try {
    if (await alreadySaved(supabase, item)) {
      await fireTelegram(item.notification);
      return 'sent';
    }
  } catch {
    /* a dedup-olvasás hibája (kimaradás) ne blokkoljon — megpróbáljuk a mentést */
  }

  let error: unknown = null;
  try {
    const res = await supabase
      .from('bug_reports')
      .insert(item.payload satisfies Partial<BugReport> & { reported_by: string });
    error = res.error;
  } catch (e) {
    error = e;
  }

  if (!error) {
    await fireTelegram(item.notification);
    return 'sent';
  }
  return isNetworkError(error) ? 'retry' : 'failed';
}
