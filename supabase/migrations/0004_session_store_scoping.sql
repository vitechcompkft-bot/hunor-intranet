-- ============================================================================
-- 0004 — Munkamenet-szintű bolt-scope
-- ----------------------------------------------------------------------------
-- A boltok közös (szerep-alapú) auth-fiókkal lépnek be, és belépéskor
-- választanak boltszámot. Korábban ez a szám a fiók app_metadata-jába íródott
-- (update_user_store_number RPC), amit MINDEN belépés globálisan felülírt —
-- így párhuzamos belépéseknél mindenki az utoljára belépő boltszámát (pl. 4300)
-- kapta meg, és a már bent lévők boltszáma is átíródott.
--
-- Az új megoldásban a boltszám munkamenet-szintű httpOnly cookie-ban él
-- (lásd: src/lib/scope.ts, src/app/api/session/store/route.ts). Ezért a JWT
-- app_metadata már NEM hordoz store_number-t a megosztott fiókokhoz, és az
-- eddig jwt_store()/jwt_trafik()-ra épülő RLS store-szűrés nem működne
-- (a bolt üres store-ral semmit sem látna). A tényleges bolt-szűrést az
-- alkalmazás végzi (.eq('store_number', <munkamenet boltszáma>)); az RLS itt
-- csak a bejelentkezettséget garantálja. Megosztott fiókoknál a boltok közti
-- DB-szintű elszigetelés amúgy is látszólagos volt (azonos auth.uid()).
-- ============================================================================

-- --- store_messages: bolt olvassa a saját üzeneteit, olvasottnak jelöli ------
drop policy if exists "select_own_store_messages" on store_messages;
create policy "select_own_store_messages" on store_messages for select to authenticated
  using (true);

drop policy if exists "update_own_store_messages" on store_messages;
create policy "update_own_store_messages" on store_messages for update to authenticated
  using (true);

-- --- bug_reports: bolt olvassa a saját hibajegyeit ---------------------------
drop policy if exists "select_own_bug_reports" on bug_reports;
create policy "select_own_bug_reports" on bug_reports for select to authenticated
  using (true);

-- --- demand_form_responses: bolt frissíti a saját válaszát (upsert) ----------
drop policy if exists "update_own_responses" on demand_form_responses;
create policy "update_own_responses" on demand_form_responses for update to authenticated
  using (true);
