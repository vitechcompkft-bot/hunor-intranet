'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Loader2, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AppUser } from '@/lib/types';

export function DemandBuilder({ user }: { user: AppUser }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState(5);
  const [columns, setColumns] = useState(3);

  const [headers, setHeaders] = useState<string[]>([]);
  const [firstColumn, setFirstColumn] = useState<string[]>([]);
  const [stores, setStores] = useState<{ number: string; label: string | null }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('store_lists')
      .select('number,label')
      .eq('type', 'store')
      .order('sort_order')
      .then(({ data }) => setStores(data ?? []));
  }, [supabase]);

  function goStep2() {
    if (!title.trim()) {
      setError('Adj címet az igénybekérőnek.');
      return;
    }
    setError(null);
    // headers[0] = "Bolt szám" fix, a többi szerkeszthető
    setHeaders((prev) => {
      const next = ['Bolt szám'];
      for (let c = 1; c < columns; c++) next.push(prev[c] ?? `Oszlop ${c}`);
      return next;
    });
    setFirstColumn((prev) => Array.from({ length: rows }, (_, r) => prev[r] ?? ''));
    setStep(2);
  }

  function toggleStore(n: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  async function save() {
    if (selected.size === 0) {
      setError('Válassz ki legalább egy boltot.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data: form, error: e1 } = await supabase
        .from('demand_forms')
        .insert({
          title: title.trim(),
          rows,
          columns,
          headers,
          first_column: firstColumn,
          created_by: user.id,
        })
        .select('id')
        .single();
      if (e1 || !form) throw e1 ?? new Error('Mentési hiba');

      const assignments = Array.from(selected).map((store_number) => ({
        demand_form_id: form.id,
        store_number,
      }));
      const { error: e2 } = await supabase.from('demand_form_assignments').insert(assignments);
      if (e2) throw e2;

      router.push('/igenybekero');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mentési hiba');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Új igénybekérő</h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 1 ? (
        <div className="card space-y-4 p-6">
          <div>
            <label className="label">Cím</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="pl. Heti rendelés" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Sorok száma</label>
              <input
                type="number"
                min={1}
                max={50}
                className="input"
                value={rows}
                onChange={(e) => setRows(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
            <div>
              <label className="label">Oszlopok száma</label>
              <input
                type="number"
                min={2}
                max={20}
                className="input"
                value={columns}
                onChange={(e) => setColumns(Math.min(20, Math.max(2, Number(e.target.value) || 2)))}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={goStep2} className="btn-primary">
              Tovább <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card overflow-x-auto p-4">
            <p className="mb-3 text-sm font-medium text-gray-700">Fejlécek és sor-feliratok</p>
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  {headers.map((h, c) => (
                    <th key={c} className="border border-gray-200 p-1">
                      {c === 0 ? (
                        <span className="block px-2 py-1 font-semibold text-gray-700">{h}</span>
                      ) : (
                        <input
                          className="w-32 rounded border-0 px-2 py-1 text-center focus:ring-1 focus:ring-brand-300"
                          value={h}
                          onChange={(e) =>
                            setHeaders((prev) => prev.map((x, i) => (i === c ? e.target.value : x)))
                          }
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {firstColumn.map((label, r) => (
                  <tr key={r}>
                    <td className="border border-gray-200 p-1">
                      <input
                        className="w-40 rounded border-0 px-2 py-1 focus:ring-1 focus:ring-brand-300"
                        value={label}
                        placeholder={`Sor ${r + 1}`}
                        onChange={(e) =>
                          setFirstColumn((prev) => prev.map((x, i) => (i === r ? e.target.value : x)))
                        }
                      />
                    </td>
                    {Array.from({ length: columns - 1 }).map((_, c) => (
                      <td key={c} className="border border-gray-200 bg-gray-50 p-1">
                        <span className="block w-32 px-2 py-1 text-center text-xs text-gray-300">
                          (bolt tölti ki)
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card p-4">
            <p className="mb-3 text-sm font-medium text-gray-700">
              Mely boltok kapják? ({selected.size} kiválasztva)
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stores.map((s) => (
                <label key={s.number} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(s.number)}
                    onChange={() => toggleStore(s.number)}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  {s.number}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-secondary">
              <ArrowLeft size={16} /> Vissza
            </button>
            <button onClick={save} className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Mentés
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
