import { createSign } from 'crypto';

/**
 * 8x8 JaaS (Jitsi as a Service) JWT aláírása a szerver oldalán, a beépített
 * Node crypto-val (nincs külső függőség). A token adja meg, ki csatlakozhat és
 * ki moderátor — így a szoba KÜLSŐ hitelesítés nélkül azonnal elindul (nincs
 * "várakozás a hostra", mint a nyilvános meet.jit.si-nél).
 *
 * Kulcsok a JaaS konzolból (env): JAAS_APP_ID (vpaas-magic-cookie-…),
 * JAAS_KEY_ID (az API kulcs azonosítója = kid), JAAS_PRIVATE_KEY (PEM).
 */
function base64url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

export interface JaasUser {
  id: string;
  name: string;
  email?: string;
  moderator: boolean;
}

export function signJaasToken(opts: {
  appId: string;
  keyId: string;
  privateKey: string;
  user: JaasUser;
  ttlSeconds?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', kid: opts.keyId, typ: 'JWT' };
  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    sub: opts.appId,
    room: '*',
    iat: now,
    nbf: now - 10,
    exp: now + (opts.ttlSeconds ?? 7200),
    context: {
      user: {
        id: opts.user.id,
        name: opts.user.name,
        email: opts.user.email ?? '',
        moderator: opts.user.moderator ? 'true' : 'false',
        'hidden-from-recorder': 'false',
      },
      features: {
        livestreaming: 'false',
        recording: 'false',
        transcription: 'false',
        'outbound-call': 'false',
      },
    },
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createSign('RSA-SHA256').update(signingInput).sign(opts.privateKey, 'base64url');
  return `${signingInput}.${signature}`;
}
