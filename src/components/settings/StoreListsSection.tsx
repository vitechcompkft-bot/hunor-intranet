'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Loader2, FileUp, FileDown, Trash } from 'lucide-react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import type { StoreListRow, StoreListType } from '@/lib/types';

/** "bolt"/"store"/"trafik" → szabványos típus */
function normalizeType(v: unknown): StoreListType {
  const s = String(v ?? '').toLowerCase().trim();
  return s.startsWith('traf') || s === 't' ? 'trafik' : 'store';
}

export function StoreListsSection() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<StoreListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<StoreListType>('store');
  const [number, setNumber] = useState('');
  const [label, setLabel] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('store_lists').select('*').order('type').order('sort_order');
    setRows((data as StoreListRow[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!number.trim()) return;
    await supabase.from('store_lists').insert({
      type,
      number: number.trim(),
      label: label.trim() || null,
      sort_order: rows.filter((r) => r.type === type).length + 1,
    });
    setNumber('');
    setLabel('');
    load();
  }

  async function remove(id: string) {
    if (!confirm('Törlöd ezt a tételt?')) return;
    await supabase.from('store_lists').delete().eq('id', id);
    load();
  }

  /** A teljes lista törlése (boltok és trafikok). Visszavonhatatlan. */
  async function removeAll() {
    if (rows.length === 0) return;
    if (!confirm(`Biztosan törlöd mind a(z) ${rows.length} tételt a listából? Ez nem vonható vissza.`))
      return;
    const { error } = await supabase.from('store_lists').delete().not('id', 'is', null);
    if (error) {
      alert('Törlési hiba: ' + error.message);
      return;
    }
    load();
  }

  /** Excel sablon letöltése a helyes formátummal. */
  function downloadTemplate() {
    const aoa = [
      ['Típus', 'Szám', 'Megnevezés'],
      ['bolt', 'B001', '1. számú bolt'],
      ['bolt', 'B002', '2. számú bolt'],
      ['trafik', 'T01', '1. trafik'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Boltok');
    XLSX.writeFile(wb, 'bolt_lista_sablon.xlsx');
  }

  /** Excel/CSV importálás: típus, szám, megnevezés oszlopok. */
  async function handleExcel(file: File) {
    setImporting(true);
    setImportMsg(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });
      if (grid.length === 0) {
        setImportMsg('A fájl üres.');
        return;
      }

      // Oszlopok meghatározása: ha van fejléc, név alapján; egyébként pozíció szerint
      let startIdx = 0;
      let colType = 0;
      let colNum = 1;
      let colLabel = 2;
      const first = (grid[0] as unknown[]).map((c) => String(c ?? '').toLowerCase().trim());
      const hasHeader = first.some((c) => /t[ií]pus|type|sz[aá]m|number|n[eé]v|megnevez|label|k[oó]d/.test(c));

      if (hasHeader) {
        startIdx = 1;
        const find = (re: RegExp) => first.findIndex((c) => re.test(c));
        const t = find(/t[ií]pus|type/);
        const n = find(/sz[aá]m|number|k[oó]d/);
        const l = find(/n[eé]v|megnevez|label|le[ií]r/);
        if (t >= 0) colType = t;
        if (n >= 0) colNum = n;
        if (l >= 0) colLabel = l;
      } else if ((grid[0] as unknown[]).length === 1) {
        // Egyetlen oszlop = csak számok
        colType = -1;
        colNum = 0;
        colLabel = -1;
      }

      const parsed: { type: StoreListType; number: string; label: string | null }[] = [];
      for (let i = startIdx; i < grid.length; i++) {
        const row = grid[i] as unknown[];
        const num = String(row[colNum] ?? '').trim();
        if (!num) continue;
        parsed.push({
          type: colType >= 0 ? normalizeType(row[colType]) : 'store',
          number: num,
          label: colLabel >= 0 ? String(row[colLabel] ?? '').trim() || null : null,
        });
      }

      if (parsed.length === 0) {
        setImportMsg('Nem találtam érvényes sort (legalább a szám oszlop kell).');
        return;
      }
      if (!confirm(`${parsed.length} tétel importálása a listába?`)) return;

      const base = rows.length;
      const insertRows = parsed.map((p, idx) => ({ ...p, sort_order: base + idx + 1 }));
      const { error } = await supabase.from('store_lists').insert(insertRows);
      if (error) {
        setImportMsg('Importálási hiba: ' + error.message);
        return;
      }
      setImportMsg(`${parsed.length} tétel sikeresen importálva.`);
      load();
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : 'Importálási hiba');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Vidd fel kézzel, vagy importáld Excelből (Típus, Szám, Megnevezés oszlopok).
        </p>
        <div className="flex gap-2">
          {rows.length > 0 && (
            <button onClick={removeAll} className="btn-danger">
              <Trash size={16} /> Mind törlése
            </button>
          )}
          <button onClick={downloadTemplate} className="btn-secondary">
            <FileDown size={16} /> Sablon
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn-primary" disabled={importing}>
            {importing ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />} Excel import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleExcel(e.target.files[0])}
          />
        </div>
      </div>

      {importMsg && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-700">
          {importMsg}
        </div>
      )}

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Típus</label>
          <select className="input w-32" value={type} onChange={(e) => setType(e.target.value as StoreListType)}>
            <option value="store">Bolt</option>
            <option value="trafik">Trafik</option>
          </select>
        </div>
        <div>
          <label className="label">Szám</label>
          <input className="input w-32" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="B001" />
        </div>
        <div>
          <label className="label">Megnevezés</label>
          <input className="input w-56" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="pl. Fő utcai bolt" />
        </div>
        <button onClick={add} className="btn-primary">
          <Plus size={16} /> Hozzáad
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10 text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Típus</th>
                <th className="px-4 py-2">Szám</th>
                <th className="px-4 py-2">Megnevezés</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className={`badge ${r.type === 'store' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {r.type === 'store' ? 'Bolt' : 'Trafik'}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-800">{r.number}</td>
                  <td className="px-4 py-2 text-gray-600">{r.label ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => remove(r.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
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
