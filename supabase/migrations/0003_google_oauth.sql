-- ============================================================================
-- HUNOR Intranet — Google Drive OAuth token tárolása
-- ============================================================================
-- Egyetlen sor (id=1) tárolja a megosztott Google Drive hozzáférés tokenjeit.
-- SZÁNDÉKOSAN nincs RLS policy: csak a service_role (szerver) férhet hozzá,
-- a böngészőből (anon/authenticated kulcs) nem olvasható a refresh token.
-- ============================================================================
create table if not exists google_oauth_tokens (
  id smallint primary key default 1,
  refresh_token text,
  access_token text,
  token_expiry timestamptz,
  connected_email text,
  updated_at timestamptz default now(),
  constraint google_oauth_single_row check (id = 1)
);
alter table google_oauth_tokens enable row level security;
-- (nincs policy → csak service_role)
