'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Folder,
  File as FileIcon,
  FileText,
  FileImage,
  ChevronRight,
  Home,
  Loader2,
  RefreshCw,
  ExternalLink,
  CloudOff,
  FolderPlus,
  UploadCloud,
} from 'lucide-react';
import { formatBytes } from '@/lib/storage';
import { Modal } from '@/components/ui/Modal';

interface DriveItem {
  id: string;
  name: string;
  isFolder: boolean;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
}

interface Crumb {
  id: string;
  name: string;
}

const MAX_FILE = 4.3 * 1024 * 1024; // Vercel ~4,5 MB kérés-limit miatt

function fileIcon(mime: string, name: string) {
  if (mime.startsWith('image/')) return FileImage;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (mime.includes('pdf') || mime.includes('document') || ['doc', 'docx', 'txt', 'xls', 'xlsx', 'csv'].includes(ext))
    return FileText;
  return FileIcon;
}

export function DriveBrowser({ canManage = false }: { canManage?: boolean }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const currentId = crumbs.length ? crumbs[crumbs.length - 1].id : null;

  const load = useCallback(async (folderId: string | null, resetCrumbs?: Crumb[]) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/drive/list${folderId ? `?folderId=${folderId}` : ''}`);
      const data = await res.json();
      setConfigured(data.configured !== false);
      if (data.error) setError(data.error);
      setItems(data.items ?? []);
      if (!folderId && data.folderId) {
        setCrumbs([{ id: data.folderId, name: data.folderName || 'Intranet' }]);
      } else if (resetCrumbs) {
        setCrumbs(resetCrumbs);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Betöltési hiba');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(null);
  }, [load]);

  function openFolder(item: DriveItem) {
    const next = [...crumbs, { id: item.id, name: item.name }];
    setCrumbs(next);
    load(item.id, next);
  }

  function goToCrumb(i: number) {
    const next = crumbs.slice(0, i + 1);
    setCrumbs(next);
    load(next[next.length - 1].id, next);
  }

  function openFile(item: DriveItem) {
    window.open(`/api/drive/file?id=${item.id}`, '_blank', 'noopener');
  }

  async function createFolder() {
    if (!newFolderName.trim() || !currentId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/drive/folder-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: currentId, name: newFolderName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mappa létrehozási hiba');
      setShowNewFolder(false);
      setNewFolderName('');
      load(currentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hiba');
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !currentId) return;
    const files = Array.from(fileList);
    const tooBig = files.find((f) => f.size > MAX_FILE);
    if (tooBig) {
      setError(`A(z) "${tooBig.name}" túl nagy. Egy fájl max ~4 MB lehet.`);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // fájlonként külön kérés (a kérés-méretlimit miatt)
      for (const f of files) {
        const fd = new FormData();
        fd.append('folderId', currentId);
        fd.append('file', f);
        const res = await fetch('/api/drive/upload', { method: 'POST', body: fd });
        const txt = await res.text();
        let data: { error?: string } = {};
        try {
          data = txt ? JSON.parse(txt) : {};
        } catch {
          /* nem JSON */
        }
        if (!res.ok) throw new Error(data.error || `Feltöltési hiba (${res.status})`);
      }
      load(currentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Feltöltési hiba');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (!configured) {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center text-gray-500">
        <CloudOff size={32} className="text-gray-300" />
        <p className="font-medium text-gray-700">A Google Drive még nincs csatlakoztatva.</p>
        <p className="max-w-md text-sm">
          Az admin a Beállítások → Google Drive fülön tudja csatlakoztatni a megosztott „Intranet" mappát.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Eszköztár (staff): mappa + feltöltés */}
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowNewFolder(true)}
            className="btn-secondary"
            disabled={!currentId || busy}
          >
            <FolderPlus size={16} /> Új mappa
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-primary"
            disabled={!currentId || busy}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            Feltöltés
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <span className="text-xs text-gray-400">ide: {crumbs[crumbs.length - 1]?.name ?? 'Intranet'}</span>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
        <button
          onClick={() => load(null)}
          className="flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-100 hover:text-gray-900"
        >
          <Home size={14} /> Intranet
        </button>
        {crumbs.slice(1).map((c, i) => (
          <span key={c.id} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-gray-300" />
            <button
              onClick={() => goToCrumb(i + 1)}
              className="rounded px-2 py-1 hover:bg-gray-100 hover:text-gray-900"
            >
              {c.name}
            </button>
          </span>
        ))}
        <button
          onClick={() => load(currentId)}
          className="ml-auto rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          title="Frissítés"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2.5 text-sm text-yellow-800">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : items.length === 0 && !error ? (
          <div className="p-12 text-center text-gray-400">Ez a mappa üres.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => {
              const Icon = item.isFolder ? Folder : fileIcon(item.mimeType, item.name);
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => (item.isFolder ? openFolder(item) : openFile(item))}
                  >
                    <Icon size={20} className={item.isFolder ? 'text-brand-500' : 'text-gray-400'} />
                    <span className="truncate text-sm text-gray-800">{item.name}</span>
                  </button>
                  {!item.isFolder && (
                    <>
                      <span className="hidden text-xs text-gray-400 sm:inline">
                        {formatBytes(item.size)}
                      </span>
                      <button
                        onClick={() => openFile(item)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title="Megnyitás / letöltés"
                      >
                        <ExternalLink size={15} />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal open={showNewFolder} onClose={() => setShowNewFolder(false)} title="Új mappa">
        <input
          autoFocus
          className="input"
          placeholder="Mappa neve"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createFolder()}
        />
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setShowNewFolder(false)} className="btn-secondary" disabled={busy}>
            Mégse
          </button>
          <button onClick={createFolder} className="btn-primary" disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />} Létrehozás
          </button>
        </div>
      </Modal>
    </div>
  );
}
