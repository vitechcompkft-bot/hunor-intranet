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
} from 'lucide-react';
import type { AppUser } from '@/lib/types';

interface DrivePhoto {
  id: string;
  name: string;
  modifiedTime?: string;
}
interface DriveFolder {
  id: string;
  name: string;
}

const MAX_SIZE = 25 * 1024 * 1024;

/** Kép betöltése HTMLImageElement-be (FF93-kompatibilis). */
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

/**
 * Kliensoldali tömörítés: átméretezés max 1600px-re + JPEG, hogy a feltöltés
 * jóval a Vercel 4,5 MB-os kérés-limitje alatt maradjon (és gyors legyen VPN-en).
 */
async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.82
): Promise<{ blob: Blob; name: string }> {
  try {
    if (!file.type.startsWith('image/')) return { blob: file, name: file.name };
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
    if (!ctx) return { blob: file, name: file.name };
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), 'image/jpeg', quality)
    );
    if (!blob) return { blob: file, name: file.name };
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return { blob, name };
  } catch {
    return { blob: file, name: file.name };
  }
}

export function PhotoPage({ user }: { user: AppUser }) {
  const isStaff = user.role === 'admin' || user.role === 'kozpont';
  return isStaff ? <AdminPhotos /> : <StorePhotos />;
}

/** Közös galéria rács */
function Gallery({ photos }: { photos: DrivePhoto[] }) {
  if (photos.length === 0) {
    return <div className="card p-12 text-center text-gray-400">Nincs feltöltött fotó.</div>;
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

function NotConfigured() {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center text-gray-500">
      <CloudOff size={32} className="text-gray-300" />
      <p className="font-medium text-gray-700">A Google Drive még nincs csatlakoztatva.</p>
      <p className="text-sm">Az admin a Beállítások → Google Drive fülön tudja csatlakoztatni.</p>
    </div>
  );
}

/** Admin: boltszám-mappák → galéria */
function AdminPhotos() {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DriveFolder | null>(null);
  const [photos, setPhotos] = useState<DrivePhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/drive/photo-folders');
      const data = await res.json();
      setConfigured(data.configured !== false);
      setFolders(data.folders ?? []);
      setLoading(false);
    })();
  }, []);

  async function openFolder(f: DriveFolder) {
    setSelected(f);
    setLoadingPhotos(true);
    const res = await fetch(`/api/drive/photos?folderId=${f.id}`);
    const data = await res.json();
    setPhotos(data.photos ?? []);
    setLoadingPhotos(false);
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!configured) return <div className="space-y-4"><h1 className="text-2xl font-bold text-gray-900">Fotók</h1><NotConfigured /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {selected && (
          <button onClick={() => setSelected(null)} className="btn-secondary">
            <ArrowLeft size={16} />
          </button>
        )}
        <h1 className="text-2xl font-bold text-gray-900">
          Fotók{selected ? ` — ${selected.name}` : ''}
        </h1>
      </div>

      {!selected ? (
        folders.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">
            Nincs boltszám-mappa a Drive gyökerében.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {folders.map((f) => (
              <button
                key={f.id}
                onClick={() => openFolder(f)}
                className="card flex flex-col items-center gap-2 p-5 transition hover:shadow-md"
              >
                <Folder size={32} className="text-brand-500" />
                <span className="text-sm font-medium text-gray-800">{f.name}</span>
              </button>
            ))}
          </div>
        )
      ) : loadingPhotos ? (
        <div className="card flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <Gallery photos={photos} />
      )}
    </div>
  );
}

/** Bolt/trafik: feltöltés a saját mappába + saját galéria */
function StorePhotos() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<DrivePhoto[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/drive/photos');
    const data = await res.json();
    setConfigured(data.configured !== false);
    setPhotos(data.photos ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    for (const f of files) {
      if (f.size > MAX_SIZE) {
        setError(`A(z) "${f.name}" túl nagy (max 15 MB).`);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const f of files) {
        const { blob, name } = await compressImage(f);
        fd.append('file', blob, name);
      }
      const res = await fetch('/api/drive/photo-upload', { method: 'POST', body: fd });
      // Robusztus: a választ előbb szövegként olvassuk, csak utána próbáljuk JSON-ként
      const txt = await res.text();
      let data: { error?: string } = {};
      try {
        data = txt ? JSON.parse(txt) : {};
      } catch {
        /* nem JSON válasz */
      }
      if (!res.ok) {
        throw new Error(data.error || `Feltöltési hiba (${res.status})`);
      }
      load();
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
            <p className="text-sm text-gray-600">Töltsd fel a képeket a saját mappádba.</p>
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

          {loading ? (
            <div className="card flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <Gallery photos={photos} />
          )}
        </>
      )}
    </div>
  );
}
