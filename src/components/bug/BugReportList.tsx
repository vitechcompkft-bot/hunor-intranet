'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Pencil,
  Trash2,
  Paperclip,
  FileSpreadsheet,
  FileText,
  BarChart3,
  Loader2,
  MessageSquare,
  Send,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { BugReportForm } from './BugReportForm';
import { getSignedUrl } from '@/lib/storage';
import { exportTablePdf, exportTableExcel, type ExportColumn } from '@/lib/exports';
import { userScopeNumber, STORAGE_BUCKET } from '@/lib/types';
import type { AppUser, BugReport, BugReportMessage, BugStatus } from '@/lib/types';

/** A hibajegyhez író fél megjelenített neve. */
function authorName(user: AppUser): string {
  if (user.role === 'admin') return 'Adminisztrátor';
  if (user.role === 'kozpont') return 'Központ';
  const n = userScopeNumber(user) ?? '';
  return (user.role === 'trafik' ? `Trafik ${n}` : `Bolt ${n}`).trim();
}

const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|heic)$/i;

const STATUS_BADGE: Record<BugStatus, string> = {
  Folyamatban: 'bg-yellow-100 text-yellow-800',
  Lezárva: 'bg-green-100 text-green-700',
};

export function BugReportList({ user }: { user: AppUser }) {
  const supabase = useMemo(() => createClient(), []);
  const isStaff = user.role === 'admin' || user.role === 'kozpont';
  const isAdmin = user.role === 'admin';

  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<BugReport | null>(null);
  const [thread, setThread] = useState<BugReport | null>(null);

  // szűrők (staff)
  const [fStatus, setFStatus] = useState<'' | BugStatus>('');
  const [fStore, setFStore] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false });
    // Bolt/trafik felhasználó csak a saját boltja hibajegyeit látja. A szűrés
    // az app-rétegben történik (az RLS store-scope-ja megosztott fióknál nem
    // hordozható a JWT-ben) — a saját munkamenet boltszámára szűkítünk.
    if (!isStaff) {
      query = query.eq('store_number', userScopeNumber(user) ?? '\0');
    }
    const { data } = await query;
    setReports((data as BugReport[]) ?? []);
    setLoading(false);
  }, [supabase, isStaff, user]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (fStatus && r.status !== fStatus) return false;
      if (fStore && !(r.store_number ?? '').toLowerCase().includes(fStore.toLowerCase())) return false;
      if (fFrom && r.created_at < fFrom) return false;
      if (fTo && r.created_at > fTo + 'T23:59:59') return false;
      return true;
    });
  }, [reports, fStatus, fStore, fFrom, fTo]);

  async function downloadAttachment(path: string) {
    try {
      const url = await getSignedUrl(supabase, path, 120);
      window.open(url, '_blank');
    } catch {
      alert('A csatolmány nem érhető el.');
    }
  }

  async function handleDelete(r: BugReport) {
    if (!confirm(`Biztosan törlöd a(z) #${r.report_number} hibajegyet?`)) return;
    await supabase.from('bug_reports').delete().eq('id', r.id);
    load();
  }

  const exportColumns: ExportColumn<BugReport>[] = [
    { header: 'Sorsz.', value: (r) => r.report_number },
    { header: 'Bolt', value: (r) => r.store_number ?? '' },
    { header: 'Hiba', value: (r) => r.bug_name },
    { header: 'Leírás', value: (r) => r.bug_description },
    { header: 'Státusz', value: (r) => r.status },
    { header: 'Befejezés', value: (r) => r.completion_date ?? '' },
    { header: 'Megjegyzés', value: (r) => r.notes ?? '' },
    { header: 'Dátum', value: (r) => new Date(r.created_at).toLocaleDateString('hu-HU') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Hibajegyek</h1>
        <div className="flex flex-wrap gap-2">
          {isStaff && (
            <Link href="/hibajegyek/osszesito" className="btn-secondary">
              <BarChart3 size={16} /> <span className="hidden sm:inline">Összesítő</span>
            </Link>
          )}
          {isStaff && filtered.length > 0 && (
            <>
              <button
                onClick={() => exportTableExcel('Hibajegyek', exportColumns, filtered, 'hibajegyek')}
                className="btn-secondary"
              >
                <FileSpreadsheet size={16} /> <span className="hidden sm:inline">Excel</span>
              </button>
              <button
                onClick={() => exportTablePdf('Hibajegyek', exportColumns, filtered, 'hibajegyek')}
                className="btn-secondary"
              >
                <FileText size={16} /> <span className="hidden sm:inline">PDF</span>
              </button>
            </>
          )}
          <button onClick={() => setShowNew(true)} className="btn-primary">
            <Plus size={16} /> Új hibajegy
          </button>
        </div>
      </div>

      {isStaff && (
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="label">Státusz</label>
            <select className="input w-44" value={fStatus} onChange={(e) => setFStatus(e.target.value as BugStatus | '')}>
              <option value="">Mind</option>
              <option value="Folyamatban">Folyamatban</option>
              <option value="Lezárva">Lezárva</option>
            </select>
          </div>
          <div>
            <label className="label">Bolt</label>
            <input className="input w-32" value={fStore} onChange={(e) => setFStore(e.target.value)} placeholder="pl. B001" />
          </div>
          <div>
            <label className="label">Ettől</label>
            <input type="date" className="input w-40" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Eddig</label>
            <input type="date" className="input w-40" value={fTo} onChange={(e) => setFTo(e.target.value)} />
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Nincs megjeleníthető hibajegy.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">#</th>
                {isStaff && <th className="px-4 py-3">Bolt</th>}
                <th className="px-4 py-3">Hiba</th>
                <th className="px-4 py-3">Leírás</th>
                <th className="px-4 py-3">Státusz</th>
                <th className="px-4 py-3">Befejezés</th>
                <th className="px-4 py-3">Megjegyzés</th>
                <th className="px-4 py-3">Dátum</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{r.report_number}</td>
                  {isStaff && <td className="px-4 py-3">{r.store_number ?? '—'}</td>}
                  <td className="px-4 py-3 font-medium text-gray-800">{r.bug_name}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-gray-600" title={r.bug_description}>
                    {r.bug_description}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.completion_date ?? '—'}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-gray-600" title={r.notes ?? ''}>
                    {r.notes ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(r.created_at).toLocaleDateString('hu-HU')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setThread(r)}
                        className="rounded p-1.5 text-gray-400 hover:bg-brand-50 hover:text-brand-600"
                        title={r.status === 'Lezárva' ? 'Üzenetek (lezárva)' : 'Üzenetek / kérdés'}
                      >
                        <MessageSquare size={15} />
                      </button>
                      {r.attachment_path && (
                        <button
                          onClick={() => downloadAttachment(r.attachment_path!)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Csatolmány"
                        >
                          <Paperclip size={15} />
                        </button>
                      )}
                      {isStaff && (
                        <button
                          onClick={() => setEditing(r)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Szerkesztés"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(r)}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="Törlés"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Új hibajegy">
        <BugReportForm
          user={user}
          onCancel={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
          }}
        />
      </Modal>

      {editing && (
        <EditBugModal
          report={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {thread && (
        <BugThreadModal report={thread} user={user} onClose={() => setThread(null)} />
      )}
    </div>
  );
}

function BugThreadModal({
  report,
  user,
  onClose,
}: {
  report: BugReport;
  user: AppUser;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const closed = report.status === 'Lezárva';

  const [messages, setMessages] = useState<BugReportMessage[]>([]);
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bug_report_messages')
      .select('*')
      .eq('bug_report_id', report.id)
      .order('created_at', { ascending: true });
    const msgs = (data as BugReportMessage[]) ?? [];
    setMessages(msgs);
    setLoading(false);
    // Kép-csatolmányokhoz aláírt URL (inline előnézethez)
    const urls: Record<string, string> = {};
    await Promise.all(
      msgs
        .filter((m) => m.attachment_path && IMAGE_RE.test(m.attachment_path))
        .map(async (m) => {
          try {
            urls[m.id] = await getSignedUrl(supabase, m.attachment_path!, 300);
          } catch {
            /* noop */
          }
        })
    );
    setImgUrls(urls);
  }, [supabase, report.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Legjobb-szándékú realtime (VPN alatt nem mindig megy — ezért van Frissítés gomb is)
  useEffect(() => {
    const channel = supabase
      .channel(`bug_msgs_${report.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bug_report_messages',
          filter: `bug_report_id=eq.${report.id}`,
        },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, report.id, load]);

  async function openAttachment(path: string) {
    try {
      const url = await getSignedUrl(supabase, path, 120);
      window.open(url, '_blank');
    } catch {
      alert('A csatolmány nem érhető el.');
    }
  }

  async function send() {
    if (!text.trim() && !file) return;
    setBusy(true);
    setError(null);
    try {
      let attachmentPath: string | null = null;
      if (file) {
        const safe = file.name.replace(/[^\w.\-]/g, '_');
        const target = `bug-reports/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(target, file, { upsert: true, contentType: file.type || undefined });
        if (upErr) throw upErr;
        attachmentPath = target;
      }
      const { error: insErr } = await supabase.from('bug_report_messages').insert({
        bug_report_id: report.id,
        author_id: user.id,
        author_name: authorName(user),
        message: text.trim() || null,
        attachment_path: attachmentPath,
      });
      if (insErr) throw insErr;
      setText('');
      setFile(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Küldési hiba');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Hibajegy #${report.report_number} — üzenetek`} maxWidth="max-w-2xl">
      {/* Eredeti hibajegy */}
      <div className="rounded-lg bg-gray-50 p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-gray-800">{report.bug_name}</p>
          <span className={`badge ${STATUS_BADGE[report.status]}`}>{report.status}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-gray-600">{report.bug_description}</p>
        {report.attachment_path && (
          <button
            onClick={() => openAttachment(report.attachment_path!)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
          >
            <Paperclip size={13} /> Eredeti csatolmány
          </button>
        )}
      </div>

      {/* Üzenetek */}
      <div className="mt-4 max-h-[42vh] space-y-3 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            Még nincs üzenet. Írj elsőként kérdést vagy kiegészítést.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.author_id === user.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    mine ? 'bg-brand-50 text-gray-800' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className="mb-0.5 flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-medium">{m.author_name ?? 'Ismeretlen'}</span>
                    <span>{new Date(m.created_at).toLocaleString('hu-HU')}</span>
                  </div>
                  {m.message && <p className="whitespace-pre-wrap">{m.message}</p>}
                  {m.attachment_path &&
                    (imgUrls[m.id] ? (
                      <button onClick={() => openAttachment(m.attachment_path!)} className="mt-1 block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgUrls[m.id]}
                          alt="csatolmány"
                          className="max-h-48 rounded-md border border-gray-200"
                        />
                      </button>
                    ) : (
                      <button
                        onClick={() => openAttachment(m.attachment_path!)}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                      >
                        <Paperclip size={13} /> Csatolmány megnyitása
                      </button>
                    ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {/* Új üzenet / kép — csak ha nincs lezárva */}
      {closed ? (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-gray-50 py-3 text-sm text-gray-500">
          <Lock size={14} /> A hibajegy lezárva — nem írható hozzá több üzenet.
        </div>
      ) : (
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
          <textarea
            className="input min-h-[70px]"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Írj üzenetet, kérdést vagy választ…"
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-500 hover:text-brand-600">
              <Paperclip size={16} />
              {file ? file.name : 'Kép / csatolmány'}
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <div className="flex items-center gap-2">
              <button onClick={load} className="btn-secondary" title="Frissítés" disabled={busy}>
                <RefreshCw size={16} />
              </button>
              <button onClick={send} className="btn-primary" disabled={busy || (!text.trim() && !file)}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Küldés
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function EditBugModal({
  report,
  onClose,
  onSaved,
}: {
  report: BugReport;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD (helyi)
  const [status, setStatus] = useState<BugStatus>(report.status);
  const [completion, setCompletion] = useState(report.completion_date ?? today);
  const [notes, setNotes] = useState(report.notes ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await supabase
      .from('bug_reports')
      .update({
        status,
        completion_date: completion || null,
        notes: notes || null,
      })
      .eq('id', report.id);
    setBusy(false);
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={`Hibajegy #${report.report_number}`}>
      <div className="space-y-3">
        <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          <p><span className="font-medium">{report.bug_name}</span> — {report.store_number ?? '—'}</p>
          <p className="mt-1">{report.bug_description}</p>
        </div>
        <div>
          <label className="label">Státusz</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as BugStatus)}>
            <option value="Folyamatban">Folyamatban</option>
            <option value="Lezárva">Lezárva</option>
          </select>
        </div>
        <div>
          <label className="label">Befejezés dátuma</label>
          <input type="date" className="input" value={completion} onChange={(e) => setCompletion(e.target.value)} />
        </div>
        <div>
          <label className="label">Megjegyzés</label>
          <textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary" disabled={busy}>
          Mégse
        </button>
        <button onClick={save} className="btn-primary" disabled={busy}>
          {busy && <Loader2 size={16} className="animate-spin" />} Mentés
        </button>
      </div>
    </Modal>
  );
}
