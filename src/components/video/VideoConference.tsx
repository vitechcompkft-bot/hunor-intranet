'use client';

import { useState } from 'react';
import { Video, LogIn, LogOut } from 'lucide-react';

export function VideoConference() {
  const [room, setRoom] = useState('');
  const [active, setActive] = useState<string | null>(null);

  function join() {
    const name = room.trim().replace(/\s+/g, '-');
    if (name) setActive(`HUNOR-${name}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Videó konferencia</h1>

      {!active ? (
        <div className="card mx-auto max-w-md space-y-4 p-8 text-center">
          <div className="mx-auto w-fit rounded-full bg-brand-50 p-4 text-brand-600">
            <Video size={32} />
          </div>
          <p className="text-gray-600">Add meg a szoba nevét a csatlakozáshoz. Ugyanazt a nevet add meg, mint a partner.</p>
          <input
            className="input"
            placeholder="Szoba neve (pl. heti-ertekezlet)"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && join()}
          />
          <button onClick={join} className="btn-primary w-full" disabled={!room.trim()}>
            <LogIn size={16} /> Csatlakozás
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="badge bg-brand-100 text-brand-700">Szoba: {active}</span>
            <button onClick={() => setActive(null)} className="btn-danger">
              <LogOut size={16} /> Kilépés
            </button>
          </div>
          <div className="card overflow-hidden">
            <iframe
              src={`https://meet.jit.si/${encodeURIComponent(active)}`}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="h-[70vh] w-full border-0"
              title="Videó konferencia"
            />
          </div>
        </div>
      )}
    </div>
  );
}
