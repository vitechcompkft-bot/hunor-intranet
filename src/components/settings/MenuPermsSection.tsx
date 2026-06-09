'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { STORE_MENU_LABELS } from '@/lib/menu-labels';

type Role = 'viewer' | 'kozpont' | 'trafik';
const TABLES: Record<Role, string> = {
  viewer: 'viewer_menu_permissions',
  kozpont: 'kozpont_menu_permissions',
  trafik: 'trafik_menu_permissions',
};
const ROLE_LABEL: Record<Role, string> = { viewer: 'Bolt (viewer)', kozpont: 'Központ', trafik: 'Trafik' };

interface Perm {
  id: string;
  menu_key: string;
  is_enabled: boolean;
}

export function MenuPermsSection() {
  const supabase = useMemo(() => createClient(), []);
  const [role, setRole] = useState<Role>('viewer');
  const [perms, setPerms] = useState<Perm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from(TABLES[role])
      .select('id,menu_key,is_enabled')
      .then(({ data }) => {
        setPerms((data as Perm[]) ?? []);
        setLoading(false);
      });
  }, [supabase, role]);

  async function toggle(p: Perm) {
    const next = !p.is_enabled;
    setPerms((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_enabled: next } : x)));
    await supabase.from(TABLES[role]).update({ is_enabled: next }).eq('id', p.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              role === r ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>

      <div className="card p-4">
        {loading ? (
          <div className="flex justify-center py-8 text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : perms.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Nincs beállítható menüpont.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {perms.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-700">{STORE_MENU_LABELS[p.menu_key] ?? p.menu_key}</span>
                <button
                  onClick={() => toggle(p)}
                  className={`relative h-6 w-11 rounded-full transition ${p.is_enabled ? 'bg-brand-500' : 'bg-gray-300'}`}
                  role="switch"
                  aria-checked={p.is_enabled}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      p.is_enabled ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
