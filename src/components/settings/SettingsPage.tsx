'use client';

import { useState } from 'react';
import { Users, Store, ShieldCheck, SlidersHorizontal, ScrollText, Cloud } from 'lucide-react';
import { UsersSection } from './UsersSection';
import { StoreListsSection } from './StoreListsSection';
import { MenuPermsSection } from './MenuPermsSection';
import { SystemSection } from './SystemSection';
import { LoginLogSection } from './LoginLogSection';
import { DriveSection } from './DriveSection';
import type { AppUser } from '@/lib/types';

type Tab = 'users' | 'stores' | 'perms' | 'drive' | 'system' | 'log';

export function SettingsPage({ user }: { user: AppUser }) {
  const isAdmin = user.role === 'admin';
  const [tab, setTab] = useState<Tab>(isAdmin ? 'users' : 'stores');

  const allTabs: { key: Tab; label: string; icon: typeof Users; adminOnly?: boolean }[] = [
    { key: 'users', label: 'Felhasználók', icon: Users, adminOnly: true },
    { key: 'stores', label: 'Bolt listák', icon: Store },
    { key: 'perms', label: 'Menü engedélyek', icon: ShieldCheck, adminOnly: true },
    { key: 'drive', label: 'Google Drive', icon: Cloud, adminOnly: true },
    { key: 'system', label: 'Rendszer', icon: SlidersHorizontal, adminOnly: true },
    { key: 'log', label: 'Belépési napló', icon: ScrollText, adminOnly: true },
  ];
  const tabs = allTabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Beállítások</h1>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
                tab === t.key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'users' && isAdmin && <UsersSection />}
      {tab === 'stores' && <StoreListsSection />}
      {tab === 'perms' && isAdmin && <MenuPermsSection />}
      {tab === 'drive' && isAdmin && <DriveSection />}
      {tab === 'system' && isAdmin && <SystemSection />}
      {tab === 'log' && isAdmin && <LoginLogSection />}
    </div>
  );
}
