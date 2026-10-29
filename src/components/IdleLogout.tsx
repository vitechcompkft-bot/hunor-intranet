'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SCOPE_COOKIE, ACTIVITY_KEY, IDLE_LOGOUT_MS } from '@/lib/scope';

const WARN_MS = 60 * 1000; // 1 perccel a kiléptetés előtt figyelmeztet
const CHECK_MS = 5 * 1000; // ellenőrzés gyakorisága
const WRITE_THROTTLE_MS = 5 * 1000; // localStorage írás ritkítása

/**
 * Tétlenségi (inaktivitási) automatikus kiléptetés.
 *
 * Miért: a bolti gépek/iPadek gyakran nyitva maradnak kilépés nélkül; reggel a
 * lejárt munkamenet + VPN-újracsatlakozás miatt elhasalhat az első művelet.
 * Ez a komponens tevékenységre nullázódó időzítővel IDLE_LOGOUT_MS tétlenség
 * után kilépteti a felhasználót. Az utolsó aktivitást localStorage is őrzi, így
 * felfüggesztésből (iPad alvás) ébredéskor és a lap újratöltésekor is kiderül,
 * ha közben lejárt az idő → azonnali kiléptetés, friss belépés.
 */
export function IdleLogout() {
  const router = useRouter();
  const lastActivity = useRef<number>(Date.now());
  const lastWrite = useRef<number>(0);
  const warnActive = useRef<boolean>(false);
  const loggingOut = useRef<boolean>(false);
  const [warnLeft, setWarnLeft] = useState<number | null>(null);

  function readStored(): number | null {
    try {
      const v = localStorage.getItem(ACTIVITY_KEY);
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  }
  function writeStored(t: number) {
    try {
      localStorage.setItem(ACTIVITY_KEY, String(t));
    } catch {
      /* privát mód / letiltott tároló — csak a memória-időzítő marad */
    }
  }

  function markActive() {
    const now = Date.now();
    lastActivity.current = now;
    if (now - lastWrite.current > WRITE_THROTTLE_MS) {
      lastWrite.current = now;
      writeStored(now);
    }
    if (warnActive.current) {
      warnActive.current = false;
      setWarnLeft(null);
    }
  }

  function stayLoggedIn() {
    const now = Date.now();
    lastActivity.current = now;
    lastWrite.current = now;
    writeStored(now);
    warnActive.current = false;
    setWarnLeft(null);
  }

  async function doLogout() {
    if (loggingOut.current) return;
    loggingOut.current = true;
    try {
      document.cookie = `${SCOPE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    } catch {
      /* noop */
    }
    try {
      localStorage.removeItem(ACTIVITY_KEY);
    } catch {
      /* noop */
    }
    fetch('/api/session/store', { method: 'DELETE' }).catch(() => {});
    try {
      await createClient().auth.signOut();
    } catch {
      /* a kiléptetés akkor is menjen tovább, ha a signOut hálózati hibát dob */
    }
    router.replace('/login?timeout=1');
    router.refresh();
  }

  useEffect(() => {
    // Induláskor: ha a tárolt utolsó aktivitás túl régi (éjszakára nyitva hagyott,
    // majd felébresztett / újratöltött lap), azonnal kiléptetünk.
    const stored = readStored();
    const now = Date.now();
    if (stored && now - stored > IDLE_LOGOUT_MS) {
      void doLogout();
      return;
    }
    lastActivity.current = stored ?? now;
    lastWrite.current = now;
    writeStored(lastActivity.current);

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    const onActivity = () => markActive();
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const s = readStored() ?? lastActivity.current;
        if (Date.now() - s > IDLE_LOGOUT_MS) void doLogout();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const timer = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= IDLE_LOGOUT_MS) {
        void doLogout();
      } else if (idle >= IDLE_LOGOUT_MS - WARN_MS) {
        warnActive.current = true;
        setWarnLeft(Math.max(1, Math.ceil((IDLE_LOGOUT_MS - idle) / 1000)));
      }
    }, CHECK_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (warnLeft === null) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <h2 className="mb-2 text-lg font-bold text-gray-900">Mindjárt kiléptetünk</h2>
        <p className="mb-5 text-sm text-gray-600">
          Tétlenség miatt kb. <span className="font-semibold">{warnLeft}</span> másodperc múlva
          automatikusan kilépsz. Kattints, ha bent szeretnél maradni.
        </p>
        <button onClick={stayLoggedIn} className="btn-primary w-full">
          Bent maradok
        </button>
      </div>
    </div>
  );
}
