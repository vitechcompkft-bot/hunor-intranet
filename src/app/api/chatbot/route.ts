import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { documentationText } from '@/lib/documentation';
import { searchIntranetDocuments, isDriveConnected } from '@/lib/google-drive';

export const runtime = 'nodejs';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: unknown;
}

const SYSTEM_PROMPT =
  'Te a HUNOR Coop szövetkezet belső intranet rendszerének segítő asszisztense vagy. ' +
  'Magyarul válaszolj, közérthetően, lépésről lépésre, ahogy egy bolti dolgozónak segítenél. ' +
  'A rendszer használatával kapcsolatos kérdéseket az alábbi felhasználói dokumentációra alapozd.\n\n' +
  'DOKUMENTUMKERESÉS: ha a felhasználó egy konkrét dokumentumot, iratot, szabályzatot, ' +
  'nyomtatványt vagy fájlt keres (pl. „hol találom a…", „melyik mappában van a…", „keresek egy…"), ' +
  'használd a „dokumentum_kereso" eszközt a kulcsszavaival. Ezután mondd meg, MELYIK MAPPÁBAN van, ' +
  'az útvonalat mindig így add meg a felhasználónak: „Fájlok → Megosztott dokumentumok → …". ' +
  'Minden találathoz adj egy kattintható linket is Markdown formában: [Fájl neve](/api/drive/file?id=AZONOSÍTÓ). ' +
  'Ha több találat van, sorold fel a legrelevánsabbakat. Ha nincs találat, mondd el, hogy nem találtál ' +
  'ilyen nevű dokumentumot, és javasold, hogy pontosítsa a keresést vagy forduljon a központhoz. ' +
  'Ne találj ki nem létező fájlneveket vagy azonosítókat — kizárólag az eszköz által visszaadottakat használd.\n\n' +
  '=== FELHASZNÁLÓI DOKUMENTÁCIÓ ===\n' +
  documentationText();

const TOOLS = [
  {
    name: 'dokumentum_kereso',
    description:
      'Rákeres a Megosztott dokumentumok (Google Drive „Intranet" mappa) fájljaira és mappáira ' +
      'név, mappa-útvonal és tartalom alapján. Akkor használd, amikor a felhasználó egy konkrét ' +
      'dokumentumot vagy iratot keres, és meg akarod mondani neki, hol találja.',
    input_schema: {
      type: 'object',
      properties: {
        kulcsszavak: {
          type: 'string',
          description:
            'Amit a felhasználó keres, magyarul, néhány kulcsszóval (pl. „nyári nyitvatartás", ' +
            '„HACCP szabályzat", „leltár nyomtatvány", „marketing plakát").',
        },
      },
      required: ['kulcsszavak'],
    },
  },
];

const MODEL = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';

async function callClaude(apiKey: string, messages: ChatMessage[]) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    }),
  });
  if (!res.ok) throw new Error('claude ' + res.status + ': ' + (await res.text()));
  return res.json();
}

/** Egy tool_use blokk kiszolgálása → tool_result content. */
async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  if (name !== 'dokumentum_kereso') return JSON.stringify({ error: 'ismeretlen eszköz' });
  const query = String(input.kulcsszavak ?? '').trim();
  if (!query) return JSON.stringify({ talalatok: [] });
  try {
    if (!(await isDriveConnected())) {
      return JSON.stringify({ hiba: 'A Google Drive nincs csatlakoztatva, így nem tudok dokumentumot keresni.' });
    }
    const matches = await searchIntranetDocuments(query);
    return JSON.stringify({
      talalatok: matches.map((m) => ({
        nev: m.name,
        tipus: m.isFolder ? 'mappa' : 'fájl',
        mappa_utvonal: m.folderPath.join(' › '),
        // az azonosítóból a chatbot linket épít: /api/drive/file?id=...
        azonosito: m.id,
      })),
    });
  } catch {
    return JSON.stringify({ hiba: 'A keresés közben hiba történt.' });
  }
}

export async function POST(request: Request) {
  // csak bejelentkezett felhasználó (a dokumentumnevek nem publikusak)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      response: 'A chatbot jelenleg nincs beállítva (hiányzik az ANTHROPIC_API_KEY).',
    });
  }

  try {
    const { message, conversation_history } = (await request.json()) as {
      message: string;
      conversation_history?: { role: 'user' | 'assistant'; content: string }[];
    };

    const messages: ChatMessage[] = [
      ...(conversation_history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    // tool-use ciklus (max néhány kör, hogy ne pörögjön végtelenbe)
    let data = await callClaude(apiKey, messages);
    for (let round = 0; round < 4 && data.stop_reason === 'tool_use'; round++) {
      const toolUses = (data.content ?? []).filter(
        (b: { type: string }) => b.type === 'tool_use'
      );
      // az asszisztens fordulóját (a tool_use blokkokkal) visszatesszük a beszélgetésbe
      messages.push({ role: 'assistant', content: data.content });
      const results = [];
      for (const tu of toolUses) {
        const out = await runTool(tu.name, tu.input ?? {});
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: out });
      }
      messages.push({ role: 'user', content: results });
      data = await callClaude(apiKey, messages);
    }

    const text =
      (data.content ?? [])
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('\n')
        .trim() || 'Nem érkezett válasz.';
    return NextResponse.json({ response: text });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Hiba' }, { status: 500 });
  }
}
