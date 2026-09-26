import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { signJaasToken } from '@/lib/jaas';
import { userScopeNumber } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * JaaS csatlakozási token egy adott szobához. A staff (admin/központ) moderátor,
 * a bolt/trafik résztvevő — de csak a NEKI KIOSZTOTT szobához kap tokent.
 * Ha a JaaS kulcsok nincsenek beállítva, { configured: false }-t ad, és a
 * kliens visszaesik a nyilvános meet.jit.si-re.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 401 });

  const appId = process.env.JAAS_APP_ID;
  const keyId = process.env.JAAS_KEY_ID;
  const privateKey = process.env.JAAS_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!appId || !keyId || !privateKey) {
    return NextResponse.json({ configured: false });
  }

  let roomKey: unknown;
  try {
    ({ roomKey } = (await req.json()) as { roomKey?: unknown });
  } catch {
    roomKey = undefined;
  }
  if (typeof roomKey !== 'string' || !roomKey) {
    return NextResponse.json({ error: 'Hiányzó szoba' }, { status: 400 });
  }

  const isStaff = user.role === 'admin' || user.role === 'kozpont';

  // Bolt/trafik csak a neki kiosztott szobához kap tokent.
  if (!isStaff) {
    const scope = userScopeNumber(user);
    if (!scope) {
      return NextResponse.json({ error: 'Nincs bolt/trafik hozzárendelve' }, { status: 403 });
    }
    const supabase = await createClient();
    const { data: room } = await supabase
      .from('video_rooms')
      .select('id')
      .eq('room_key', roomKey)
      .maybeSingle();
    if (!room) return NextResponse.json({ error: 'Ismeretlen szoba' }, { status: 404 });
    const { data: assign } = await supabase
      .from('video_room_assignments')
      .select('id')
      .eq('room_id', room.id)
      .eq('store_number', scope)
      .maybeSingle();
    if (!assign) {
      return NextResponse.json({ error: 'Nincs jogosultság ehhez a szobához' }, { status: 403 });
    }
  }

  const token = signJaasToken({
    appId,
    keyId,
    privateKey,
    user: { id: user.id, name: user.username, email: user.email, moderator: isStaff },
  });

  return NextResponse.json({ configured: true, token, appId });
}
