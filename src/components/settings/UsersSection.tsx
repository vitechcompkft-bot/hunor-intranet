'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, KeyRound, UserPen, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ROLE_LABELS, ROLE_BADGE } from '@/lib/auth';
import type { Role } from '@/lib/types';

interface AuthUser {
  id: string;
  email: string;
  role: Role;
  store_number: string | null;
  trafik_number: string | null;
  username: string | null;
}

export function UsersSection() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ user: AuthUser; mode: 'password' | 'username' | 'store' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('A felhasználók lekérése nem sikerült. Ellenőrizd a SUPABASE_SERVICE_ROLE_KEY-t.');
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hiba');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={load} className="btn-secondary">
          <RefreshCw size={15} /> Frissítés
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          {error}
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-10 text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-gray-400">Nincs felhasználó.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Név</th>
                <th className="px-4 py-2">Szerep</th>
                <th className="px-4 py-2">Bolt/Trafik</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{u.email}</td>
                  <td className="px-4 py-2 text-gray-600">{u.username ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${ROLE_BADGE[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{u.store_number ?? u.trafik_number ?? '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEdit({ user: u, mode: 'username' })}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title="Név módosítása"
                      >
                        <UserPen size={15} />
                      </button>
                      <button
                        onClick={() => setEdit({ user: u, mode: 'password' })}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title="Jelszó módosítása"
                      >
                        <KeyRound size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <EditUserModal
          userId={edit.user.id}
          email={edit.user.email}
          mode={edit.mode}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function EditUserModal({
  userId,
  email,
  mode,
  onClose,
  onSaved,
}: {
  userId: string;
  email: string;
  mode: 'password' | 'username' | 'store';
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titles = {
    password: 'Jelszó módosítása',
    username: 'Név módosítása',
    store: 'Bolt szám módosítása',
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action: `update_${mode}`, value }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Mentési hiba');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hiba');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={titles[mode]}>
      <p className="mb-3 text-sm text-gray-500">{email}</p>
      <input
        className="input"
        type={mode === 'password' ? 'password' : 'text'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={mode === 'password' ? 'Új jelszó' : mode === 'username' ? 'Új név' : 'Új bolt szám'}
        autoFocus
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary" disabled={busy}>
          Mégse
        </button>
        <button onClick={save} className="btn-primary" disabled={busy || !value}>
          {busy && <Loader2 size={16} className="animate-spin" />} Mentés
        </button>
      </div>
    </Modal>
  );
}
