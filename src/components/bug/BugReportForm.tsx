'use client';

import { useState } from 'react';
import { Loader2, Paperclip } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { STORAGE_BUCKET, BUG_NAMES, userScopeNumber } from '@/lib/types';
import type { AppUser, BugReport } from '@/lib/types';

function priorityFor(bugName: string): 'URGENT' | 'HIGH' | 'NORMAL' {
  if (bugName === 'VPN zárolás') return 'URGENT';
  if (bugName === 'Egyéb') return 'NORMAL';
  return 'HIGH';
}

export function BugReportForm({
  user,
  onSaved,
  onCancel,
}: {
  user: AppUser;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const isStaff = user.role === 'admin' || user.role === 'kozpont';

  const [bugName, setBugName] = useState<string>(BUG_NAMES[0]);
  const [description, setDescription] = useState('');
  const [storeNumber, setStoreNumber] = useState(userScopeNumber(user) ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError('A hiba leírása kötelező.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let attachmentPath: string | null = null;
      if (file) {
        const safe = file.name.replace(/[^\w.\-]/g, '_');
        const target = `bug-reports/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(target, file, { upsert: true, contentType: file.type || undefined });
        if (upErr) throw upErr;
        attachmentPath = target;
      }

      const { error: insErr } = await supabase.from('bug_reports').insert({
        store_number: storeNumber || null,
        bug_name: bugName,
        bug_description: description.trim(),
        attachment_path: attachmentPath,
        reported_by: user.id,
      } satisfies Partial<BugReport> & { reported_by: string });
      if (insErr) throw insErr;

      // Telegram értesítés (best effort — hiba nem blokkol)
      fetch('/api/telegram/notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bug_name: bugName,
          store_number: storeNumber,
          description: description.trim(),
          priority: priorityFor(bugName),
        }),
      }).catch(() => {});

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mentési hiba');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Hiba típusa</label>
        <select className="input" value={bugName} onChange={(e) => setBugName(e.target.value)}>
          {BUG_NAMES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {isStaff && (
        <div>
          <label className="label">Bolt / trafik szám</label>
          <input
            className="input"
            value={storeNumber}
            onChange={(e) => setStoreNumber(e.target.value)}
            placeholder="pl. B001"
          />
        </div>
      )}

      <div>
        <label className="label">Hiba részletes leírása</label>
        <textarea
          className="input min-h-[120px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Írd le, mi a probléma…"
        />
      </div>

      <div>
        <label className="label">Csatolmány (opcionális)</label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-brand-400">
          <Paperclip size={16} />
          {file ? file.name : 'Fájl kiválasztása…'}
          <input
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
          Mégse
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy && <Loader2 size={16} className="animate-spin" />} Beküldés
        </button>
      </div>
    </form>
  );
}
