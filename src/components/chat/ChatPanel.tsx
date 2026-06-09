'use client';

import { useRef, useState, useEffect } from 'react';
import { Send, Loader2, Bot } from 'lucide-react';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatPanel({ compact = false }: { compact?: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: 'Szia! Miben segíthetek az intranet használatában?' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const history = messages.filter((_, i) => i > 0); // a kezdő üdvözlés nélkül
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversation_history: history }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: 'assistant', content: data.response ?? data.error ?? 'Hiba történt.' }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Hálózati hiba.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex flex-col ${compact ? 'h-[28rem]' : 'h-[calc(100vh-12rem)]'}`}>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl bg-gray-100 px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-gray-100 p-3">
        <input
          className="input"
          placeholder="Írj egy üzenetet…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button onClick={send} className="btn-primary" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}

export function ChatHeader() {
  return (
    <div className="flex items-center gap-2 text-gray-800">
      <div className="rounded-lg bg-brand-50 p-1.5 text-brand-600">
        <Bot size={18} />
      </div>
      <span className="font-semibold">HUNOR asszisztens</span>
    </div>
  );
}
