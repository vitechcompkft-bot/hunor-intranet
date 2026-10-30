// A build-azonosító a next.config.ts-ben generálódik (env: NEXT_PUBLIC_BUILD_ID),
// és build-időben ide inline-olódik. Lokálisan / env nélkül 'dev'. A kliens és a
// /api/version is innen olvassa, így egy deploymenten belül mindig egyezik.
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'dev';
