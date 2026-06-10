'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  UploadCloud,
  Loader2,
  Folder,
  ArrowLeft,
  Download,
  Trash2,
  CloudOff,
  ImageIcon,
  ChevronRight,
  Home,
  CheckSquare,
  Square,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AppUser } from '@/lib/types';

interface DrivePhoto {
  id: string;
  name: string;
  modifiedTime?: string;
}
interface FolderRef {
  id: string;
  name: string;
}
type FolderFilter = 'all' | 'store' | 'trafik';

const MAX_SIZE = 25 * 1024 * 1024;

// ---- Kliensoldali kép-tömörítés (FF93-kompatibilis) -------------------------
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  try {
    if (!file.type.startsWith('image/')) return file;
    const img = await loadImage(file);
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (Math.max(w, h) > maxDim) {
      const s = maxDim / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), 'image/jpeg', quality)
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');
function nowParts() {
  const d = new Date();
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`,
  };
}

/** Több fájl letöltése egyenként (nem ZIP-ben), kis késleltetéssel. */
async function downloadSequential(photos: DrivePhoto[]) {
  for (const p of photos) {
    const a = document.createElement('a');
    a.href = `/api/drive/file?id=${p.id}`;
    a.download = p.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    await new Promise((r) => setTimeout(r, 500));
  }
}

// ---- Megosztott UI ----------------------------------------------------------
function PhotoThumb({ p, children }: { p: DrivePhoto; children?: React.ReactNode }) {
  const src = `/api/drive/file?id=${p.id}`;
  return (
    <div className="card relative overflow-hidden">
      {children}
      <a href={src} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={p.name} className="h-40 w-full bg-gray-100 object-cover" loading="lazy" />
      </a>
      <div className="flex items-center justify-between gap-2 p-2">
        <span className="truncate text-xs text-gray-600" title={p.name}>
          {p.name}
        </span>
      </div>
    </div>
  );
}

/** Bolti (egyszerű) galéria — csak megtekintés + letöltés */
function Gallery({ photos }: { photos: DrivePhoto[] }) {
  if (photos.length === 0) {
    return <div className="card p-10 text-center text-gray-400">Nincs fotó ebben a mappában.</div>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((p) => (
        <PhotoThumb key={p.id} p={p}>
          <a
            href={`/api/drive/file?id=${p.id}`}
            download={p.name}
            target="_blank"
            rel="noreferrer"
            className="absolute right-1 top-1 z-10 rounded-md bg-white/90 p-1.5 text-gray-500 shadow hover:text-gray-800"
            title="Letöltés"
          >
            <Download size={15} />
          </a>
        </PhotoThumb>
      ))}
    </div>
  );
}

/** Admin galéria — kijelölés, csoportos letöltés, törlés */
function AdminGallery({ photos, onChanged }: { photos: DrivePhoto[]; onChanged: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const allSelected = photos.length > 0 && selected.size === photos.length;
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(photos.map((p) => p.id)));
  }

  const target = selected.size > 0 ? photos.filter((p) => selected.has(p.id)) : photos;

  async function download() {
    setBusy(true);
    await downloadSequential(target);
    setBusy(false);
  }

  async function remove() {
    const ids = [...selected];
    if (ids.length === 0) {
      alert('Jelölj ki fotó(ka)t a törléshez.');
      return;
    }
    if (!confirm(`Biztosan véglegesen törlöd a kijelölt ${ids.length} fotót?`)) return;
    setBusy(true);
    await fetch('/api/drive/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    setBusy(false);
    setSelected(new Set());
    onChanged();
  }

  if (photos.length === 0) {
    return <div className="card p-10 text-center text-gray-400">Nincs fotó ebben a mappában.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={toggleAll} className="btn-secondary">
          {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
          {allSelected ? 'Kijelölés törlése' : 'Mind kijelöl'}
        </button>
        <button onClick={download} className="btn-secondary" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Letöltés ({selected.size > 0 ? selected.size : 'összes'})
        </button>
        <button onClick={remove} className="btn-danger" disabled={busy || selected.size === 0}>
          <Trash2 size={16} /> Törlés ({selected.size})
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => {
          const isSel = selected.has(p.id);
          return (
            <div
              key={p.id}
              className={`card relative overflow-hidden ${isSel ? 'ring-2 ring-brand-500' : ''}`}
            >
              <button
                onClick={() => toggle(p.id)}
                className="absolute left-1 top-1 z-10 rounded-md bg-white/90 p-1 text-brand-600 shadow"
                title="Kijelölés"
              >
                {isSel ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
              <a
                href={`/api/drive/file?id=${p.id}`}
                download={p.name}
                target="_blank"
                rel="noreferrer"
                className="absolute right-1 top-1 z-10 rounded-md bg-white/90 p-1.5 text-gray-500 shadow hover:text-gray-800"
                title="Letöltés"
              >
                <Download size={14} />
              </a>
              <a href={`/api/drive/file?id=${p.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/drive/file?id=${p.id}`}
                  alt={p.name}
                  className="h-40 w-full bg-gray-100 object-cover"
                  loading="lazy"
                />
              </a>
              <div className="truncate p-2 text-xs text-gray-600" title={p.name}>
                {p.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FolderGrid({
  folders,
  onOpen,
  onDelete,
}: {
  folders: FolderRef[];
  onOpen: (f: FolderRef) => void;
  onDelete?: (f: FolderRef) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {folders.map((f) => (
        <div key={f.id} className="card relative flex flex-col items-center gap-2 p-5">
          {onDelete && (
            <button
              onClick={() => onDelete(f)}
              className="absolute right-1 top-1 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-600"
              title="Mappa törlése"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={() => onOpen(f)} className="flex flex-col items-center gap-2">
            <Folder size={32} className="text-brand-500" />
            <span className="text-sm font-medium text-gray-800">{f.name}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center text-gray-500">
      <CloudOff size={32} className="text-gray-300" />
      <p className="font-medium text-gray-700">A Google Drive még nincs csatlakoztatva.</p>
      <p className="text-sm">Az admin a Beállítások → Google Drive fülön tudja csatlakoztatni.</p>
    </div>
  );
}

function Breadcrumb({ path, onGo }: { path: FolderRef[]; onGo: (index: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
      <button onClick={() => onGo(-1)} className="flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-100 hover:text-gray-900">
        <Home size={14} /> Fotók
      </button>
      {path.map((p, i) => (
        <span key={p.id} className="flex items-center gap-1">
          <ChevronRight size={14} className="text-gray-300" />
          <button onClick={() => onGo(i)} className="rounded px-2 py-1 hover:bg-gray-100 hover:text-gray-900">
            {p.name}
          </button>
        </span>
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <div className="card flex items-center justify-center py-16 text-gray-400">
      <Loader2 className="animate-spin" />
    </div>
  );
}

// ---- Belépési pont ----------------------------------------------------------
export function PhotoPage({ user }: { user: AppUser }) {
  const isStaff = user.role === 'admin' || user.role === 'kozpont';
  return isStaff ? <AdminPhotos /> : <StorePhotos />;
}

// ---- Admin: bolt-mappák (szűrhető) -> dátum-mappák -> képek ------------------
function AdminPhotos() {
  const supabase = useMemo(() => createClient(), []);
  const [storeFolders, setStoreFolders] = useState<FolderRef[]>([]);
  const [typeMap, setTypeMap] = useState<Record<string, 'store' | 'trafik'>>({});
  const [filter, setFilter] = useState<FolderFilter>('all');
  const [path, setPath] = useState<FolderRef[]>([]);
  const [folders, setFolders] = useState<FolderRef[]>([]);
  const [photos, setPhotos] = useState<DrivePhoto[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [foldersRes, storeLists] = await Promise.all([
        fetch('/api/drive/photo-folders').then((r) => r.json()),
        supabase.from('store_lists').select('number,type'),
      ]);
      setConfigured(foldersRes.configured !== false);
      setStoreFolders(foldersRes.folders ?? []);
      const map: Record<string, 'store' | 'trafik'> = {};
      (storeLists.data ?? []).forEach((s: { number: string; type: 'store' | 'trafik' }) => {
        map[s.number] = s.type;
      });
      setTypeMap(map);
      setLoading(false);
    })();
  }, [supabase]);

  const loadContents = useCallback(async (id: string) => {
    setLoading(true);
    const res = await fetch(`/api/drive/photos?folderId=${id}`);
    const d = await res.json();
    setFolders(d.folders ?? []);
    setPhotos(d.photos ?? []);
    setLoading(false);
  }, []);

  function openFolder(f: FolderRef) {
    setPath((p) => [...p, f]);
    loadContents(f.id);
  }
  function goTo(index: number) {
    if (index < 0) {
      setPath([]);
      return;
    }
    const np = path.slice(0, index + 1);
    setPath(np);
    loadContents(np[np.length - 1].id);
  }

  async function deleteFolder(f: FolderRef) {
    if (!confirm(`Biztosan véglegesen törlöd a(z) "${f.name}" mappát az összes benne lévő fotóval?`)) return;
    await fetch('/api/drive/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [f.id] }),
    });
    // frissítés a jelenlegi szinten
    if (path.length > 0) loadContents(path[path.length - 1].id);
  }

  const filteredStores = storeFolders.filter((f) => filter === 'all' || typeMap[f.name] === filter);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Fotók</h1>
      {!configured ? (
        <NotConfigured />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Breadcrumb path={path} onGo={goTo} />
            {path.length === 0 && (
              <div className="flex gap-1">
                {([
                  ['all', 'Mind'],
                  ['store', 'Bolt'],
                  ['trafik', 'Trafik'],
                ] as const).map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                      filter === t ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <Spinner />
          ) : path.length === 0 ? (
            filteredStores.length === 0 ? (
              <div className="card p-12 text-center text-gray-400">
                Nincs megjeleníthető mappa.
              </div>
            ) : (
              <FolderGrid folders={filteredStores} onOpen={openFolder} />
            )
          ) : (
            <div className="space-y-4">
              {folders.length > 0 && (
                <FolderGrid folders={folders} onOpen={openFolder} onDelete={deleteFolder} />
              )}
              <AdminGallery
                photos={photos}
                onChanged={() => loadContents(path[path.length - 1].id)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---- Bolt/trafik: feltöltés + saját dátum-mappák ----------------------------
function StorePhotos() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<FolderRef[]>([]);
  const [folders, setFolders] = useState<FolderRef[]>([]);
  const [photos, setPhotos] = useState<DrivePhoto[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContents = useCallback(async (id?: string) => {
    setLoading(true);
    const res = await fetch(`/api/drive/photos${id ? `?folderId=${id}` : ''}`);
    const d = await res.json();
    setConfigured(d.configured !== false);
    setFolders(d.folders ?? []);
    setPhotos(d.photos ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadContents();
  }, [loadContents]);

  function openFolder(f: FolderRef) {
    setPath([f]);
    loadContents(f.id);
  }
  function goTo(index: number) {
    if (index < 0) {
      setPath([]);
      loadContents();
    }
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    for (const f of files) {
      if (f.size > MAX_SIZE) {
        setError(`A(z) "${f.name}" túl nagy (max 25 MB).`);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const { date, time } = nowParts();
      const fd = new FormData();
      fd.append('dateFolder', date);
      let i = 0;
      for (const f of files) {
        const blob = await compressImage(f);
        const suffix = files.length > 1 ? `_${pad(i + 1)}` : '';
        fd.append('file', blob, `${date}_${time}${suffix}.jpg`);
        i++;
      }
      const res = await fetch('/api/drive/photo-upload', { method: 'POST', body: fd });
      const txt = await res.text();
      let data: { error?: string; folderId?: string; dateFolder?: string } = {};
      try {
        data = txt ? JSON.parse(txt) : {};
      } catch {
        /* nem JSON */
      }
      if (!res.ok) throw new Error(data.error || `Feltöltési hiba (${res.status})`);
      if (data.folderId && data.dateFolder) {
        setPath([{ id: data.folderId, name: data.dateFolder }]);
        loadContents(data.folderId);
      } else {
        loadContents(path[0]?.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Feltöltési hiba');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Fotók</h1>

      {!configured ? (
        <NotConfigured />
      ) : (
        <>
          <div className="card flex flex-col items-center gap-3 p-6 text-center">
            <div className="rounded-full bg-brand-50 p-3 text-brand-600">
              <ImageIcon size={28} />
            </div>
            <p className="text-sm text-gray-600">
              Töltsd fel a képeket — a mai dátumú mappádba kerülnek, időbélyeges névvel.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button onClick={() => inputRef.current?.click()} className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              {busy ? 'Feltöltés…' : 'Kép feltöltése'}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <Breadcrumb path={path} onGo={goTo} />

          {loading ? (
            <Spinner />
          ) : path.length === 0 ? (
            <div className="space-y-4">
              {folders.length > 0 && <FolderGrid folders={folders} onOpen={openFolder} />}
              {folders.length === 0 && photos.length === 0 ? (
                <div className="card p-10 text-center text-gray-400">Még nincs feltöltött fotó.</div>
              ) : (
                photos.length > 0 && <Gallery photos={photos} />
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button onClick={() => goTo(-1)} className="btn-secondary self-start">
                <ArrowLeft size={16} /> Vissza
              </button>
              <Gallery photos={photos} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
