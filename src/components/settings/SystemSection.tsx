'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function SystemSection() {
  const supabase = useMemo(() => createClient(), []);
  const [quickAccess, setQuickAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'enable_store_folder_quick_access')
      .maybeSingle()
      .then(({ data }) => {
        setQuickAccess(data?.value === 'true');
        setLoading(false);
      });
  }, [supabase]);

  async function toggle() {
    const next = !quickAccess;
    setQuickAccess(next);
    await supabase
      .from('system_settings')
      .upsert(
        { key: 'enable_store_folder_quick_access', value: String(next), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
  }

  return (
    <div className="card p-6">
      {loading ? (
        <p className="text-sm text-gray-400">Betöltés…</p>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-800">Bolt mappa gyors hozzáférés</p>
            <p className="text-sm text-gray-500">
              A fájlböngésző tetején gombokként jelennek meg a bolt/trafik számok (staff).
            </p>
          </div>
          <button
            onClick={toggle}
            className={`relative h-6 w-11 rounded-full transition ${quickAccess ? 'bg-brand-500' : 'bg-gray-300'}`}
            role="switch"
            aria-checked={quickAccess}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                quickAccess ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      )}
    </div>
  );
}
