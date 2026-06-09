'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Attempt {
  id: string;
  email: string | null;
  success: boolean;
  error_message: string | null;
  store_number: string | null;
  created_at: string;
}

export function LoginLogSection() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('login_attempts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setRows((data as Attempt[]) ?? []);
        setLoading(false);
      });
  }, [supabase]);

  return (
    <div className="card overflow-x-auto">
      {loading ? (
        <div className="flex justify-center py-10 text-gray-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-gray-400">Nincs naplóbejegyzés.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Időpont</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Bolt</th>
              <th className="px-4 py-2">Eredmény</th>
              <th className="px-4 py-2">Hiba</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-500">{new Date(r.created_at).toLocaleString('hu-HU')}</td>
                <td className="px-4 py-2 text-gray-700">{r.email ?? '—'}</td>
                <td className="px-4 py-2 text-gray-600">{r.store_number ?? '—'}</td>
                <td className="px-4 py-2">
                  {r.success ? (
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <CheckCircle2 size={14} /> Sikeres
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-600">
                      <XCircle size={14} /> Sikertelen
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-gray-400">{r.error_message ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
