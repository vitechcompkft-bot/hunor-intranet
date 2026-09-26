-- ============================================================================
-- 0005 — Videokonferencia szobák (admin által kiosztva)
-- ----------------------------------------------------------------------------
-- Korábban bárki beírhatott egy szabad szobanevet és csatlakozhatott. Új modell:
-- CSAK az admin hoz létre szobát, és megadja, mely boltok/trafikok tartoznak hozzá.
-- A kiosztott bolt/trafik a saját belépésekor CSAK ezt/ezeket a szobákat látja,
-- szabad szobanév-beírás nincs. A szoba Jitsi-azonosítója (room_key) kitalálhatatlan.
--
-- A store-scope (kinek melyik szoba jelenik meg) az app-rétegben dől el
-- (.eq('store_number', <munkamenet boltszáma>)), összhangban a 0004 megoldással
-- (megosztott fiókoknál a JWT nem hordoz store_number-t). Az RLS itt a
-- létrehozást/törlést köti adminhoz; az olvasás bejelentkezéshez.
-- ============================================================================

create table if not exists video_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- megjelenített név (pl. "Heti értekezlet")
  room_key text not null unique,      -- Jitsi szoba-azonosító (kitalálhatatlan)
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table video_rooms enable row level security;

create policy "select_video_rooms" on video_rooms for select to authenticated
  using (true);
create policy "admin_insert_video_rooms" on video_rooms for insert to authenticated
  with check (public.jwt_role() = 'admin');
create policy "admin_update_video_rooms" on video_rooms for update to authenticated
  using (public.jwt_role() = 'admin');
create policy "admin_delete_video_rooms" on video_rooms for delete to authenticated
  using (public.jwt_role() = 'admin');

create table if not exists video_room_assignments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references video_rooms(id) on delete cascade,
  store_number text not null,         -- bolt VAGY trafik szám
  created_at timestamptz default now(),
  unique (room_id, store_number)
);
alter table video_room_assignments enable row level security;

create policy "select_video_assignments" on video_room_assignments for select to authenticated
  using (true);
create policy "admin_insert_video_assignments" on video_room_assignments for insert to authenticated
  with check (public.jwt_role() = 'admin');
create policy "admin_delete_video_assignments" on video_room_assignments for delete to authenticated
  using (public.jwt_role() = 'admin');

create index if not exists idx_video_assignments_store on video_room_assignments (store_number);
create index if not exists idx_video_assignments_room on video_room_assignments (room_id);
