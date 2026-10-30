import type { NextConfig } from "next";

/**
 * Build-azonosító: a Vercel buildben a commit dátuma (Budapest idő) + rövid
 * commit-hash; lokálisan 'dev'. A `next build` mindig kiértékeli ezt a fájlt
 * (függetlenül attól, hogy a Vercel `next build`-et vagy `npm run build`-et
 * futtat), és env-ként befűzi, így a kliens és a /api/version is ugyanazt kapja.
 */
function computeBuildId(): string {
  if (!process.env.VERCEL) return "dev";
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("hu-HU", {
      timeZone: "Europe/Budapest",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  const dt = `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
  return sha ? `${dt} · ${sha}` : dt;
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: computeBuildId(),
  },
};

export default nextConfig;
