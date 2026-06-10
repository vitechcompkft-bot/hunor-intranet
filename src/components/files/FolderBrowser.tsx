'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Folder,
  File as FileIcon,
  FileText,
  FileImage,
  ChevronRight,
  Home,
  FolderPlus,
  UploadCloud,
  Trash2,
  Pencil,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  listFolder,
  createFolder,
  deleteFile,
  deleteFolder,
  isFolderEmpty,
  renameFolder,
  joinPath,
  formatBytes,
  type StorageItem,
} from '@/lib/storage';
import { UploadModal } from './UploadModal';
import { FilePreview } from './FilePreview';
import { Modal } from '@/components/ui/Modal';
import type { AppUser } from '@/lib/types';
import { userScopeNumber } from '@/lib/types';

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return FileImage;
  if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'csv'].includes(ext)) return FileText;
  return FileIcon;
}

export function FolderBrowser({
  user,
  embedded = false,
  fill = false,
}: {
  user: AppUser;
  embedded?: boolean;
  fill?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const isStaff = user.role === 'admin' || user.role === 'kozpont';
  const root = isStaff ? '' : userScopeNumber(user) ?? '';

  const [path, setPath] = useState(root);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState<StorageItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [preview, setPreview] = useState<StorageItem | null>(null);

  // Gyors bolt-hozzáférés (staff + bekapcsolt beállítás esetén)
  const [quickAccess, setQuickAccess] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listFolder(supabase, path);
      // mappák előre, majd fájlok, ABC szerint
      data.sort((a, b) =>
        a.isFolder === b.isFolder ? a.name.localeCompare(b.name, 'hu') : a.isFolder ? -1 : 1
      );
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nem sikerült betölteni a mappát.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, path]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isStaff) return;
    (async () => {
      const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'enable_store_folder_quick_access')
        .maybeSingle();
      if (setting?.value === 'true') {
        const { data: stores } = await supabase
          .from('store_lists')
          .select('number')
          .order('sort_order');
        setQuickAccess((stores ?? []).map((s) => s.number));
      }
    })();
  }, [supabase, isStaff]);

  // Breadcrumb szegmensek (a gyökér fölé nem-staff nem mehet)
  const segments = path ? path.split('/') : [];

  function navigateToIndex(i: number) {
    setPath(segments.slice(0, i + 1).join('/'));
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(supabase, path, newFolderName.trim());
      setNewFolderName('');
      setShowNewFolder(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mappa létrehozási hiba');
    }
  }

  async function handleDelete(item: StorageItem) {
    if (item.isFolder) {
      const empty = await isFolderEmpty(supabase, item.path);
      if (!empty) {
        alert('Csak üres mappa törölhető.');
        return;
      }
      if (!confirm(`Biztosan törlöd a(z) "${item.name}" mappát?`)) return;
      await deleteFolder(supabase, item.path);
    } else {
      if (!confirm(`Biztosan törlöd a(z) "${item.name}" fájlt?`)) return;
      await deleteFile(supabase, item.path);
    }
    load();
  }

  async function handleRename() {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await renameFolder(supabase, renameTarget.path, renameValue.trim());
      setRenameTarget(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Átnevezési hiba');
    }
  }

  return (
    <div className={fill ? 'flex h-full min-h-0 flex-col gap-4' : 'space-y-4'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!embedded && <h1 className="text-2xl font-bold text-gray-900">Fájlok</h1>}
        <div className="flex flex-wrap gap-2 ml-auto">
          <button onClick={load} className="btn-secondary" title="Frissítés">
            <RefreshCw size={16} />
          </button>
          {isStaff && (
            <button onClick={() => setShowNewFolder(true)} className="btn-secondary">
              <FolderPlus size={16} /> <span className="hidden sm:inline">Új mappa</span>
            </button>
          )}
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            <UploadCloud size={16} /> <span className="hidden sm:inline">Feltöltés</span>
          </button>
        </div>
      </div>

      {/* Gyors bolt-hozzáférés */}
      {quickAccess.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickAccess.map((n) => (
            <button
              key={n}
              onClick={() => setPath(n)}
              className="badge bg-brand-100 text-brand-700 hover:bg-brand-200"
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
        <button
          onClick={() => setPath(root)}
          className="flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-100 hover:text-gray-900"
        >
          <Home size={14} /> {isStaff ? 'Főmappa' : root}
        </button>
        {segments.map((seg, i) => {
          // nem-staff a saját gyökere alatt navigál, a gyökér szegmenst a Home gomb adja
          if (!isStaff && i === 0) return null;
          return (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={14} className="text-gray-300" />
              <button
                onClick={() => navigateToIndex(i)}
                className="rounded px-2 py-1 hover:bg-gray-100 hover:text-gray-900"
              >
                {seg}
              </button>
            </span>
          );
        })}
      </div>

      {/* Lista */}
      <div className={fill ? 'card min-h-0 flex-1 overflow-y-auto' : 'card overflow-hidden'}>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Ez a mappa üres.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => {
              const Icon = item.isFolder ? Folder : fileIcon(item.name);
              return (
                <li
                  key={item.path}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50"
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => (item.isFolder ? setPath(item.path) : setPreview(item))}
                  >
                    <Icon
                      size={20}
                      className={item.isFolder ? 'text-brand-500' : 'text-gray-400'}
                    />
                    <span className="truncate text-sm text-gray-800">{item.name}</span>
                  </button>
                  {!item.isFolder && (
                    <span className="hidden text-xs text-gray-400 sm:inline">
                      {formatBytes(item.size)}
                    </span>
                  )}
                  {isStaff && (
                    <div className="flex items-center gap-1">
                      {item.isFolder && (
                        <button
                          onClick={() => {
                            setRenameTarget(item);
                            setRenameValue(item.name);
                          }}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Átnevezés"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Törlés"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        path={path}
        onUploaded={load}
        staff={isStaff}
      />

      <FilePreview item={preview} open={!!preview} onClose={() => setPreview(null)} />

      <Modal open={showNewFolder} onClose={() => setShowNewFolder(false)} title="Új mappa">
        <input
          autoFocus
          className="input"
          placeholder="Mappa neve"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
        />
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setShowNewFolder(false)} className="btn-secondary">
            Mégse
          </button>
          <button onClick={handleCreateFolder} className="btn-primary">
            Létrehozás
          </button>
        </div>
      </Modal>

      <Modal
        open={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title="Mappa átnevezése"
      >
        <input
          autoFocus
          className="input"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
        />
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setRenameTarget(null)} className="btn-secondary">
            Mégse
          </button>
          <button onClick={handleRename} className="btn-primary">
            Átnevezés
          </button>
        </div>
      </Modal>
    </div>
  );
}
