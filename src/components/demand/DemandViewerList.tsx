'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AppUser, DemandForm } from '@/lib/types';
import { userScopeNumber } from '@/lib/types';

interface AssignedForm extends DemandForm {
  filled: boolean;
}

export function DemandViewerList({ user }: { user: AppUser }) {
  const supabase = useMemo(() => createClient(), []);
  const store = userScopeNumber(user) ?? '';
  const [forms, setForms] = useState<AssignedForm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!store) {
        setLoading(false);
        return;
      }
      // a boltnak kiosztott formok
      const { data: assigns } = await supabase
        .from('demand_form_assignments')
        .select('demand_form_id')
        .eq('store_number', store);
      const ids = (assigns ?? []).map((a) => a.demand_form_id);
      if (ids.length === 0) {
        setForms([]);
        setLoading(false);
        return;
      }
      const [{ data: f }, { data: resp }] = await Promise.all([
        supabase.from('demand_forms').select('*').in('id', ids).order('created_at', { ascending: false }),
        supabase.from('demand_form_responses').select('demand_form_id').eq('store_number', store),
      ]);
      const filledSet = new Set((resp ?? []).map((r) => r.demand_form_id));
      setForms(((f as DemandForm[]) ?? []).map((form) => ({ ...form, filled: filledSet.has(form.id) })));
      setLoading(false);
    })();
  }, [supabase, store]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Igénybekérők</h1>

      {loading ? (
        <div className="card flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : forms.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">Jelenleg nincs kitöltendő igénybekérő.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((f) => (
            <Link
              key={f.id}
              href={`/igenybekero/${f.id}`}
              className="card flex items-center gap-3 p-4 transition hover:shadow-md"
            >
              <div className="rounded-lg bg-brand-50 p-2 text-brand-600">
                <ClipboardList size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-800">{f.title}</p>
                <p className="text-xs text-gray-400">{f.rows} sor</p>
              </div>
              {f.filled ? (
                <span className="badge bg-green-100 text-green-700">
                  <Check size={12} className="mr-1" /> Kitöltve
                </span>
              ) : (
                <span className="badge bg-red-100 text-red-700">Kitöltendő</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
