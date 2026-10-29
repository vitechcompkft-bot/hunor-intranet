/**
 * A bejelentkezéskor választott bolt/trafik szám munkamenet-szintű tárolása.
 *
 * FONTOS: a boltszám NEM a (több bolt által megosztott) auth-fiók
 * app_metadata-jában él, mert azt minden belépés globálisan felülírná — így
 * párhuzamos belépéseknél mindenki az utoljára belépő boltszámát kapta meg.
 * Helyette böngésző-munkamenetenként egy httpOnly cookie hordozza, amit a
 * szerver (getCurrentUser) olvas ki. Két különböző bolt két külön gépen/böngészőn
 * így egymástól függetlenül marad a saját boltszámán.
 */
export const SCOPE_COOKIE = 'hunor_scope';

/** localStorage kulcs az utolsó felhasználói aktivitás idejének (tétlenségi kiléptetés). */
export const ACTIVITY_KEY = 'hunor_last_activity';

/** Tétlenségi kiléptetés küszöbe (ms) — ennyi tétlenség után automatikus kilépés. */
export const IDLE_LOGOUT_MS = 60 * 60 * 1000; // 60 perc

/** Érvényes bolt/trafik szám formátum (pl. "4300", "B001", "T01"). */
export function isValidScope(value: string): boolean {
  return /^[\w.-]{1,16}$/.test(value);
}
