import { NextResponse } from 'next/server';
import { sendTelegram } from '@/lib/telegram';

const PRIORITY: Record<string, { emoji: string; label: string }> = {
  kritikus: { emoji: '🚨', label: 'Kritikus' },
  magas: { emoji: '🟠', label: 'Magas' },
  kozepes: { emoji: '🟡', label: 'Közepes' },
  alacsony: { emoji: '🟢', label: 'Alacsony' },
};

/** HTML-escape a Telegram parse_mode=HTML-hez. */
function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function POST(request: Request) {
  try {
    const { cim, prioritas, bekuldo, idopont, melleklet, leiras } = await request.json();
    const prio = PRIORITY[prioritas as string] ?? PRIORITY.kozepes;

    const text =
      `${prio.emoji} <b>Új Hibajegy</b>\n\n` +
      `<b>Cím:</b> ${esc(cim)}\n` +
      `<b>Prioritás:</b> ${prio.label}\n` +
      `<b>Beküldő:</b> ${esc(bekuldo)}\n` +
      `<b>Időpont:</b> ${esc(idopont)}\n` +
      `📎 <b>Melléklet:</b> ${esc(melleklet) || 'Nem'}\n\n` +
      `<b>Leírás:</b>\n${esc(leiras)}`;

    const result = await sendTelegram(text);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 });
  }
}
