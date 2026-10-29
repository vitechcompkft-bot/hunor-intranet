'use client';

import { useState } from 'react';
import { Loader2, Paperclip } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { STORAGE_BUCKET, BUG_NAMES, userScopeNumber } from '@/lib/types';
import type { AppUser, BugReport } from '@/lib/types';

const PRIORITIES = [
  { key: 'kritikus', label: 'Kritikus' },
  { key: 'magas', label: 'Magas' },
  { key: 'kozepes', label: 'Közepes' },
  { key: 'alacsony', label: 'Alacsony' },
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

function roleWord(role: string): string {
  if (role === 'trafik') return 'trafik';
  if (role === 'viewer') return 'bolt';
  if (role === 'kozpont') return 'központ';
  return 'admin';
}

/** Supabase/hálózati hiba → ember által olvasható üzenet + újrapróbálható-e. */
function describeError(e: unknown): { msg: string; retriable: boolean } {
  const raw =
    (typeof e === 'object' && e !== null && 'message' in e
      ? String((e as { message: unknown }).message)
      : e instanceof Error
        ? e.message
        : String(e ?? '')) || '';
  const low = raw.toLowerCase();
  // Lejárt / érvénytelen munkamenet (pl. egész éjszakára nyitva hagyott felület)
  const authExpired =
    low.includes('jwt') ||
    low.includes('expired') ||
    low.includes('unauthorized') ||
    low.includes('not authenticated') ||
    low.includes('refresh token') ||
    low.includes('invalid token') ||
    low.includes('401');
  if (authExpired) {
    return {
      msg: 'A munkamenet lejárt (valószínűleg régóta nyitva volt a felület). Lépj ki (Kilépés jobbra fent), majd jelentkezz be újra, és küldd be a hibajegyet ismét.',
      retriable: false,
    };
  }
  const networkish =
    raw === '' ||
    low.includes('failed to fetch') ||
    low.includes('load failed') ||
    low.includes('networkerror') ||
    low.includes('network request') ||
    low.includes('fetch') ||
    low.includes('timeout') ||
    low.includes('nem elérhető') ||
    low.includes('502') ||
    low.includes('503') ||
    low.includes('504');
  if (networkish) {
    return {
      msg: 'Hálózati/kapcsolati hiba — a mentés most nem jutott el a szerverhez. Ellenőrizd a VPN/internet kapcsolatot, és próbáld újra a Beküldést.',
      retriable: true,
    };
  }
  return { msg: raw ? `Mentési hiba: ${raw}` : 'Ismeretlen mentési hiba.', retriable: false };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Egy Supabase-műveletet futtat, és átmeneti (hálózati) hiba esetén
 * újrapróbál — a bolti VPN/WAN pillanatnyi kimaradásai miatt. Nem átmeneti
 * hibát (pl. jogosultság) azonnal továbbdob.
 */
async function runWithRetry(fn: () => Promise<{ error: unknown }>, tries = 3): Promise<void> {
  let last: unknown = null;
  for (let i = 0; i < tries; i++) {
    let res: { error: unknown };
    try {
      res = await fn();
    } catch (e) {
      res = { error: e };
    }
    if (!res.error) return;
    last = res.error;
    if (!describeError(res.error).retriable) throw res.error;
    if (i < tries - 1) await sleep(600 * (i + 1));
  }
  throw last;
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
  const [priority, setPriority] = useState<string>('kozepes');
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
        await runWithRetry(async () => {
          const { error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(target, file, { upsert: true, contentType: file.type || undefined });
          return { error };
        });
        attachmentPath = target;
      }

      await runWithRetry(async () => {
        const { error } = await supabase.from('bug_reports').insert({
          store_number: storeNumber || null,
          bug_name: bugName,
          bug_description: description.trim(),
          attachment_path: attachmentPath,
          reported_by: user.id,
        } satisfies Partial<BugReport> & { reported_by: string });
        return { error };
      });

      // Beküldő (szerep + bolt/trafik szám) és időpont összeállítása
      const numLabel = user.role === 'trafik' ? 'Trafik' : 'Bolt';
      const num = storeNumber.trim();
      const bekuldo = num ? `${roleWord(user.role)} (${numLabel}: ${num})` : roleWord(user.role);
      const d = new Date();
      const idopont = `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

      // Telegram értesítés (best effort — hiba nem blokkol)
      fetch('/api/telegram/notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cim: bugName,
          prioritas: priority,
          bekuldo,
          idopont,
          melleklet: file ? 'Igen' : 'Nem',
          leiras: description.trim(),
        }),
      }).catch(() => {});

      onSaved();
    } catch (err) {
      setError(describeError(err).msg);
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

      <div>
        <label className="label">Prioritás</label>
        <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIORITIES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
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
