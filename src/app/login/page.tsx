'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';

interface StoreOption {
  number: string;
  label: string | null;
  type: 'store' | 'trafik';
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [storeNumber, setStoreNumber] = useState('');
  const [options, setOptions] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bolt/trafik listák betöltése (anon olvasás engedélyezett)
  useEffect(() => {
    supabase
      .from('store_lists')
      .select('number,label,type')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data) setOptions(data as StoreOption[]);
      });
  }, [supabase]);

  // Email alapján érzékeljük, kell-e bolt/trafik szám
  const needsTrafik = /trafik/i.test(email);
  const needsStore = /viewer|bolt/i.test(email);
  const showStoreSelect = needsStore || needsTrafik;
  const filteredOptions = useMemo(
    () => options.filter((o) => (needsTrafik ? o.type === 'trafik' : o.type === 'store')),
    [options, needsTrafik]
  );

  async function logAttempt(success: boolean, message?: string) {
    try {
      await supabase.from('login_attempts').insert({
        email,
        success,
        error_message: message ?? null,
        store_number: storeNumber || null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });
    } catch {
      /* a naplózás hibája nem blokkolja a bejelentkezést */
    }
  }

  function mapError(raw: string): string {
    const m = raw.toLowerCase();
    if (m.includes('invalid login credentials')) return 'Helytelen email vagy jelszó.';
    if (m.includes('email not confirmed')) return 'Az email cím még nincs megerősítve.';
    if (m.includes('failed to fetch') || m.includes('network'))
      return 'Hálózati kapcsolati hiba — a szerver nem elérhető.';
    if (m.includes('rate limit')) return 'Túl sok próbálkozás. Kérlek várj egy kicsit.';
    return 'Bejelentkezési hiba: ' + raw;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (showStoreSelect && !storeNumber) {
      setError('Kérlek válaszd ki az áruház / trafik számot.');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        const msg = mapError(signInError.message);
        await logAttempt(false, signInError.message);
        setError(msg);
        return;
      }

      // Bolt/trafik szám frissítése az app_metadata-ban, ha választott
      if (storeNumber) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase.rpc('update_user_store_number', {
            user_id: user.id,
            new_store_number: storeNumber,
          });
          // Friss token az új app_metadata-val
          await supabase.auth.refreshSession();
        }
      }

      await logAttempt(true);
      const redirect = params.get('redirect') || '/';
      router.replace(redirect);
      router.refresh();
    } catch (err) {
      const msg = mapError(err instanceof Error ? err.message : String(err));
      await logAttempt(false, msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-100 via-brand-50 to-brand-100 px-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <Logo size={120} />
            <div className="mt-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
                <LogIn size={18} />
              </span>
              <span className="text-xl font-bold tracking-wide text-gray-800">INTRANET</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email cím
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pl. bolt1@hunor.hu"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">
                Jelszó
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  className="input pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {showStoreSelect && (
              <div>
                <label className="label" htmlFor="store">
                  {needsTrafik ? 'Trafik szám' : 'Áruház szám'}
                </label>
                <select
                  id="store"
                  className="input"
                  value={storeNumber}
                  onChange={(e) => setStoreNumber(e.target.value)}
                >
                  <option value="">
                    {needsTrafik ? 'Válassz trafik számot' : 'Válassz áruház számot'}
                  </option>
                  {filteredOptions.map((o) => (
                    <option key={o.number} value={o.number}>
                      {o.number}
                      {o.label ? ` — ${o.label}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Bejelentkezés…
                </>
              ) : (
                <>
                  <LogIn size={18} /> Bejelentkezés
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Hunor Coop szövetkezet · belső rendszer
        </p>
      </div>
    </div>
  );
}
