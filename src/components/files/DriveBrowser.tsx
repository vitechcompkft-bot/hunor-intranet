'use client';

import { useCallback, useEffect, useState } from 'react';
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
} from 'lucide-react';
import { formatBytes } from '@/lib/storage';

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

function fileIcon(mime: string, name: string) {
  if (mime.startsWith('image/')) return FileImage;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (mime.includes('pdf') || mime.includes('document') || ['doc', 'docx', 'txt', 'xls', 'xlsx', 'csv'].includes(ext))
    return FileText;
  return FileIcon;
}

export function DriveBrowser() {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      // gyökér betöltésekor állítsuk be a breadcrumb kezdetét
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

  if (!configured) {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center text-gray-500">
        <CloudOff size={32} className="text-gray-300" />
        <p className="font-medium text-gray-700">A Google Drive még nincs beállítva.</p>
        <p className="max-w-md text-sm">
          A rendszergazda a service account adatait a <span className="font-mono">.env.local</span>-ba
          beírva tudja csatlakoztatni a megosztott „Intranet" mappát (lásd SETUP.md).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
    </div>
  );
}
