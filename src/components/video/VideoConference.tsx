'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Video, LogIn, LogOut, Plus, Trash2, Loader2, Users, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { userScopeNumber } from '@/lib/types';
import type { AppUser } from '@/lib/types';

interface Room {
  id: string;
  name: string;
  room_key: string;
}
interface StoreOpt {
  number: string;
  label: string | null;
  type: 'store' | 'trafik';
}

/** Kitalálhatatlan Jitsi szoba-azonosító a névből + véletlen utótag. */
function makeRoomKey(name: string): string {
  const slug =
    name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'szoba';
  const rand = Math.random().toString(36).slice(2, 10);
  return `HUNOR-${slug}-${rand}`;
}

export function VideoConference({ user }: { user: AppUser }) {
  const supabase = useMemo(() => createClient(), []);
  const isAdmin = user.role === 'admin';
  const isStaff = user.role === 'admin' || user.role === 'kozpont';
  const scope = userScopeNumber(user) ?? '';

  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignMap, setAssignMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Room | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    if (isStaff) {
      // Admin/központ: minden szoba
      const { data } = await supabase
        .from('video_rooms')
        .select('id,name,room_key')
        .order('created_at', { ascending: false });
      const list = (data as Room[]) ?? [];
      setRooms(list);
      if (isAdmin && list.length > 0) {
        const { data: a } = await supabase
          .from('video_room_assignments')
          .select('room_id,store_number');
        const map: Record<string, string[]> = {};
        for (const row of (a ?? []) as { room_id: string; store_number: string }[]) {
          (map[row.room_id] ??= []).push(row.store_number);
        }
        setAssignMap(map);
      }
    } else {
      // Bolt/trafik: CSAK a neki kiosztott szobák
      if (!scope) {
        setRooms([]);
        setLoading(false);
        return;
      }
      const { data: a } = await supabase
        .from('video_room_assignments')
        .select('room_id')
        .eq('store_number', scope);
      const ids = (a ?? []).map((x) => x.room_id);
      if (ids.length === 0) {
        setRooms([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('video_rooms')
        .select('id,name,room_key')
        .in('id', ids)
        .order('created_at', { ascending: false });
      setRooms((data as Room[]) ?? []);
    }
    setLoading(false);
  }, [supabase, isStaff, isAdmin, scope]);

  useEffect(() => {
    load();
  }, [load]);

  // ===== Aktív hívás =====
  if (active) {
    return <ActiveCall room={active} onLeave={() => setActive(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Videó konferencia</h1>
      </div>

      {isAdmin && <AdminCreate supabase={supabase} user={user} onCreated={load} />}

      {loading ? (
        <div className="card flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          {isStaff
            ? 'Még nincs videokonferencia-szoba. Hozz létre egyet fent.'
            : 'Jelenleg nincs számodra elérhető videokonferencia-szoba.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => (
            <div key={r.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-brand-50 p-2 text-brand-600">
                  <Video size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-800">{r.name}</p>
                  {isAdmin && (
                    <p className="truncate text-xs text-gray-400">
                      {(assignMap[r.id]?.length ?? 0)} résztvevő kiosztva
                      {assignMap[r.id]?.length ? `: ${assignMap[r.id].join(', ')}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setActive(r)} className="btn-primary flex-1">
                  <LogIn size={16} /> Csatlakozás
                </button>
                {isAdmin && <DeleteRoom supabase={supabase} room={r} onDeleted={load} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Admin: új szoba létrehozása + résztvevők (bolt/trafik) kiosztása
// ============================================================================
function AdminCreate({
  supabase,
  user,
  onCreated,
}: {
  supabase: ReturnType<typeof createClient>;
  user: AppUser;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [opts, setOpts] = useState<StoreOpt[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('store_lists')
      .select('number,label,type')
      .order('sort_order')
      .then(({ data }) => setOpts((data as StoreOpt[]) ?? []));
  }, [supabase]);

  const stores = opts.filter((o) => o.type === 'store');
  const trafiks = opts.filter((o) => o.type === 'trafik');

  function toggle(n: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  function reset() {
    setName('');
    setSelected(new Set());
    setError(null);
    setOpen(false);
  }

  async function save() {
    if (!name.trim()) {
      setError('Adj nevet a szobának.');
      return;
    }
    if (selected.size === 0) {
      setError('Válassz ki legalább egy boltot vagy trafikot.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data: room, error: e1 } = await supabase
        .from('video_rooms')
        .insert({ name: name.trim(), room_key: makeRoomKey(name), created_by: user.id })
        .select('id')
        .single();
      if (e1 || !room) throw e1 ?? new Error('Mentési hiba');

      const assignments = Array.from(selected).map((store_number) => ({
        room_id: room.id,
        store_number,
      }));
      const { error: e2 } = await supabase.from('video_room_assignments').insert(assignments);
      if (e2) throw e2;

      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mentési hiba');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={16} /> Új szoba
      </button>
    );
  }

  return (
    <div className="card space-y-4 p-6">
      <div className="flex items-center justify-between">
        <p className="font-medium text-gray-800">Új videokonferencia-szoba</p>
        <button onClick={reset} className="text-gray-400 hover:text-gray-600" aria-label="Bezárás">
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="label">Szoba neve</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="pl. Heti értekezlet"
        />
      </div>

      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
          <Users size={16} /> Kik láthatják? ({selected.size} kiválasztva)
        </p>

        {stores.length > 0 && (
          <>
            <p className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Boltok
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stores.map((s) => (
                <label key={s.number} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(s.number)}
                    onChange={() => toggle(s.number)}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  {s.number}
                </label>
              ))}
            </div>
          </>
        )}

        {trafiks.length > 0 && (
          <>
            <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Trafikok
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {trafiks.map((t) => (
                <label key={t.number} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(t.number)}
                    onChange={() => toggle(t.number)}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  {t.number}
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={reset} className="btn-secondary" disabled={busy}>
          Mégse
        </button>
        <button onClick={save} className="btn-primary" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Létrehozás
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Admin: szoba törlése
// ============================================================================
function DeleteRoom({
  supabase,
  room,
  onDeleted,
}: {
  supabase: ReturnType<typeof createClient>;
  room: Room;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function del() {
    if (!confirm(`Biztosan törlöd a(z) "${room.name}" szobát?`)) return;
    setBusy(true);
    // a hozzárendelések ON DELETE CASCADE miatt maguktól törlődnek
    await supabase.from('video_rooms').delete().eq('id', room.id);
    setBusy(false);
    onDeleted();
  }
  return (
    <button onClick={del} className="btn-danger" disabled={busy} title="Szoba törlése">
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
    </button>
  );
}

// ============================================================================
// Aktív hívás: 8x8 JaaS beágyazás moderátor-tokennel (nincs "várakozás a hostra").
// Ha a JaaS kulcsok nincsenek beállítva, visszaesés a nyilvános meet.jit.si-re.
// ============================================================================
declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: Record<string, unknown>
    ) => { addEventListener: (event: string, cb: () => void) => void; dispose: () => void };
  }
}

const scriptPromises: Record<string, Promise<void>> = {};
function loadScript(src: string): Promise<void> {
  if (typeof window !== 'undefined' && window.JitsiMeetExternalAPI) return Promise.resolve();
  if (src in scriptPromises) return scriptPromises[src];
  scriptPromises[src] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('A videó modul betöltése nem sikerült.'));
    document.body.appendChild(s);
  });
  return scriptPromises[src];
}

function ActiveCall({ room, onLeave }: { room: Room; onLeave: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{
    addEventListener: (event: string, cb: () => void) => void;
    dispose: () => void;
  } | null>(null);
  const [mode, setMode] = useState<'loading' | 'jaas' | 'fallback' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/video/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomKey: room.room_key }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Csatlakozási hiba');
        if (cancelled) return;

        if (!data.configured) {
          setMode('fallback');
          return;
        }

        await loadScript(`https://8x8.vc/${data.appId}/external_api.js`);
        if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return;

        apiRef.current = new window.JitsiMeetExternalAPI('8x8.vc', {
          roomName: `${data.appId}/${room.room_key}`,
          jwt: data.token,
          parentNode: containerRef.current,
          // Előnézet ("Join meeting") kihagyása → egyből a hívásba lép.
          // (Régi és új Jitsi-kulcs is, hogy verziótól függetlenül működjön.)
          configOverwrite: {
            prejoinPageEnabled: false,
            prejoinConfig: { enabled: false },
          },
        });
        apiRef.current.addEventListener('readyToClose', onLeave);
        setMode('jaas');
      } catch (e) {
        if (cancelled) return;
        setErrMsg(e instanceof Error ? e.message : 'Hiba');
        setMode('error');
      }
    })();
    return () => {
      cancelled = true;
      try {
        apiRef.current?.dispose();
      } catch {
        /* noop */
      }
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.room_key]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="badge bg-brand-100 text-brand-700">Szoba: {room.name}</span>
        <button
          onClick={() => {
            try {
              apiRef.current?.dispose();
            } catch {
              /* noop */
            }
            onLeave();
          }}
          className="btn-danger"
        >
          <LogOut size={16} /> Kilépés
        </button>
      </div>

      {mode === 'fallback' ? (
        <div className="card overflow-hidden">
          <iframe
            src={`https://meet.jit.si/${encodeURIComponent(room.room_key)}`}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="h-[70vh] w-full border-0"
            title="Videó konferencia"
          />
        </div>
      ) : (
        <div className="card relative overflow-hidden">
          <div ref={containerRef} className="h-[70vh] w-full" />
          {mode === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-gray-400">
              <Loader2 className="animate-spin" />
            </div>
          )}
          {mode === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-600">
              {errMsg ?? 'Nem sikerült csatlakozni a híváshoz.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
