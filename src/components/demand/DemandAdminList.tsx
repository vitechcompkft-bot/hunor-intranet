'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, BarChart3, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { DemandForm } from '@/lib/types';

interface FormStat extends DemandForm {
  assigned: number;
  submitted: number;
}

export function DemandAdminList() {
  const supabase = useMemo(() => createClient(), []);
  const [forms, setForms] = useState<FormStat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: f }, { data: a }, { data: r }] = await Promise.all([
      supabase.from('demand_forms').select('*').order('created_at', { ascending: false }),
      supabase.from('demand_form_assignments').select('demand_form_id,store_number'),
      supabase.from('demand_form_responses').select('demand_form_id,store_number'),
    ]);
    const assignedMap = new Map<string, number>();
    (a ?? []).forEach((x) => assignedMap.set(x.demand_form_id, (assignedMap.get(x.demand_form_id) ?? 0) + 1));
    const submittedMap = new Map<string, number>();
    (r ?? []).forEach((x) => submittedMap.set(x.demand_form_id, (submittedMap.get(x.demand_form_id) ?? 0) + 1));

    setForms(
      ((f as DemandForm[]) ?? []).map((form) => ({
        ...form,
        assigned: assignedMap.get(form.id) ?? 0,
        submitted: submittedMap.get(form.id) ?? 0,
      }))
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm('Biztosan törlöd ezt az igénybekérőt? A válaszok is törlődnek.')) return;
    await supabase.from('demand_forms').delete().eq('id', id);
    load();
  }

  function statusColor(s: FormStat) {
    if (s.assigned > 0 && s.submitted >= s.assigned) return 'bg-green-100 text-green-700';
    if (s.submitted > 0) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-700';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Igénybekérők</h1>
        <Link href="/igenybekero/uj" className="btn-primary">
          <Plus size={16} /> Új igénybekérő
        </Link>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : forms.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Még nincs igénybekérő.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Cím</th>
                <th className="px-4 py-3">Méret</th>
                <th className="px-4 py-3">Beküldve</th>
                <th className="px-4 py-3">Létrehozva</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {forms.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{f.title}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {f.rows} sor × {f.columns} oszlop
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${statusColor(f)}`}>
                      {f.submitted} / {f.assigned} bolt
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(f.created_at).toLocaleDateString('hu-HU')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/igenybekero/${f.id}/osszesito`}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title="Konszolidált nézet"
                      >
                        <BarChart3 size={15} />
                      </Link>
                      <button
                        onClick={() => remove(f.id)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Törlés"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
