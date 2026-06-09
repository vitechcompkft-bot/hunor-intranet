import { NextResponse } from 'next/server';
import { sendTelegram } from '@/lib/telegram';

const PREFIX: Record<string, string> = {
  URGENT: '🚨 SÜRGŐS',
  HIGH: '⚠️ MAGAS',
  NORMAL: '📋 NORMÁL',
};

export async function POST(request: Request) {
  try {
    const { bug_name, store_number, description, priority } = await request.json();
    const head = PREFIX[priority as string] ?? PREFIX.NORMAL;

    const text =
      `${head} — <b>Hibajelentés</b>\n` +
      `Bolt: <b>${store_number ?? '—'}</b>\n` +
      `Típus: ${bug_name ?? '—'}\n\n${description ?? ''}`;

    const result = await sendTelegram(text);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 });
  }
}
