import { createAdminClient } from '@/lib/supabase/server';

/**
 * Google Drive hozzáférés OAuth2-vel (szerver oldal, csak olvasás).
 * Az admin egyszer csatlakoztatja a céges Google fiókot; a refresh tokent a
 * google_oauth_tokens táblában tároljuk (csak service_role éri el). Minden
 * felhasználó ezt a közös hozzáférést használja → mindenki ugyanazt látja.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

/** Be van-e állítva az OAuth kliens (env)? */
export function isDriveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

/** A Google consent oldal URL-je (a csatlakoztatás indításához). */
export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // hogy mindenképp kapjunk refresh tokent
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/** Authorization code → tokenek; a refresh tokent eltároljuk. */
export async function exchangeCodeAndStore(code: string, redirectUri: string): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error('Token csere hiba: ' + (await res.text()));
  const data = await res.json();
  if (!data.refresh_token) {
    throw new Error('Nem érkezett refresh token. Próbáld újra a csatlakoztatást (prompt=consent).');
  }

  const admin = createAdminClient();
  await admin.from('google_oauth_tokens').upsert({
    id: 1,
    refresh_token: data.refresh_token,
    access_token: data.access_token ?? null,
    token_expiry: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  cached = data.access_token
    ? { token: data.access_token, exp: Date.now() / 1000 + (data.expires_in ?? 3600) }
    : null;
}

async function getRefreshToken(): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('google_oauth_tokens')
      .select('refresh_token')
      .eq('id', 1)
      .maybeSingle();
    return data?.refresh_token ?? null;
  } catch {
    return null;
  }
}

/** Csatlakoztatva van-e (van tárolt refresh token)? */
export async function isDriveConnected(): Promise<boolean> {
  if (!isDriveConfigured()) return false;
  return Boolean(await getRefreshToken());
}

/** A csatlakozás bontása (token törlése). */
export async function disconnectDrive(): Promise<void> {
  const admin = createAdminClient();
  await admin.from('google_oauth_tokens').delete().eq('id', 1);
  cached = null;
}

let cached: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() / 1000 + 60) return cached.token;
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error('A Google Drive nincs csatlakoztatva.');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Token frissítési hiba: ' + (await res.text()));
  const data = await res.json();
  cached = { token: data.access_token, exp: Date.now() / 1000 + (data.expires_in ?? 3600) };
  return cached.token;
}

async function driveFetch(path: string): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${DRIVE_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

/** Az "Intranet" gyökérmappa azonosítója (env-ből, vagy név alapján keresve). */
export async function resolveIntranetFolderId(): Promise<string | null> {
  if (process.env.GOOGLE_DRIVE_INTRANET_FOLDER_ID) {
    return process.env.GOOGLE_DRIVE_INTRANET_FOLDER_ID;
  }
  const q = encodeURIComponent(`name='Intranet' and mimeType='${FOLDER_MIME}' and trashed=false`);
  const res = await driveFetch(
    `/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1`
  );
  if (!res.ok) throw new Error('Drive keresési hiba: ' + (await res.text()));
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

export interface DriveItem {
  id: string;
  name: string;
  isFolder: boolean;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
}

/** Egy mappa tartalmának listázása. */
export async function listDriveFolder(folderId: string): Promise<DriveItem[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = encodeURIComponent('files(id,name,mimeType,size,modifiedTime)');
  const res = await driveFetch(
    `/files?q=${q}&fields=${fields}&orderBy=folder,name&pageSize=1000` +
      `&supportsAllDrives=true&includeItemsFromAllDrives=true`
  );
  if (!res.ok) throw new Error('Drive listázási hiba: ' + (await res.text()));
  const data = await res.json();
  return (data.files ?? []).map(
    (f: { id: string; name: string; mimeType: string; size?: string; modifiedTime?: string }) => ({
      id: f.id,
      name: f.name,
      isFolder: f.mimeType === FOLDER_MIME,
      mimeType: f.mimeType,
      size: f.size ? Number(f.size) : undefined,
      modifiedTime: f.modifiedTime,
    })
  );
}

/** Egy mappa neve (breadcrumbhoz). */
export async function getFolderName(folderId: string): Promise<string> {
  const res = await driveFetch(`/files/${folderId}?fields=name&supportsAllDrives=true`);
  if (!res.ok) return '';
  return (await res.json()).name ?? '';
}

/** Google-natív dokumentumok export MIME-típusa, vagy null bináris fájlnál. */
function exportMimeFor(mimeType: string): string | null {
  if (mimeType === 'application/vnd.google-apps.document') return 'application/pdf';
  if (mimeType === 'application/vnd.google-apps.spreadsheet')
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (mimeType === 'application/vnd.google-apps.presentation') return 'application/pdf';
  return null;
}

/** Egy fájl letöltése (bináris) vagy Google-doksi exportja. */
export async function fetchDriveFile(
  fileId: string
): Promise<{ body: ArrayBuffer; contentType: string; filename: string }> {
  const metaRes = await driveFetch(`/files/${fileId}?fields=name,mimeType&supportsAllDrives=true`);
  if (!metaRes.ok) throw new Error('Fájl nem található');
  const meta = await metaRes.json();
  const exportMime = exportMimeFor(meta.mimeType);

  const token = await getAccessToken();
  const url = exportMime
    ? `${DRIVE_API}/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`
    : `${DRIVE_API}/files/${fileId}?alt=media&supportsAllDrives=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Letöltési hiba: ' + (await res.text()));

  const contentType = exportMime ?? res.headers.get('content-type') ?? 'application/octet-stream';
  let filename = meta.name as string;
  if (exportMime === 'application/pdf' && !filename.toLowerCase().endsWith('.pdf')) filename += '.pdf';
  return { body: await res.arrayBuffer(), contentType, filename };
}
