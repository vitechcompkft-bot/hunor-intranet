'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { exportCsv } from '@/lib/exports';
import type { DemandForm } from '@/lib/types';

const cellKey = (r: number, c: number) => `${r}_${c}`;

interface Resp {
  store_number: string;
  responses: Record<string, string>;
}

export function DemandConsolidated({ formId }: { formId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<DemandForm | null>(null);
  const [responses, setResponses] = useState<Resp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: f } = await supabase.from('demand_forms').select('*').eq('id', formId).single();
      setForm(f as DemandForm);
      const { data: r } = await supabase
        .from('demand_form_responses')
        .select('store_number,responses')
        .eq('demand_form_id', formId)
        .order('store_number');
      setResponses((r as Resp[]) ?? []);
      setLoading(false);
    })();
  }, [supabase, formId]);

  const dataCols = form ? form.columns - 1 : 0;
  const dataHeaders = form ? form.headers.slice(1) : [];

  function sumFor(store: Resp, c: number): number {
    if (!form) return 0;
    let s = 0;
    for (let r = 0; r < form.rows; r++) {
      const v = Number(store.responses?.[cellKey(r, c)]);
      if (!Number.isNaN(v)) s += v;
    }
    return s;
  }

  function exportToCsv() {
    if (!form) return;
    const header1: (string | number)[] = [''];
    const header2: (string | number)[] = ['Megnevezés'];
    responses.forEach((resp) => {
      header1.push(resp.store_number);
      for (let i = 1; i < dataCols; i++) header1.push('');
      dataHeaders.forEach((h) => header2.push(h));
    });
    const rows: (string | number)[][] = [header1, header2];
    for (let r = 0; r < form.rows; r++) {
      const row: (string | number)[] = [form.first_column[r] || `Sor ${r + 1}`];
      responses.forEach((resp) => {
        for (let c = 1; c <= dataCols; c++) row.push(resp.responses?.[cellKey(r, c)] ?? '');
      });
      rows.push(row);
    }
    const sumRow: (string | number)[] = ['Összesen'];
    responses.forEach((resp) => {
      for (let c = 1; c <= dataCols; c++) sumRow.push(sumFor(resp, c));
    });
    rows.push(sumRow);
    exportCsv(rows, `igenybekero_${form.title.replace(/\s+/g, '_')}`);
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!form) return <div className="card p-8 text-center text-gray-400">Nem található.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/igenybekero" className="btn-secondary">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{form.title} — összesítő</h1>
        </div>
        {responses.length > 0 && (
          <button onClick={exportToCsv} className="btn-secondary">
            <Download size={16} /> CSV export
          </button>
        )}
      </div>

      {responses.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">Még egy bolt sem küldött be választ.</div>
      ) : (
        <div className="card overflow-x-auto p-2">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-gray-200 bg-gray-100 px-3 py-2"></th>
                {responses.map((resp) => (
                  <th
                    key={resp.store_number}
                    colSpan={dataCols}
                    className="border border-gray-200 bg-brand-50 px-3 py-2 text-center font-semibold text-brand-700"
                  >
                    {resp.store_number}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-medium text-gray-700">
                  Megnevezés
                </th>
                {responses.map((resp) =>
                  dataHeaders.map((h, i) => (
                    <th
                      key={`${resp.store_number}_${i}`}
                      className="border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600"
                    >
                      {h}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: form.rows }).map((_, r) => (
                <tr key={r}>
                  <td className="border border-gray-200 px-3 py-1.5 font-medium text-gray-700">
                    {form.first_column[r] || `Sor ${r + 1}`}
                  </td>
                  {responses.map((resp) =>
                    Array.from({ length: dataCols }).map((_, i) => (
                      <td
                        key={`${resp.store_number}_${i}`}
                        className="border border-gray-200 px-3 py-1.5 text-center text-gray-700"
                      >
                        {resp.responses?.[cellKey(r, i + 1)] ?? ''}
                      </td>
                    ))
                  )}
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="border border-gray-200 px-3 py-2 text-gray-800">Összesen</td>
                {responses.map((resp) =>
                  Array.from({ length: dataCols }).map((_, i) => (
                    <td
                      key={`${resp.store_number}_${i}`}
                      className="border border-gray-200 px-3 py-2 text-center text-brand-700"
                    >
                      {sumFor(resp, i + 1) || ''}
                    </td>
                  ))
                )}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
