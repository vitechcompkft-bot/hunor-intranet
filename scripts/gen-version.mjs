// Build-idejű verzió-azonosító generálása a src/lib/version.ts-be.
// Csak a Vercel buildben ír valódi értéket (dátum + rövid commit-hash), hogy a
// lokális build ne írja át a committolt 'dev' alapértéket. Egyszer fut
// (a package.json "build" scriptjében a next build ELŐTT), így a kliens és a
// szerver ugyanazt az azonosítót kapja egy deploymenten belül.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'src', 'lib', 'version.ts');

function build() {
  const onVercel = Boolean(process.env.VERCEL);
  if (!onVercel) return 'dev';
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('hu-HU', {
      timeZone: 'Europe/Budapest',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  const dt = `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
  return sha ? `${dt} · ${sha}` : dt;
}

const id = build();
writeFileSync(
  target,
  `// Build-időben generált fájl (scripts/gen-version.mjs). NE szerkeszd kézzel.\nexport const BUILD_ID = ${JSON.stringify(
    id
  )};\n`,
  'utf8'
);
console.log('[gen-version] BUILD_ID =', id);
