// A HUNOR Coop Intranet felhasználói dokumentációja.
// EGY forrás: ezt jeleníti meg a Dokumentáció oldal ÉS ezt kapja a chatbot is.

export type DocBlock =
  | { type: 'p'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'tip'; text: string };

export interface DocSection {
  id: string;
  title: string;
  blocks: DocBlock[];
}

export const DOCUMENTATION: DocSection[] = [
  {
    id: 'altalanos',
    title: 'Általános tudnivalók',
    blocks: [
      {
        type: 'p',
        text: 'A HUNOR Coop Intranet a szövetkezet belső rendszere, amellyel a boltok és a központ tartják a kapcsolatot. Ebben a kézikönyvben a három legfontosabb funkció használatát találod: Fájlok, Hibajegyek és Fotók.',
      },
      {
        type: 'h3',
        text: 'Bejelentkezés',
      },
      {
        type: 'ol',
        items: [
          'Add meg az email címed és a jelszavad.',
          'Bolti vagy trafik felhasználóként válaszd ki a legördülőből az áruház- vagy trafikszámot.',
          'Kattints a „Bejelentkezés" gombra.',
        ],
      },
      {
        type: 'h3',
        text: 'Navigáció és kijelentkezés',
      },
      {
        type: 'ul',
        items: [
          'A menüpontok asztali gépen a bal oldali sávban, táblagépen a felső sorban találhatók.',
          'Kijelentkezni jobbra fent, a „Kilépés" gombbal tudsz.',
        ],
      },
    ],
  },
  {
    id: 'fajlok',
    title: 'Fájlok',
    blocks: [
      {
        type: 'p',
        text: 'A Fájlok menüpontban dokumentumokat érhetsz el és tölthetsz fel. Két fül található itt: „Megosztott dokumentumok" és „Saját mappa".',
      },
      {
        type: 'h3',
        text: 'Megosztott dokumentumok',
      },
      {
        type: 'p',
        text: 'Itt a központ által megosztott közös dokumentumokat éred el (például szabályzatok, árlisták, körlevelek, marketinganyagok). Ezeket megtekinteni és letölteni tudod.',
      },
      {
        type: 'ul',
        items: [
          'Mappába belépés: kattints a mappa nevére. A mappák a tartalom szerint vannak rendezve (pl. Marketing, Szabályzatok, Oktatási anyag).',
          'Fájl megnyitása vagy letöltése: kattints a fájl nevére — új lapon megnyílik, ahonnan letöltheted. A sor jobb szélén lévő ikonnal is megnyithatod.',
          'Visszalépés: a felső sorban lévő útvonalon (pl. „Intranet › Marketing") kattints arra a szintre, ahová vissza szeretnél lépni. A „Frissítés" ikonnal újratöltheted a mappát.',
        ],
      },
      {
        type: 'h3',
        text: 'Saját mappa',
      },
      {
        type: 'p',
        text: 'Ez a te boltod saját tárhelye. Ide olyan fájlokat tölthetsz fel, amelyeket csak a te boltod és a központ lát.',
      },
      {
        type: 'ul',
        items: [
          'Feltöltés: kattints a „Feltöltés" gombra, és válaszd ki a fájlt vagy fájlokat.',
          'Letöltés/megnyitás: kattints a fájl nevére.',
        ],
      },
      {
        type: 'h3',
        text: 'Mappa létrehozása és feltöltés (központ/admin)',
      },
      {
        type: 'p',
        text: 'A központi felhasználók a Megosztott dokumentumokba is feltölthetnek és mappát hozhatnak létre: lépj be abba a mappába, ahová dolgozni szeretnél, majd használd az „Új mappa" vagy a „Feltöltés" gombot.',
      },
      {
        type: 'tip',
        text: 'Egy feltöltött fájl mérete legfeljebb kb. 4 MB lehet. Ennél nagyobb dokumentumnál bontsd kisebb részekre, vagy jelezd a rendszergazdának.',
      },
    ],
  },
  {
    id: 'hibajegyek',
    title: 'Hibajegyek',
    blocks: [
      {
        type: 'p',
        text: 'A Hibajegyek menüpontban technikai hibát jelenthetsz be a központnak — például internet-, kassza-, nyomtató- vagy ügyfélkezelő-probléma esetén. A bejelentésről a központ azonnal értesül (Telegram üzenetben is).',
      },
      {
        type: 'h3',
        text: 'Új hibajegy beküldése',
      },
      {
        type: 'ol',
        items: [
          'Kattints az „Új hibajegy" gombra.',
          'Válaszd ki a hiba típusát a legördülőből (pl. Kassza probléma, Internet probléma, Nyomtató probléma, VPN zárolás, Egyéb).',
          'Állítsd be a prioritást aszerint, mennyire sürgős: Kritikus, Magas, Közepes vagy Alacsony.',
          'Írd le minél részletesebben a hibát a „Leírás" mezőben — mit tapasztalsz, mikor kezdődött, mit próbáltál már.',
          'Ha van, csatolj képet vagy fájlt (például a hibaüzenet fotóját) a „Csatolmány" résznél.',
          'Kattints a „Beküldés" gombra.',
        ],
      },
      {
        type: 'h3',
        text: 'A hibajegyeid követése',
      },
      {
        type: 'ul',
        items: [
          'A listában megjelennek a beküldött hibajegyeid és azok állapota: „Folyamatban" (még dolgoznak rajta) vagy „Lezárva" (megoldva).',
          'A „Befejezés" oszlopban a megoldás dátuma látszik.',
          'A „Megjegyzés" oszlopban a központ válasza vagy a megoldás rövid leírása olvasható.',
        ],
      },
      {
        type: 'tip',
        text: 'Minél pontosabb a leírás és a prioritás, annál gyorsabban tud segíteni a központ. Sürgős, üzletmenetet akadályozó hibánál (pl. nem indul a kassza) válaszd a „Kritikus" prioritást.',
      },
    ],
  },
  {
    id: 'fotok',
    title: 'Fotók',
    blocks: [
      {
        type: 'p',
        text: 'A Fotók menüpontban képeket tölthetsz fel a boltod saját mappájába a felhőben. A képek automatikusan nap szerinti mappákba rendeződnek, így később könnyen visszakereshetők.',
      },
      {
        type: 'h3',
        text: 'Kép feltöltése',
      },
      {
        type: 'ol',
        items: [
          'Kattints a „Kép feltöltése" gombra.',
          'Válaszd ki a képet (vagy egyszerre több képet) a készülékről — táblagépen akár a kamerával is készíthetsz.',
          'A feltöltés után a kép a mai dátumú mappádba kerül, időbélyeges névvel (például 2026-06-10_14-23-05.jpg). Ha aznap még nem volt mappa, automatikusan elkészül.',
        ],
      },
      {
        type: 'h3',
        text: 'A feltöltött képek megtekintése',
      },
      {
        type: 'ul',
        items: [
          'Feltöltés után rögtön megnyílik a mai napi mappa, ahol látod a friss képet.',
          'Korábbi napok képeihez a dátum-mappákra kattintva férsz hozzá. A „Vissza" gombbal léphetsz ki a mappából.',
        ],
      },
      {
        type: 'tip',
        text: 'A rendszer feltöltés előtt automatikusan kicsinyíti a képet, hogy gyors legyen a feltöltés — nem kell a fájlmérettel foglalkoznod. A központ minden bolt fotóit látja és letöltheti.',
      },
    ],
  },
];

/** A teljes dokumentáció egyszerű szövegként — a chatbot tudásbázisához. */
export function documentationText(): string {
  return DOCUMENTATION.map((section) => {
    const lines: string[] = [`## ${section.title}`];
    for (const b of section.blocks) {
      if (b.type === 'h3') lines.push(`\n### ${b.text}`);
      else if (b.type === 'p') lines.push(b.text);
      else if (b.type === 'tip') lines.push(`Tipp: ${b.text}`);
      else if (b.type === 'ul') b.items.forEach((i) => lines.push(`- ${i}`));
      else if (b.type === 'ol') b.items.forEach((i, idx) => lines.push(`${idx + 1}. ${i}`));
    }
    return lines.join('\n');
  }).join('\n\n');
}
