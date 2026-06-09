'use client';

import { useEffect, useMemo, useState } from 'react';
import { Send, Loader2, Inbox } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AppUser } from '@/lib/types';
import { userScopeNumber } from '@/lib/types';

interface Received {
  id: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

export function MessageViewer({ user }: { user: AppUser }) {
  const supabase = useMemo(() => createClient(), []);
  const scope = userScopeNumber(user) ?? '';

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState<Received[]>([]);

  useEffect(() => {
    if (user.role !== 'viewer' || !scope) return;
    supabase
      .from('store_messages')
      .select('id,message,created_at,is_read')
      .eq('store_number', scope)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setReceived((data as Received[]) ?? []));
  }, [supabase, scope, user.role]);

  async function send() {
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/telegram/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), store_number: scope, username: user.username }),
      });
      if (!res.ok) throw new Error('Az üzenet küldése nem sikerült.');
      setSent(true);
      setMessage('');
      setTimeout(() => setSent(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hiba');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Üzenet a központnak</h1>

      <div className="card space-y-3 p-6">
        <textarea
          className="input min-h-[120px]"
          placeholder="Írd ide az üzenetet…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {sent && <p className="text-sm text-green-600">Üzenet elküldve ✓</p>}
        <div className="flex justify-end">
          <button onClick={send} className="btn-primary" disabled={busy || !message.trim()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Küldés
          </button>
        </div>
      </div>

      {received.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-gray-800">
            <Inbox size={18} /> Beérkezett üzenetek
          </h2>
          <div className="space-y-2">
            {received.map((m) => (
              <div key={m.id} className="card p-3">
                <p className="text-sm text-gray-800">{m.message}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(m.created_at).toLocaleString('hu-HU')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
