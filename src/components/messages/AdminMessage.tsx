'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AppUser } from '@/lib/types';

interface SentMessage {
  id: string;
  store_number: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function AdminMessage({ user }: { user: AppUser }) {
  const supabase = useMemo(() => createClient(), []);
  const [stores, setStores] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<SentMessage[]>([]);

  const loadSent = useCallback(async () => {
    const { data } = await supabase
      .from('store_messages')
      .select('id,store_number,message,is_read,created_at')
      .eq('sender_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setSent((data as SentMessage[]) ?? []);
  }, [supabase, user.id]);

  useEffect(() => {
    supabase
      .from('store_lists')
      .select('number')
      .eq('type', 'store')
      .order('sort_order')
      .then(({ data }) => setStores((data ?? []).map((s) => s.number)));
    loadSent();
  }, [supabase, loadSent]);

  function toggle(n: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  const allSelected = stores.length > 0 && selected.size === stores.length;

  async function send() {
    if (!message.trim() || selected.size === 0) {
      setError('Adj meg üzenetet és válassz legalább egy boltot.');
      return;
    }
    setBusy(true);
    setError(null);
    const rows = Array.from(selected).map((store_number) => ({
      store_number,
      message: message.trim(),
      sender_id: user.id,
      sender_name: user.username,
    }));
    const { error: e } = await supabase.from('store_messages').insert(rows);
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    setMessage('');
    setSelected(new Set());
    loadSent();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Üzenet küldése boltoknak</h1>

      <div className="card space-y-4 p-6">
        <textarea
          className="input min-h-[100px]"
          placeholder="Üzenet szövege…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label mb-0">Címzett boltok ({selected.size})</span>
            <button
              onClick={() => setSelected(allSelected ? new Set() : new Set(stores))}
              className="text-sm text-brand-600 hover:underline"
            >
              {allSelected ? 'Egyik sem' : 'Minden bolt'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {stores.map((n) => (
              <label key={n} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(n)}
                  onChange={() => toggle(n)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                {n}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button onClick={send} className="btn-primary" disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Küldés
          </button>
        </div>
      </div>

      {sent.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-800">Elküldött üzenetek</h2>
          <div className="card divide-y divide-gray-100">
            {sent.map((m) => (
              <div key={m.id} className="flex items-start gap-3 p-3">
                <span className="badge bg-brand-100 text-brand-700">{m.store_number}</span>
                <p className="flex-1 text-sm text-gray-700">{m.message}</p>
                <div className="text-right text-xs text-gray-400">
                  <div>{new Date(m.created_at).toLocaleDateString('hu-HU')}</div>
                  <span className={m.is_read ? 'text-green-600' : 'text-gray-400'}>
                    {m.is_read ? 'Olvasva' : 'Olvasatlan'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
