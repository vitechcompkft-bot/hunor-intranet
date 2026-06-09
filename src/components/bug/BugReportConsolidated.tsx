'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { exportTablePdf, type ExportColumn } from '@/lib/exports';
import type { BugReport } from '@/lib/types';

interface Row {
  store: string;
  bug: string;
  count: number;
}

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export function BugReportConsolidated() {
  const supabase = useMemo(() => createClient(), []);
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [store, setStore] = useState('');
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('bug_reports')
        .select('*')
        .gte('created_at', from)
        .lte('created_at', to + 'T23:59:59')
        .order('created_at', { ascending: false });
      setReports((data as BugReport[]) ?? []);
      setLoading(false);
    })();
  }, [supabase, from, to]);

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, number>();
    for (const r of reports) {
      if (store && !(r.store_number ?? '').toLowerCase().includes(store.toLowerCase())) continue;
      const key = `${r.store_number ?? '—'}||${r.bug_name}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([key, count]) => {
        const [s, bug] = key.split('||');
        return { store: s, bug, count };
      })
      .sort((a, b) => a.store.localeCompare(b.store, 'hu') || b.count - a.count);
  }, [reports, store]);

  const exportColumns: ExportColumn<Row>[] = [
    { header: 'Bolt', value: (r) => r.store },
    { header: 'Hiba típusa', value: (r) => r.bug },
    { header: 'Darab', value: (r) => r.count },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Hibajegy összesítő</h1>
        {rows.length > 0 && (
          <button
            onClick={() =>
              exportTablePdf(`Hibajegy összesítő (${from} – ${to})`, exportColumns, rows, 'hibajegy-osszesito')
            }
            className="btn-secondary"
          >
            <FileText size={16} /> PDF
          </button>
        )}
      </div>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Ettől</label>
          <input type="date" className="input w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">Eddig</label>
          <input type="date" className="input w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="label">Bolt</label>
          <input className="input w-32" value={store} onChange={(e) => setStore(e.target.value)} placeholder="pl. B001" />
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Nincs adat a megadott időszakra.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Bolt</th>
                <th className="px-4 py-3">Hiba típusa</th>
                <th className="px-4 py-3 text-right">Darab</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.store}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.bug}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-brand-700">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
