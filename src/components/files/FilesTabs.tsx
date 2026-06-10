'use client';

import { useState } from 'react';
import { Cloud, FolderOpen } from 'lucide-react';
import { DriveBrowser } from './DriveBrowser';
import { FolderBrowser } from './FolderBrowser';
import { useTouch } from '@/lib/useTouch';
import type { AppUser } from '@/lib/types';

type Tab = 'drive' | 'own';

export function FilesTabs({ user }: { user: AppUser }) {
  const [tab, setTab] = useState<Tab>('drive');
  const isStaff = user.role === 'admin' || user.role === 'kozpont';
  const touch = useTouch();

  return (
    <div className={touch ? 'flex h-full min-h-0 flex-col gap-4' : 'space-y-4'}>
      <h1 className="text-2xl font-bold text-gray-900">Fájlok</h1>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab('drive')}
          className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
            tab === 'drive'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Cloud size={16} /> Megosztott dokumentumok
        </button>
        <button
          onClick={() => setTab('own')}
          className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
            tab === 'own'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <FolderOpen size={16} /> Saját mappa
        </button>
      </div>

      {touch ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {tab === 'drive' ? (
            <DriveBrowser canManage={isStaff} fill />
          ) : (
            <FolderBrowser user={user} embedded fill />
          )}
        </div>
      ) : tab === 'drive' ? (
        <DriveBrowser canManage={isStaff} />
      ) : (
        <FolderBrowser user={user} embedded />
      )}
    </div>
  );
}
