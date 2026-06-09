import type { SupabaseClient } from '@supabase/supabase-js';
import { STORAGE_BUCKET } from './types';

export interface StorageItem {
  name: string;
  isFolder: boolean;
  size?: number;
  updatedAt?: string;
  /** Teljes elérési út a bucketen belül (mappáknál a mappa útvonala) */
  path: string;
}

const KEEP = '.keep';

/** Összefűz útvonalrészeket, dupla és vezető perjelek nélkül. */
export function joinPath(...parts: (string | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
}

/** Egy mappa tartalmának listázása (mappák és fájlok). */
export async function listFolder(
  supabase: SupabaseClient,
  path: string
): Promise<StorageItem[]> {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(path, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw error;

  return (data ?? [])
    .filter((e) => e.name !== KEEP)
    .map((e) => {
      const isFolder = e.id === null; // a Supabase a mappákat id=null-lal adja vissza
      return {
        name: e.name,
        isFolder,
        size: e.metadata?.size as number | undefined,
        updatedAt: (e.updated_at as string | undefined) ?? undefined,
        path: joinPath(path, e.name),
      };
    });
}

/** Új (üres) mappa létrehozása egy .keep placeholder feltöltésével. */
export async function createFolder(supabase: SupabaseClient, path: string, name: string) {
  const keepPath = joinPath(path, name, KEEP);
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(keepPath, new Blob(['']), { upsert: true });
  if (error) throw error;
}

/** Egy fájl feltöltése a megadott mappába. */
export async function uploadFile(supabase: SupabaseClient, path: string, file: File) {
  const target = joinPath(path, file.name);
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(target, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return target;
}

/** Egy fájl törlése. */
export async function deleteFile(supabase: SupabaseClient, path: string) {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) throw error;
}

/** Egy mappa összes objektumútvonalának rekurzív összegyűjtése (a .keep-et is). */
async function collectPaths(supabase: SupabaseClient, folder: string): Promise<string[]> {
  const { data } = await supabase.storage.from(STORAGE_BUCKET).list(folder, { limit: 1000 });
  const paths: string[] = [];
  for (const e of data ?? []) {
    const full = joinPath(folder, e.name);
    if (e.id === null) {
      paths.push(...(await collectPaths(supabase, full)));
    } else {
      paths.push(full);
    }
  }
  return paths;
}

/** Igaz, ha a mappa üres (csak .keep van benne, vagy semmi). */
export async function isFolderEmpty(supabase: SupabaseClient, folder: string): Promise<boolean> {
  const { data } = await supabase.storage.from(STORAGE_BUCKET).list(folder, { limit: 1000 });
  const real = (data ?? []).filter((e) => e.name !== KEEP);
  return real.length === 0;
}

/** Üres mappa törlése (a .keep eltávolítása). */
export async function deleteFolder(supabase: SupabaseClient, folder: string) {
  const paths = await collectPaths(supabase, folder);
  if (paths.length > 0) {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
    if (error) throw error;
  }
}

/** Mappa átnevezése: minden objektum áthelyezése az új prefix alá. */
export async function renameFolder(supabase: SupabaseClient, folder: string, newName: string) {
  const parent = folder.includes('/') ? folder.slice(0, folder.lastIndexOf('/')) : '';
  const target = joinPath(parent, newName);
  const paths = await collectPaths(supabase, folder);
  for (const p of paths) {
    const rest = p.slice(folder.length).replace(/^\//, '');
    const dest = joinPath(target, rest);
    const { error } = await supabase.storage.from(STORAGE_BUCKET).move(p, dest);
    if (error) throw error;
  }
}

/** Aláírt URL generálása letöltéshez/előnézethez (alapból 60 mp). */
export async function getSignedUrl(
  supabase: SupabaseClient,
  path: string,
  expiresIn = 60
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) throw error ?? new Error('Nem sikerült az URL generálása');
  return data.signedUrl;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
