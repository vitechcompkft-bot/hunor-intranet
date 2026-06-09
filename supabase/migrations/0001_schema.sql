-- ============================================================================
-- HUNOR Intranet — adatbázis séma (táblák, RLS, segédfüggvények)
-- ============================================================================
-- Megjegyzés: minden RLS policy az app_metadata-ból olvassa a szerepkört és a
-- bolt/trafik számot (NEM a users táblát kérdezi le) — gyorsabb és biztonságosabb.
-- ============================================================================

-- --- Segédfüggvények a JWT app_metadata kiolvasásához -----------------------
create or replace function public.jwt_role() returns text
  language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
$$;

create or replace function public.jwt_store() returns text
  language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'store_number', '')
$$;

create or replace function public.jwt_trafik() returns text
  language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'trafik_number', '')
$$;

create or replace function public.is_staff() returns boolean
  language sql stable as $$
  select public.jwt_role() in ('admin', 'kozpont')
$$;

-- ============================================================================
-- store_lists — bolt és trafik számok referencia táblája
-- ============================================================================
create table if not exists store_lists (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('store', 'trafik')),
  number text not null,
  label text,
  sort_order integer default 0,
  created_at timestamptz default now()
);
alter table store_lists enable row level security;

create policy "anyone_read_store_lists" on store_lists for select to authenticated using (true);
create policy "anon_read_store_lists" on store_lists for select to anon using (true);
create policy "admin_insert_store_lists" on store_lists for insert to authenticated with check (public.jwt_role() = 'admin');
create policy "admin_update_store_lists" on store_lists for update to authenticated using (public.jwt_role() = 'admin');
create policy "admin_delete_store_lists" on store_lists for delete to authenticated using (public.jwt_role() = 'admin');

-- ============================================================================
-- login_attempts — bejelentkezési kísérletek naplója
-- ============================================================================
create table if not exists login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text,
  user_agent text,
  success boolean not null default false,
  error_message text,
  store_number text,
  created_at timestamptz default now()
);
alter table login_attempts enable row level security;

create policy "auth_insert_login_attempts" on login_attempts for insert to authenticated with check (true);
create policy "anon_insert_login_attempts" on login_attempts for insert to anon with check (true);
create policy "admin_select_login_attempts" on login_attempts for select to authenticated using (public.jwt_role() = 'admin');

-- ============================================================================
-- file_metadata — Supabase Storage fájlok metaadatai
-- ============================================================================
create table if not exists file_metadata (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_path text not null,
  folder_path text not null default '/',
  size bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
alter table file_metadata enable row level security;

create policy "auth_select_file_metadata" on file_metadata for select to authenticated using (true);
create policy "auth_insert_file_metadata" on file_metadata for insert to authenticated with check (true);
create policy "staff_delete_file_metadata" on file_metadata for delete to authenticated using (public.is_staff());

-- ============================================================================
-- store_messages — admin/központ → boltok üzenetek
-- ============================================================================
create table if not exists store_messages (
  id uuid primary key default gen_random_uuid(),
  store_number text not null,
  message text not null,
  sender_id uuid references auth.users(id),
  sender_name text,
  is_read boolean default false,
  read_at timestamptz,
  created_at timestamptz default now()
);
alter table store_messages enable row level security;

create policy "select_own_store_messages" on store_messages for select to authenticated
  using (public.jwt_store() = store_number or public.is_staff());
create policy "staff_insert_store_messages" on store_messages for insert to authenticated
  with check (public.is_staff());
create policy "update_own_store_messages" on store_messages for update to authenticated
  using (public.jwt_store() = store_number or public.is_staff());
create policy "staff_delete_store_messages" on store_messages for delete to authenticated
  using (public.is_staff());

-- ============================================================================
-- bug_reports — hibajelentések
-- ============================================================================
create table if not exists bug_reports (
  id uuid primary key default gen_random_uuid(),
  report_number serial,
  store_number text,
  bug_name text not null,
  bug_description text not null,
  attachment_path text,
  status text default 'Folyamatban' check (status in ('Folyamatban', 'Lezárva')),
  completion_date date,
  notes text,
  reported_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table bug_reports enable row level security;

create policy "select_own_bug_reports" on bug_reports for select to authenticated
  using (public.jwt_store() = store_number or public.jwt_trafik() = store_number or public.is_staff());
create policy "auth_insert_bug_reports" on bug_reports for insert to authenticated with check (true);
create policy "staff_update_bug_reports" on bug_reports for update to authenticated
  using (public.is_staff() or auth.uid() = reported_by);
create policy "admin_delete_bug_reports" on bug_reports for delete to authenticated
  using (public.jwt_role() = 'admin');

-- ============================================================================
-- demand_forms + assignments + responses — igénybekérő rendszer
-- ============================================================================
create table if not exists demand_forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  rows integer not null default 5,
  columns integer not null default 3,
  headers text[] default '{}',
  first_column text[] default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table demand_forms enable row level security;

create policy "select_demand_forms" on demand_forms for select to authenticated using (true);
create policy "staff_insert_demand_forms" on demand_forms for insert to authenticated with check (public.is_staff());
create policy "staff_update_demand_forms" on demand_forms for update to authenticated using (public.is_staff());
create policy "staff_delete_demand_forms" on demand_forms for delete to authenticated using (public.is_staff());

create table if not exists demand_form_assignments (
  id uuid primary key default gen_random_uuid(),
  demand_form_id uuid references demand_forms(id) on delete cascade,
  store_number text not null,
  created_at timestamptz default now()
);
alter table demand_form_assignments enable row level security;

create policy "select_assignments" on demand_form_assignments for select to authenticated using (true);
create policy "staff_insert_assignments" on demand_form_assignments for insert to authenticated with check (public.is_staff());
create policy "staff_delete_assignments" on demand_form_assignments for delete to authenticated using (public.is_staff());

create table if not exists demand_form_responses (
  id uuid primary key default gen_random_uuid(),
  demand_form_id uuid references demand_forms(id) on delete cascade,
  store_number text not null,
  responses jsonb default '{}',
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (demand_form_id, store_number)
);
alter table demand_form_responses enable row level security;

create policy "select_responses" on demand_form_responses for select to authenticated using (true);
create policy "insert_responses" on demand_form_responses for insert to authenticated with check (true);
create policy "update_own_responses" on demand_form_responses for update to authenticated
  using (public.jwt_store() = store_number or public.is_staff());

-- ============================================================================
-- photos — fotó feltöltések
-- ============================================================================
create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  store_number text,
  trafik_number text,
  photo_url text not null,
  caption text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table photos enable row level security;

create policy "select_photos" on photos for select to authenticated
  using (public.is_staff() or public.jwt_store() = store_number or public.jwt_trafik() = trafik_number);
create policy "insert_photos" on photos for insert to authenticated with check (true);
create policy "staff_delete_photos" on photos for delete to authenticated using (public.is_staff());

-- ============================================================================
-- invoices — számlák (bejövő B / kimenő K)
-- ============================================================================
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  sender text,
  invoice_type text check (invoice_type in ('B', 'K')),
  invoice_number text,
  notes text,
  net_amount numeric(12,2),
  vat_amount numeric(12,2),
  gross_amount numeric(12,2),
  invoice_status text default 'Kifizetésre vár' check (invoice_status in ('Kifizetésre vár', 'Kifizetve')),
  invoice_date date,
  store_number text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table invoices enable row level security;

create policy "staff_select_invoices" on invoices for select to authenticated using (public.is_staff());
create policy "staff_insert_invoices" on invoices for insert to authenticated with check (public.is_staff());
create policy "staff_update_invoices" on invoices for update to authenticated using (public.is_staff());
create policy "admin_delete_invoices" on invoices for delete to authenticated using (public.jwt_role() = 'admin');

-- ============================================================================
-- system_settings — kulcs-érték beállítások
-- ============================================================================
create table if not exists system_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table system_settings enable row level security;

create policy "select_system_settings" on system_settings for select to authenticated using (true);
create policy "admin_manage_system_settings" on system_settings for all to authenticated
  using (public.jwt_role() = 'admin') with check (public.jwt_role() = 'admin');

-- ============================================================================
-- *_menu_permissions — menü engedélyek
-- ============================================================================
create table if not exists viewer_menu_permissions (
  id uuid primary key default gen_random_uuid(),
  menu_key text unique not null,
  is_enabled boolean default true
);
alter table viewer_menu_permissions enable row level security;
create policy "select_viewer_perms" on viewer_menu_permissions for select to authenticated using (true);
create policy "admin_manage_viewer_perms" on viewer_menu_permissions for all to authenticated
  using (public.jwt_role() = 'admin') with check (public.jwt_role() = 'admin');

create table if not exists kozpont_menu_permissions (
  id uuid primary key default gen_random_uuid(),
  menu_key text unique not null,
  is_enabled boolean default true
);
alter table kozpont_menu_permissions enable row level security;
create policy "select_kozpont_perms" on kozpont_menu_permissions for select to authenticated using (true);
create policy "admin_manage_kozpont_perms" on kozpont_menu_permissions for all to authenticated
  using (public.jwt_role() = 'admin') with check (public.jwt_role() = 'admin');

create table if not exists trafik_menu_permissions (
  id uuid primary key default gen_random_uuid(),
  menu_key text unique not null,
  is_enabled boolean default true
);
alter table trafik_menu_permissions enable row level security;
create policy "select_trafik_perms" on trafik_menu_permissions for select to authenticated using (true);
create policy "admin_manage_trafik_perms" on trafik_menu_permissions for all to authenticated
  using (public.jwt_role() = 'admin') with check (public.jwt_role() = 'admin');

create table if not exists admin_menu_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  settings boolean default true,
  invoices boolean default true,
  work_assistant boolean default true,
  photo_download boolean default true,
  message boolean default true,
  demand_form boolean default true,
  bug_report boolean default true,
  chat boolean default true,
  video_conference boolean default true,
  documentation boolean default true,
  printers boolean default true
);
alter table admin_menu_permissions enable row level security;
create policy "select_admin_perms" on admin_menu_permissions for select to authenticated
  using (user_id = auth.uid() or public.jwt_role() = 'admin');
create policy "admin_manage_admin_perms" on admin_menu_permissions for all to authenticated
  using (public.jwt_role() = 'admin') with check (public.jwt_role() = 'admin');

-- ============================================================================
-- user_notes — admin saját jegyzetei
-- ============================================================================
create table if not exists user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  note text,
  created_at timestamptz default now()
);
alter table user_notes enable row level security;
create policy "select_own_notes" on user_notes for select to authenticated using (auth.uid() = user_id);
create policy "insert_own_notes" on user_notes for insert to authenticated with check (auth.uid() = user_id);
create policy "update_own_notes" on user_notes for update to authenticated using (auth.uid() = user_id);
create policy "delete_own_notes" on user_notes for delete to authenticated using (auth.uid() = user_id);

-- ============================================================================
-- RPC: bolt/trafik szám frissítése az app_metadata-ban
-- ============================================================================
create or replace function public.update_user_store_number(user_id uuid, new_store_number text)
returns void language plpgsql security definer
set search_path = public, auth
as $$
declare
  user_role text;
begin
  select raw_app_meta_data ->> 'role' into user_role from auth.users where id = user_id;
  if user_role = 'trafik' then
    update auth.users
      set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('trafik_number', new_store_number)
      where id = user_id;
  else
    update auth.users
      set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('store_number', new_store_number)
      where id = user_id;
  end if;
end;
$$;
