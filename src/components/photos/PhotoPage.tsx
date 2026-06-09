'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UploadCloud, Trash2, Download, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { STORAGE_BUCKET, userScopeNumber } from '@/lib/types';
import type { AppUser, PhotoRow } from '@/lib/types';

interface PhotoWithUrl extends PhotoRow {
  url?: string;
}

const MAX_SIZE = 10 * 1024 * 1024;

export function PhotoPage({ user }: { user: AppUser }) {
  const supabase = useMemo(() => createClient(), []);
  const isStaff = user.role === 'admin' || user.role === 'kozpont';
  const scope = userScopeNumber(user);

  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStore, setFilterStore] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false });
    const rows = (data as PhotoRow[]) ?? [];
    const paths = rows.map((r) => r.photo_url);
    const urlMap = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrls(paths, 600);
      (signed ?? []).forEach((s) => {
        if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
      });
    }
    setPhotos(rows.map((r) => ({ ...r, url: urlMap.get(r.photo_url) })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(file: File) {
    if (file.size > MAX_SIZE) {
      setError('A kép legfeljebb 10 MB lehet.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const safe = file.name.replace(/[^\w.\-]/g, '_');
      const path = `photos/${scope ?? 'kozpont'}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('photos').insert({
        store_number: user.role === 'trafik' ? null : scope ?? null,
        trafik_number: user.role === 'trafik' ? scope ?? null : null,
        photo_url: path,
        caption: caption || null,
        uploaded_by: user.id,
      });
      if (insErr) throw insErr;
      setCaption('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Feltöltési hiba');
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: PhotoWithUrl) {
    if (!confirm('Biztosan törlöd ezt a fotót?')) return;
    await supabase.storage.from(STORAGE_BUCKET).remove([p.photo_url]);
    await supabase.from('photos').delete().eq('id', p.id);
    load();
  }

  const shown = photos.filter((p) => {
    if (!filterStore) return true;
    const s = (p.store_number || p.trafik_number || '').toLowerCase();
    return s.includes(filterStore.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Fotók</h1>

      {!isStaff && (
        <div className="card space-y-3 p-6">
          <input
            className="input"
            placeholder="Felirat (opcionális)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          <button onClick={() => inputRef.current?.click()} className="btn-primary" disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />} Kép feltöltése
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {isStaff && (
        <div className="card flex items-end gap-3 p-4">
          <div>
            <label className="label">Szűrés bolt/trafik szerint</label>
            <input
              className="input w-48"
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              placeholder="pl. B001"
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">Nincs megjeleníthető fotó.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => (
            <div key={p.id} className="card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.caption ?? 'fotó'}
                className="h-40 w-full bg-gray-100 object-cover"
              />
              <div className="p-3">
                {p.caption && <p className="truncate text-sm text-gray-700">{p.caption}</p>}
                <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                  <span>{p.store_number || p.trafik_number || '—'}</span>
                  <span>{new Date(p.created_at).toLocaleDateString('hu-HU')}</span>
                </div>
                {isStaff && (
                  <div className="mt-2 flex gap-2">
                    {p.url && (
                      <a href={p.url} download target="_blank" rel="noreferrer" className="btn-secondary flex-1 py-1">
                        <Download size={14} />
                      </a>
                    )}
                    <button onClick={() => remove(p)} className="btn-danger flex-1 py-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
