'use client';

import { useCallback, useEffect, useState } from 'react';
import { Cloud, CheckCircle2, Loader2, Link2, Unlink, AlertTriangle } from 'lucide-react';

interface Status {
  configured: boolean;
  connected: boolean;
}

export function DriveSection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/drive/status');
      setStatus(await res.json());
    } catch {
      setStatus({ configured: false, connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // visszajelzés az OAuth callbackről (?drive=connected|error|forbidden)
    const p = new URLSearchParams(window.location.search).get('drive');
    if (p === 'connected') setNotice('A Google Drive sikeresen csatlakoztatva. ✓');
    else if (p === 'error') setNotice('A csatlakoztatás nem sikerült. Próbáld újra.');
    else if (p === 'forbidden') setNotice('Csak admin csatlakoztathatja a Drive-ot.');
    if (p) window.history.replaceState({}, '', '/beallitasok');
  }, [load]);

  async function disconnect() {
    if (!confirm('Biztosan bontod a Google Drive kapcsolatot?')) return;
    setBusy(true);
    await fetch('/api/drive/disconnect', { method: 'POST' });
    setBusy(false);
    load();
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-700">
          {notice}
        </div>
      )}

      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-brand-50 p-3 text-brand-600">
            <Cloud size={24} />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-800">Google Drive — megosztott „Intranet" mappa</h2>
            <p className="mt-1 text-sm text-gray-500">
              A Fájlok → Megosztott dokumentumok fülön minden belépő ezt a mappát látja (csak olvasás).
            </p>

            <div className="mt-4">
              {loading ? (
                <Loader2 className="animate-spin text-gray-400" />
              ) : !status?.configured ? (
                <div className="flex items-start gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <span>
                    Hiányzik az OAuth beállítás. Add meg a <span className="font-mono">GOOGLE_OAUTH_CLIENT_ID</span> és{' '}
                    <span className="font-mono">GOOGLE_OAUTH_CLIENT_SECRET</span> értékeket a{' '}
                    <span className="font-mono">.env.local</span>-ban (lásd SETUP.md 6. pont).
                  </span>
                </div>
              ) : status.connected ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 font-medium text-green-600">
                    <CheckCircle2 size={18} /> Csatlakoztatva
                  </span>
                  <button onClick={disconnect} className="btn-secondary" disabled={busy}>
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Unlink size={16} />} Kapcsolat bontása
                  </button>
                </div>
              ) : (
                <a href="/api/drive/oauth/start" className="btn-primary">
                  <Link2 size={16} /> Google Drive csatlakoztatása
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
