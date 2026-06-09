import { NextResponse } from 'next/server';
import { sendTelegram } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    const { message, store_number, username } = await request.json();
    if (!message) return NextResponse.json({ error: 'Üres üzenet' }, { status: 400 });

    const text =
      `📨 <b>Üzenet a boltból</b>\n` +
      `Bolt: <b>${store_number ?? '—'}</b>\n` +
      `Küldő: ${username ?? '—'}\n\n${message}`;

    const result = await sendTelegram(text);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 });
  }
}
