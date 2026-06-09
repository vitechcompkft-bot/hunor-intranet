'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { AppUser, DemandForm } from '@/lib/types';
import { userScopeNumber } from '@/lib/types';

const cellKey = (r: number, c: number) => `${r}_${c}`;

export function DemandFill({ user, formId }: { user: AppUser; formId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const store = userScopeNumber(user) ?? '';

  const [form, setForm] = useState<DemandForm | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: f } = await supabase.from('demand_forms').select('*').eq('id', formId).single();
      setForm(f as DemandForm);
      const { data: resp } = await supabase
        .from('demand_form_responses')
        .select('responses')
        .eq('demand_form_id', formId)
        .eq('store_number', store)
        .maybeSingle();
      if (resp?.responses) setValues(resp.responses as Record<string, string>);
      setLoading(false);
    })();
  }, [supabase, formId, store]);

  async function save() {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.from('demand_form_responses').upsert(
      {
        demand_form_id: formId,
        store_number: store,
        responses: values,
        submitted_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'demand_form_id,store_number' }
    );
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    setSaved(true);
    setTimeout(() => {
      router.push('/igenybekero');
      router.refresh();
    }, 600);
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!form) return <div className="card p-8 text-center text-gray-400">Az igénybekérő nem található.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/igenybekero" className="btn-secondary">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
        <span className="badge bg-brand-100 text-brand-700">{store}</span>
      </div>

      <div className="card overflow-x-auto p-4">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              {form.headers.map((h, c) => (
                <th key={c} className="border border-gray-200 bg-gray-50 px-3 py-2 font-semibold text-gray-700">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {form.first_column.map((label, r) => (
              <tr key={r}>
                <td className="border border-gray-200 px-3 py-2 font-medium text-gray-700">
                  {label || `Sor ${r + 1}`}
                </td>
                {Array.from({ length: form.columns - 1 }).map((_, i) => {
                  const c = i + 1;
                  const key = cellKey(r, c);
                  return (
                    <td key={c} className="border border-gray-200 p-1">
                      <input
                        className="w-28 rounded border-0 px-2 py-1 text-center focus:ring-1 focus:ring-brand-300"
                        value={values[key] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button onClick={save} className="btn-primary" disabled={busy || saved}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saved ? 'Mentve ✓' : 'Beküldés'}
        </button>
      </div>
    </div>
  );
}
