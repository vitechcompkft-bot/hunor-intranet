-- ============================================================================
-- HUNOR Intranet — seed adatok + Storage bucket és RLS
-- ============================================================================

-- --- Menü engedélyek alapértékei (viewer / kozpont / trafik) -----------------
insert into viewer_menu_permissions (menu_key, is_enabled) values
  ('documentation', true),
  ('chat', true),
  ('message', true),
  ('demand_form', true),
  ('bug_report', true),
  ('photo_submit', true),
  ('video_conference', true),
  ('store_folders', true)
on conflict (menu_key) do nothing;

insert into kozpont_menu_permissions (menu_key, is_enabled) values
  ('documentation', true),
  ('chat', true),
  ('message', true),
  ('demand_form', true),
  ('bug_report', true),
  ('photo_submit', true),
  ('video_conference', true),
  ('store_folders', true)
on conflict (menu_key) do nothing;

insert into trafik_menu_permissions (menu_key, is_enabled) values
  ('documentation', true),
  ('chat', true),
  ('message', true),
  ('bug_report', true),
  ('photo_submit', true),
  ('video_conference', true),
  ('store_folders', true)
on conflict (menu_key) do nothing;

-- --- Rendszer beállítások alapértékei ----------------------------------------
insert into system_settings (key, value) values
  ('enable_store_folder_quick_access', 'false')
on conflict (key) do nothing;

-- ============================================================================
-- Storage bucket: hunor-coop-files (privát)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('hunor-coop-files', 'hunor-coop-files', false)
on conflict (id) do nothing;

-- A fájlokhoz külön bucketet is használunk a hibajelentésekhez/fotókhoz,
-- de ezeket a hunor-coop-files bucketen belüli prefixekkel kezeljük:
--   <BOLTSZÁM>/...    → bolt mappák
--   bug-reports/...   → hibajelentés csatolmányok
--   photos/...        → feltöltött fotók

-- --- Storage RLS (storage.objects) -------------------------------------------
-- Olvasás: staff bárhol; bolt/trafik csak a saját mappájában; közös prefixek mindenkinek.
create policy "hunor_read_objects" on storage.objects for select to authenticated
using (
  bucket_id = 'hunor-coop-files' and (
    public.is_staff()
    or name like public.jwt_store() || '/%'
    or name like public.jwt_trafik() || '/%'
    or name like 'bug-reports/%'
    or name like 'photos/%'
  )
);

-- Feltöltés: staff bárhová; bolt/trafik a saját mappájába vagy a közös prefixekbe.
create policy "hunor_insert_objects" on storage.objects for insert to authenticated
with check (
  bucket_id = 'hunor-coop-files' and (
    public.is_staff()
    or name like public.jwt_store() || '/%'
    or name like public.jwt_trafik() || '/%'
    or name like 'bug-reports/%'
    or name like 'photos/%'
  )
);

-- Frissítés (átnevezés/áthelyezés): csak staff.
create policy "hunor_update_objects" on storage.objects for update to authenticated
using (bucket_id = 'hunor-coop-files' and public.is_staff());

-- Törlés: csak staff.
create policy "hunor_delete_objects" on storage.objects for delete to authenticated
using (bucket_id = 'hunor-coop-files' and public.is_staff());
