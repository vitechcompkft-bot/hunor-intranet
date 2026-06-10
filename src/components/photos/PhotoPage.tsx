'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  UploadCloud,
  Loader2,
  Folder,
  ArrowLeft,
  Download,
  CloudOff,
  ImageIcon,
  ChevronRight,
  Home,
} from 'lucide-react';
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

async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.82
): Promise<Blob> {
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

// ---- Megosztott UI ----------------------------------------------------------
function Gallery({ photos }: { photos: DrivePhoto[] }) {
  if (photos.length === 0) {
    return <div className="card p-10 text-center text-gray-400">Nincs fotó ebben a mappában.</div>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((p) => {
        const src = `/api/drive/file?id=${p.id}`;
        return (
          <div key={p.id} className="card overflow-hidden">
            <a href={src} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={p.name} className="h-40 w-full bg-gray-100 object-cover" loading="lazy" />
            </a>
            <div className="flex items-center justify-between gap-2 p-2">
              <span className="truncate text-xs text-gray-600" title={p.name}>
                {p.name}
              </span>
              <a
                href={src}
                download={p.name}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <Download size={14} />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FolderGrid({ folders, onOpen }: { folders: FolderRef[]; onOpen: (f: FolderRef) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {folders.map((f) => (
        <button
          key={f.id}
          onClick={() => onOpen(f)}
          className="card flex flex-col items-center gap-2 p-5 transition hover:shadow-md"
        >
          <Folder size={32} className="text-brand-500" />
          <span className="text-sm font-medium text-gray-800">{f.name}</span>
        </button>
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

// ---- Admin: bolt-mappák -> dátum-mappák -> képek -----------------------------
function AdminPhotos() {
  const [storeFolders, setStoreFolders] = useState<FolderRef[]>([]);
  const [path, setPath] = useState<FolderRef[]>([]);
  const [folders, setFolders] = useState<FolderRef[]>([]);
  const [photos, setPhotos] = useState<DrivePhoto[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/drive/photo-folders');
      const d = await res.json();
      setConfigured(d.configured !== false);
      setStoreFolders(d.folders ?? []);
      setLoading(false);
    })();
  }, []);

  async function loadContents(id: string) {
    setLoading(true);
    const res = await fetch(`/api/drive/photos?folderId=${id}`);
    const d = await res.json();
    setFolders(d.folders ?? []);
    setPhotos(d.photos ?? []);
    setLoading(false);
  }

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Fotók</h1>
      {!configured ? (
        <NotConfigured />
      ) : (
        <>
          <Breadcrumb path={path} onGo={goTo} />
          {loading ? (
            <Spinner />
          ) : path.length === 0 ? (
            storeFolders.length === 0 ? (
              <div className="card p-12 text-center text-gray-400">
                Nincs boltszám-mappa a Drive gyökerében.
              </div>
            ) : (
              <FolderGrid folders={storeFolders} onOpen={openFolder} />
            )
          ) : (
            <div className="space-y-4">
              {folders.length > 0 && <FolderGrid folders={folders} onOpen={openFolder} />}
              <Gallery photos={photos} />
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
      // navigáljunk a mai dátum-mappába, hogy lássuk az új képet
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
