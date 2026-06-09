'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, X, Bell, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { NAV_ITEMS, type NavKey } from '@/lib/nav';
import { ChatbotWidget } from '@/components/chat/ChatbotWidget';
import { ROLE_LABELS, ROLE_BADGE } from '@/lib/auth';
import type { AppUser } from '@/lib/types';

interface StoreMessage {
  id: string;
  message: string;
  created_at: string;
}

export function AppShell({
  user,
  allowed,
  children,
}: {
  user: AppUser;
  allowed: NavKey[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState<StoreMessage[]>([]);

  const allowedSet = useMemo(() => new Set(allowed), [allowed]);
  const items = NAV_ITEMS.filter((i) => allowedSet.has(i.key));

  // Olvasatlan üzenetek (csak bolti felhasználónál, akinek van store_number-e)
  const storeScope = user.role === 'viewer' || user.role === 'kozpont' ? user.storeNumber : undefined;

  useEffect(() => {
    if (!storeScope) return;
    let active = true;

    async function load() {
      const { data } = await supabase
        .from('store_messages')
        .select('id,message,created_at')
        .eq('store_number', storeScope)
        .eq('is_read', false)
        .order('created_at', { ascending: false });
      if (active && data) setUnread(data as StoreMessage[]);
    }
    load();

    const channel = supabase
      .channel(`store_messages_${storeScope}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'store_messages', filter: `store_number=eq.${storeScope}` },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, storeScope]);

  async function markAllRead() {
    if (!storeScope) return;
    await supabase
      .from('store_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('store_number', storeScope)
      .eq('is_read', false);
    setUnread([]);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Oldalsáv */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-gray-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
          <Logo size={48} />
          <button
            className="lg:hidden text-gray-400 hover:text-gray-600"
            onClick={() => setSidebarOpen(false)}
            aria-label="Menü bezárása"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {items.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Háttér overlay mobilon */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Fő tartalom */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 relative">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-800"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menü megnyitása"
          >
            <Menu size={22} />
          </button>

          {/* Középre igazított felirat (a logó stílusában) */}
          <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 items-baseline gap-2 md:flex">
            <span className="font-script text-3xl leading-none text-hunor-red">Hunor</span>
            <span className="font-script text-3xl leading-none text-hunor-green">Coop</span>
            <span className="text-2xl font-semibold tracking-wide text-gray-700">Intranet</span>
          </div>
          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{user.username}</div>
              <div className="flex items-center justify-end gap-2">
                <span className={`badge ${ROLE_BADGE[user.role]}`}>{ROLE_LABELS[user.role]}</span>
                {(user.storeNumber || user.trafikNumber) && (
                  <span className="text-xs text-gray-500">
                    {user.storeNumber || user.trafikNumber}
                  </span>
                )}
              </div>
            </div>
            <button onClick={logout} className="btn-secondary" title="Kijelentkezés">
              <LogOut size={16} />
              <span className="hidden sm:inline">Kilépés</span>
            </button>
          </div>
        </header>

        {/* Olvasatlan üzenetek banner */}
        {unread.length > 0 && (
          <div className="border-b border-yellow-200 bg-yellow-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <Bell size={18} className="mt-0.5 shrink-0 text-yellow-600" />
              <div className="flex-1 text-sm text-yellow-800">
                <span className="font-semibold">{unread.length} új üzenet</span> a központtól:
                <span className="ml-1">{unread[0].message}</span>
                {unread.length > 1 && <span className="ml-1 text-yellow-600">…</span>}
              </div>
              <button
                onClick={markAllRead}
                className="badge bg-yellow-200 text-yellow-800 hover:bg-yellow-300"
              >
                <Check size={14} className="mr-1" /> Olvasottnak jelölöm
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {allowedSet.has('chat') && <ChatbotWidget />}
    </div>
  );
}
