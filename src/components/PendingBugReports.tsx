'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, CheckCircle2, CloudUpload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  getPendingBugs,
  removePendingBug,
  updatePendingBug,
  sendPendingBug,
} from '@/lib/pendingBugReports';

const RETRY_MS = 30 * 1000; // 30 másodpercenként próbálkozik
const MAX_TRIES = 120; // ~1 óra után pihen (újratöltéskor/online eseménykor újrapróbál)

/**
 * Háttérben küldi el a gyenge kapcsolat miatt elakadt hibajegyeket (lásd
 * lib/pendingBugReports). Amíg van várakozó jegy, egy kis jelzést mutat; ha
 * sikerül, visszajelez és frissíti a Hibajegyek listát (hunor:bug-saved).
 */
export function PendingBugReports() {
  const supabase = useMemo(() => createClient(), []);
  const running = useRef(false);
  const [count, setCount] = useState(0);
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'info' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(text: string, kind: 'ok' | 'info') {
    setToast({ text, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), kind === 'ok' ? 4000 : 6000);
  }

  useEffect(() => {
    let stopped = false;

    async function processQueue() {
      if (running.current || stopped) return;
      running.current = true;
      try {
        for (const item of getPendingBugs()) {
          if (item.tries >= MAX_TRIES) continue;
          const r = await sendPendingBug(supabase, item);
          if (r === 'sent') {
            removePendingBug(item.id);
            window.dispatchEvent(new CustomEvent('hunor:bug-saved'));
            showToast('Hibajegy elküldve ✓', 'ok');
          } else {
            updatePendingBug(item.id, { tries: item.tries + 1 });
          }
        }
      } finally {
        running.current = false;
        if (!stopped) setCount(getPendingBugs().length);
      }
    }

    setCount(getPendingBugs().length);
    void processQueue();

    const timer = setInterval(() => void processQueue(), RETRY_MS);
    const onOnline = () => void processQueue();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void processQueue();
    };
    const onQueued = () => {
      setCount(getPendingBugs().length);
      showToast('Gyenge a kapcsolat — a hibajegyet elmentettem, automatikusan elküldöm.', 'info');
      void processQueue();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('hunor:bug-queued', onQueued);

    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('hunor:bug-queued', onQueued);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (count === 0 && !toast) return null;

  return (
    <div className="fixed left-1/2 top-3 z-[95] flex -translate-x-1/2 flex-col items-center gap-2">
      {count > 0 && (
        <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 shadow">
          <Loader2 size={15} className="animate-spin" />
          {count === 1 ? 'Egy hibajegy küldésre vár…' : `${count} hibajegy küldésre vár…`}
        </div>
      )}
      {toast && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm shadow-lg ${
            toast.kind === 'ok'
              ? 'border border-green-200 bg-white text-green-700'
              : 'border border-brand-200 bg-white text-gray-700'
          }`}
        >
          {toast.kind === 'ok' ? (
            <CheckCircle2 size={16} className="shrink-0 text-green-600" />
          ) : (
            <CloudUpload size={16} className="shrink-0 text-brand-600" />
          )}
          {toast.text}
        </div>
      )}
    </div>
  );
}
