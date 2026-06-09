import { NextResponse } from 'next/server';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT =
  'Te a HUNOR szövetkezet belső intranet rendszerének segítő asszisztense vagy. ' +
  'Magyarul válaszolj, röviden és közérthetően. Segíts a bolti dolgozóknak és a központi ' +
  'munkatársaknak az intranet használatában (hibajegyek, igénybekérők, fájlok, üzenetek).';

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      response: 'A chatbot jelenleg nincs beállítva (hiányzik az ANTHROPIC_API_KEY).',
    });
  }

  try {
    const { message, conversation_history } = (await request.json()) as {
      message: string;
      conversation_history?: ChatMessage[];
    };

    const messages: ChatMessage[] = [...(conversation_history ?? []), { role: 'user', content: message }];

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'A Claude API hívás nem sikerült.' }, { status: 502 });
    }
    const data = await res.json();
    const text = data.content?.[0]?.text ?? 'Nem érkezett válasz.';
    return NextResponse.json({ response: text });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Hiba' }, { status: 500 });
  }
}
