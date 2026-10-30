'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { BUILD_ID } from '@/lib/version';

const POLL_MS = 5 * 60 * 1000; // 5 percenként ellenőriz

/**
 * Verzió-figyelő: összeveti a betöltött oldal build-azonosítóját (BUILD_ID) az
 * éles szerver aktuális verziójával (/api/version). Ha új verzió került ki,
 * jelzi, és egy gombbal frissíthető az oldal. NEM tölt újra automatikusan, hogy
 * ne vesszen el egy épp beírt szöveg (pl. hibajegy). A használt verziószámot is
 * kiírja egy halvány jelzésben.
 */
export function VersionWatcher() {
  const [outdated, setOutdated] = useState(false);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;

    async function check() {
      if (stopped.current || outdated) return;
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { v?: string };
        if (data.v && BUILD_ID !== 'dev' && data.v !== 'dev' && data.v !== BUILD_ID) {
          setOutdated(true);
        }
      } catch {
        /* hálózati hiba — legközelebb újrapróbáljuk */
      }
    }

    check();
    const timer = setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped.current = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outdated]);

  return (
    <>
      {/* Halvány verziószám-jelzés (bal alsó sarok) */}
      <div className="pointer-events-none fixed bottom-1.5 left-2 z-40 select-none text-[10px] leading-none text-gray-400/80">
        v{BUILD_ID}
      </div>

      {/* Új verzió elérhető — frissítés felajánlása */}
      {outdated && (
        <div className="fixed bottom-4 left-1/2 z-[95] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-white px-4 py-3 shadow-lg">
            <RefreshCw size={18} className="shrink-0 text-brand-600" />
            <div className="flex-1 text-sm text-gray-700">
              <span className="font-semibold">Új verzió elérhető.</span> Frissítsd az oldalt a
              legújabb változatért.
            </div>
            <button onClick={() => window.location.reload()} className="btn-primary shrink-0">
              Frissítés
            </button>
          </div>
        </div>
      )}
    </>
  );
}
