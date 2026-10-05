-- ============================================================================
-- 0006 — Hibajegy üzenet-szál (kérdés/válasz + utólagos képfeltöltés)
-- ----------------------------------------------------------------------------
-- A nyitott (nem "Lezárva") hibajegyekhez a bolt és a staff is írhat üzenetet,
-- kérdezhet/válaszolhat, és utólag képet/csatolmányt tölthet fel. A lezárás
-- (status='Lezárva') után nem bővíthető — ezt az app réteg érvényesíti.
-- Store-scope / olvasás app-rétegben (mint a bug_reports), írás bejelentkezéshez.
-- ============================================================================

create table if not exists bug_report_messages (
  id uuid primary key default gen_random_uuid(),
  bug_report_id uuid not null references bug_reports(id) on delete cascade,
  author_id uuid references auth.users(id),
  author_name text,                 -- megjelenített név (pl. "Bolt 4300" / "Központ")
  message text,
  attachment_path text,
  created_at timestamptz default now()
);
alter table bug_report_messages enable row level security;

create policy "select_bug_messages" on bug_report_messages for select to authenticated
  using (true);
create policy "insert_bug_messages" on bug_report_messages for insert to authenticated
  with check (true);
create policy "admin_delete_bug_messages" on bug_report_messages for delete to authenticated
  using (public.jwt_role() = 'admin');

create index if not exists idx_bug_messages_report on bug_report_messages (bug_report_id, created_at);
