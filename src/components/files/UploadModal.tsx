'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { UploadCloud, File as FileIcon, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { uploadFile, formatBytes } from '@/lib/storage';

interface TargetOption {
  number: string;
  label: string | null;
  type: 'store' | 'trafik';
}

export function UploadModal({
  open,
  onClose,
  path,
  onUploaded,
  staff = false,
}: {
  open: boolean;
  onClose: () => void;
  path: string;
  onUploaded: () => void;
  /** Staff (admin/központ): kiválaszthatja, mely boltokba/trafikokba töltsön */
  staff?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Célmappa-választás (staff)
  const [targets, setTargets] = useState<TargetOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!staff || !open) return;
    supabase
      .from('store_lists')
      .select('number,label,type')
      .order('type')
      .order('sort_order')
      .then(({ data }) => setTargets((data as TargetOption[]) ?? []));
  }, [staff, open, supabase]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  function toggleTarget(n: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  async function handleUpload() {
    if (files.length === 0) return;

    // Ha staff és választott célokat → azokba a mappákba; egyébként a jelenlegi mappába
    const destinations = staff && selected.size > 0 ? Array.from(selected) : [path];

    setBusy(true);
    setError(null);
    setDone(0);
    setTotal(files.length * destinations.length);
    try {
      for (const dest of destinations) {
        for (const file of files) {
          await uploadFile(supabase, dest, file);
          setDone((d) => d + 1);
        }
      }
      onUploaded();
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Feltöltési hiba');
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    setFiles([]);
    setDone(0);
    setTotal(0);
    setError(null);
    setSelected(new Set());
    onClose();
  }

  const progress = total ? Math.round((done / total) * 100) : 0;
  const stores = targets.filter((t) => t.type === 'store');
  const trafiks = targets.filter((t) => t.type === 'trafik');

  return (
    <Modal open={open} onClose={handleClose} title="Fájl feltöltése">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition ${
          dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-400'
        }`}
      >
        <UploadCloud size={32} className="mb-2 text-gray-400" />
        <p className="text-sm text-gray-600">Húzd ide a fájlokat, vagy kattints a tallózáshoz</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-4 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
              <FileIcon size={16} className="text-gray-400" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-gray-400">{formatBytes(f.size)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Célmappa-választó (staff) */}
      {staff && (
        <div className="mt-4 rounded-lg border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Hova töltsem fel? {selected.size > 0 && `(${selected.size} kiválasztva)`}
            </span>
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Set())} className="text-xs text-brand-600 hover:underline">
                Törlés
              </button>
            )}
          </div>
          <p className="mb-2 text-xs text-gray-400">
            {selected.size === 0
              ? `Ha nem választasz, a jelenlegi mappába tölt: /${path || '(főmappa)'}`
              : 'A fájlok a kiválasztott boltok/trafikok mappáiba kerülnek.'}
          </p>

          {stores.length > 0 && (
            <>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-gray-400">Boltok</span>
                <button
                  onClick={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      const allSel = stores.every((s) => next.has(s.number));
                      stores.forEach((s) => (allSel ? next.delete(s.number) : next.add(s.number)));
                      return next;
                    })
                  }
                  className="text-xs text-brand-600 hover:underline"
                >
                  Mind
                </button>
              </div>
              <div className="mb-2 grid grid-cols-3 gap-1 sm:grid-cols-4">
                {stores.map((t) => (
                  <label key={t.number} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(t.number)}
                      onChange={() => toggleTarget(t.number)}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    {t.number}
                  </label>
                ))}
              </div>
            </>
          )}

          {trafiks.length > 0 && (
            <>
              <span className="mb-1 block text-xs font-semibold uppercase text-gray-400">Trafikok</span>
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
                {trafiks.map((t) => (
                  <label key={t.number} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(t.number)}
                      onChange={() => toggleTarget(t.number)}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    {t.number}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {busy && (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {done} / {total} feltöltve
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex justify-end gap-2">
        <button onClick={handleClose} className="btn-secondary" disabled={busy}>
          Mégse
        </button>
        <button onClick={handleUpload} className="btn-primary" disabled={busy || files.length === 0}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          Feltöltés
        </button>
      </div>
    </Modal>
  );
}
