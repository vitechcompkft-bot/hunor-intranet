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
// Teljes Drive hozzáférés: olvasás (megosztott mappa) + írás (fotó feltöltés).
const SCOPE = 'https://www.googleapis.com/auth/drive';

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

/**
 * Google-natív dokumentumok PDF-exportja megtekintéshez (mindhárom típus PDF,
 * hogy iPad Safari beágyazva meg tudja nyitni — az xlsx/pptx-et nem tudná).
 */
function googleNativeToPdf(mimeType: string): boolean {
  return (
    mimeType === 'application/vnd.google-apps.document' ||
    mimeType === 'application/vnd.google-apps.spreadsheet' ||
    mimeType === 'application/vnd.google-apps.presentation'
  );
}

/**
 * Feltöltött Office-fájl → a megfelelő Google-natív MIME (a copy-konverzióhoz),
 * vagy null, ha nem konvertálandó Office-típus.
 */
function officeToGoogleMime(mimeType: string): string | null {
  switch (mimeType) {
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword':
      return 'application/vnd.google-apps.document';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel':
      return 'application/vnd.google-apps.spreadsheet';
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    case 'application/vnd.ms-powerpoint':
      return 'application/vnd.google-apps.presentation';
    default:
      return null;
  }
}

/**
 * Office-fájl PDF-be konvertálása a Drive-on keresztül: ideiglenes Google-natív
 * másolat készítése → PDF-export → a másolat törlése. A szerver OAuth-tokenjével
 * fut (nincs szükség a néző Google-fiókjára), így VPN alatt is működik.
 */
async function convertOfficeToPdf(fileId: string, googleMime: string): Promise<ArrayBuffer> {
  const token = await getAccessToken();
  const auth = { Authorization: `Bearer ${token}` };

  // 1) Ideiglenes másolat Google-formátumban
  const copyRes = await fetch(`${DRIVE_API}/files/${fileId}/copy?supportsAllDrives=true&fields=id`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `__tmp_pdf_${fileId}`, mimeType: googleMime }),
  });
  if (!copyRes.ok) throw new Error('Konverzió (copy) hiba: ' + (await copyRes.text()));
  const tmpId = (await copyRes.json()).id as string;

  try {
    // 2) PDF-export
    const pdfRes = await fetch(
      `${DRIVE_API}/files/${tmpId}/export?mimeType=${encodeURIComponent('application/pdf')}`,
      { headers: auth }
    );
    if (!pdfRes.ok) throw new Error('Konverzió (export) hiba: ' + (await pdfRes.text()));
    return await pdfRes.arrayBuffer();
  } finally {
    // 3) Ideiglenes másolat törlése (best-effort)
    await fetch(`${DRIVE_API}/files/${tmpId}?supportsAllDrives=true`, {
      method: 'DELETE',
      headers: auth,
    }).catch(() => {});
  }
}

/** Egy fájl megtekintésre: Google-doksi/Office → PDF, egyéb bináris → eredeti. */
export async function fetchDriveFile(
  fileId: string
): Promise<{ body: ArrayBuffer; contentType: string; filename: string }> {
  const metaRes = await driveFetch(`/files/${fileId}?fields=name,mimeType&supportsAllDrives=true`);
  if (!metaRes.ok) throw new Error('Fájl nem található');
  const meta = await metaRes.json();
  const mimeType = meta.mimeType as string;
  const rawName = meta.name as string;
  const token = await getAccessToken();

  const pdfName = () => (rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`);

  // Google-natív doksi → PDF-export
  if (googleNativeToPdf(mimeType)) {
    const res = await fetch(
      `${DRIVE_API}/files/${fileId}/export?mimeType=${encodeURIComponent('application/pdf')}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error('Letöltési hiba: ' + (await res.text()));
    return { body: await res.arrayBuffer(), contentType: 'application/pdf', filename: pdfName() };
  }

  // Feltöltött Office-fájl → PDF-konverzió (hogy iPad Safari inline megnyissa).
  // Ha a konverzió elhasalna (pl. túl nagy fájl), visszaesünk az eredeti fájlra.
  const googleMime = officeToGoogleMime(mimeType);
  if (googleMime) {
    try {
      const pdf = await convertOfficeToPdf(fileId, googleMime);
      return { body: pdf, contentType: 'application/pdf', filename: pdfName() };
    } catch {
      // fallthrough az eredeti bináris kiszolgálásához
    }
  }

  // Egyéb (PDF, kép, ismeretlen bináris) → eredeti fájl változatlanul
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Letöltési hiba: ' + (await res.text()));
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  return { body: await res.arrayBuffer(), contentType, filename: rawName };
}

// === Fotó funkció: boltszám-mappák a Drive gyökerében ========================

/** A Drive gyökerében (My Drive) lévő mappák listája (boltszám-mappák). */
export async function listRootFolders(): Promise<{ id: string; name: string }[]> {
  const q = encodeURIComponent(`'root' in parents and mimeType='${FOLDER_MIME}' and trashed=false`);
  const res = await driveFetch(
    `/files?q=${q}&fields=files(id,name)&orderBy=name&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`
  );
  if (!res.ok) throw new Error('Drive gyökér listázási hiba: ' + (await res.text()));
  const data = await res.json();
  return (data.files ?? []).map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }));
}

/** Egy almappa azonosítója a megadott szülő alatt (ha nincs, létrehozza). */
export async function findOrCreateFolder(parentId: string, name: string): Promise<string> {
  const safe = name.replace(/['\\]/g, '');
  const q = encodeURIComponent(
    `name='${safe}' and '${parentId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`
  );
  const res = await driveFetch(
    `/files?q=${q}&fields=files(id,name)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`
  );
  if (res.ok) {
    const data = await res.json();
    if (data.files?.[0]?.id) return data.files[0].id;
  }
  const token = await getAccessToken();
  const createRes = await fetch(`${DRIVE_API}/files?supportsAllDrives=true&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: safe, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  if (!createRes.ok) throw new Error('Mappa létrehozási hiba: ' + (await createRes.text()));
  return (await createRes.json()).id;
}

/** Egy boltszám-mappa azonosítója a gyökérben (ha nincs, létrehozza). */
export async function findOrCreateStoreFolder(storeNumber: string): Promise<string> {
  return findOrCreateFolder('root', storeNumber);
}

/** Egy mappa tartalma szétválasztva: almappák + képek. */
export async function listFolderContents(folderId: string): Promise<{
  folders: { id: string; name: string }[];
  photos: { id: string; name: string; modifiedTime?: string }[];
}> {
  const items = await listDriveFolder(folderId);
  const folders = items
    .filter((i) => i.isFolder)
    .map((i) => ({ id: i.id, name: i.name }))
    .sort((a, b) => b.name.localeCompare(a.name)); // dátum-mappák: legújabb elöl
  const photos = items
    .filter((i) => !i.isFolder && i.mimeType.startsWith('image/'))
    .map((i) => ({ id: i.id, name: i.name, modifiedTime: i.modifiedTime }));
  return { folders, photos };
}

/** Egy mappa szülő-azonosítói (hozzáférés-ellenőrzéshez). */
export async function getFolderParents(folderId: string): Promise<string[]> {
  const res = await driveFetch(`/files/${folderId}?fields=parents&supportsAllDrives=true`);
  if (!res.ok) return [];
  return ((await res.json()).parents as string[]) ?? [];
}

/** Egy fájl vagy mappa törlése (kukába helyezés helyett végleges törlés). */
export async function deleteDriveItem(id: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${DRIVE_API}/files/${id}?supportsAllDrives=true`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error('Törlési hiba: ' + (await res.text()));
  }
}

// === Dokumentum-kereső (chatbot) ============================================

export interface DocMatch {
  id: string;
  name: string;
  isFolder: boolean;
  /** Mappa-útvonal az Intranet gyökértől a szülőig, pl. ['Intranet','Szabályzatok']. */
  folderPath: string[];
}

/** Ékezet- és kisbetű-független normalizálás. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// mappa-metaadat cache (id → {name, parents}) — a mappaszerkezet ritkán változik
const folderMetaCache = new Map<string, { name: string; parents: string[] }>();
let intranetIdCache: { id: string | null; at: number } | null = null;
const INTRANET_ID_TTL_MS = 30 * 60 * 1000;

async function getIntranetId(): Promise<string | null> {
  if (intranetIdCache && Date.now() - intranetIdCache.at < INTRANET_ID_TTL_MS) return intranetIdCache.id;
  const id = await resolveIntranetFolderId();
  intranetIdCache = { id, at: Date.now() };
  return id;
}

async function getFolderMeta(id: string): Promise<{ name: string; parents: string[] } | null> {
  const cached = folderMetaCache.get(id);
  if (cached) return cached;
  try {
    const res = await driveFetch(`/files/${id}?fields=name,parents&supportsAllDrives=true`);
    if (!res.ok) return null;
    const d = await res.json();
    const meta = { name: d.name as string, parents: (d.parents as string[]) ?? [] };
    folderMetaCache.set(id, meta);
    return meta;
  } catch {
    return null;
  }
}

/** A találat mappa-útvonala az Intranet gyökértől, vagy null ha nem az Intranet alatt van. */
async function resolvePathUnderIntranet(parents: string[]): Promise<string[] | null> {
  const intranetId = await getIntranetId();
  if (!intranetId) return null;
  const chain: string[] = [];
  let currentId: string | undefined = parents[0];
  for (let hop = 0; hop < 12 && currentId; hop++) {
    if (currentId === intranetId) return ['Intranet', ...chain.reverse()];
    const meta = await getFolderMeta(currentId);
    if (!meta) break;
    chain.push(meta.name);
    currentId = meta.parents[0];
  }
  return null;
}

interface DriveHit {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
}

/** Egy Drive keresés futtatása (q kifejezéssel). */
async function driveSearch(q: string): Promise<DriveHit[]> {
  try {
    const res = await driveFetch(
      `/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,parents)` +
        `&pageSize=40&supportsAllDrives=true&includeItemsFromAllDrives=true`
    );
    if (!res.ok) return [];
    return (await res.json()).files ?? [];
  } catch {
    return [];
  }
}

/**
 * Rákeres az Intranet megosztott dokumentumaira. NEM indexeli az egész fát
 * (az lassú), hanem a Drive keresőjével keres (név + tartalom), majd a
 * találatok szülő-láncát járja fel, és csak az Intranet alattiakat tartja meg.
 */
export async function searchIntranetDocuments(query: string, limit = 8): Promise<DocMatch[]> {
  const rawTokens = query.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3);
  const esc = (s: string) => s.replace(/['\\]/g, ' ').trim();

  const queries: string[] = [];
  const fullQ = esc(query);
  if (fullQ) queries.push(`fullText contains '${fullQ}' and trashed=false`);
  const nameClauses = rawTokens
    .slice(0, 4)
    .map((t) => esc(t))
    .filter((t) => t.length >= 3)
    .map((t) => `name contains '${t}'`);
  if (nameClauses.length) queries.push(`(${nameClauses.join(' or ')}) and trashed=false`);
  if (queries.length === 0) return [];

  const resultSets = await Promise.all(queries.map((q) => driveSearch(q)));
  const seen = new Map<string, DriveHit>();
  for (const set of resultSets) for (const f of set) if (!seen.has(f.id)) seen.set(f.id, f);

  const tokensN = rawTokens.map(norm);
  const scored: (DocMatch & { score: number })[] = [];
  for (const f of seen.values()) {
    const path = await resolvePathUnderIntranet(f.parents ?? []);
    if (!path) continue; // nem az Intranet megosztott dokumentumai alatt van
    const nameN = norm(f.name);
    let score = 1; // benne van a találati halmazban (tartalmi vagy név egyezés)
    for (const t of tokensN) if (nameN.includes(t)) score += 3;
    scored.push({
      id: f.id,
      name: f.name,
      isFolder: f.mimeType === FOLDER_MIME,
      folderPath: path,
      score,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ score: _score, ...m }) => m);
}

/** Fájl feltöltése egy mappába (multipart). */
export async function uploadFileToDrive(
  folderId: string,
  filename: string,
  mimeType: string,
  bytes: Buffer
): Promise<{ id: string; name: string }> {
  const token = await getAccessToken();
  const boundary = `hunor_boundary_${bytes.byteLength}_x`;
  const metadata = { name: filename, parents: [folderId] };
  const pre = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata
    )}\r\n--${boundary}\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`
  );
  const post = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([pre, bytes, post]);

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) throw new Error('Feltöltési hiba: ' + (await res.text()));
  return await res.json();
}
