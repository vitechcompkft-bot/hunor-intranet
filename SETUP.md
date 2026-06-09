# HUNOR Intranet — beüzemelési útmutató

## 1. Supabase projekt létrehozása

1. Menj a [supabase.com](https://supabase.com) oldalra → **New project**.
2. Régiónak válaszd a hozzád legközelebbit (pl. *Central EU (Frankfurt)*).
3. A projekt elkészülte után: **Project Settings → API**, és másold ki:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` kulcs → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` kulcs → `SUPABASE_SERVICE_ROLE_KEY` (titkos!)

Ezeket írd be a `.env.local` fájlba (a placeholder értékek helyére).

## 2. Adatbázis séma futtatása

A `supabase/migrations/` mappában lévő SQL fájlokat **sorrendben** futtasd le a
Supabase **SQL Editor**-ában (vagy a Supabase CLI-vel):

1. `0001_schema.sql` — táblák, RLS, segédfüggvények, RPC
2. `0002_seed_and_storage.sql` — menü engedélyek, Storage bucket + szabályok

> SQL Editorban: nyisd meg a fájlt, másold be a tartalmát, **Run**.

## 3. Admin felhasználó létrehozása

A felhasználó létrehozása **2 lépés**: előbb az email+jelszó az Auth felületen,
majd a szerepkör (`role`) hozzáadása SQL-lel az `app_metadata`-hoz.

### 3/A — Email + jelszó

Dashboard → **Authentication → Users → „Add user" → „Create new user"**:
- Email: pl. `admin@hunor.hu`
- Password: erős jelszó
- ✅ **Auto Confirm User** bepipálva (hogy azonnal beléphessen)
- **Create user**

### 3/B — Szerepkör beállítása

Dashboard → **SQL Editor → New query**, majd **Run**:

```sql
-- Cseréld az emailt a valódira!
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
where email = 'admin@hunor.hu';
```

> Miért 2 lépés? A jelszót a Supabase Auth titkosítva tárolja (ezért az Auth
> felületen kell létrehozni), a szerepkör viszont saját adat — ezt tesszük az
> `app_metadata`-ba, ahonnan az RLS jogosultság-szabályok olvassák.

Bolti (viewer) felhasználó:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"viewer","store_number":"B001"}'::jsonb
where email = 'bolt1@hunor.hu';
```

Trafik felhasználó:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"trafik","trafik_number":"T01"}'::jsonb
where email = 'trafik1@hunor.hu';
```

Megjelenítendő név beállítása (opcionális):

```sql
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"username":"Kovács János"}'::jsonb
where email = 'bolt1@hunor.hu';
```

## 4. Bolt- és trafiklisták feltöltése

A bejelentkezési oldal legördülőihez (és az igénybekérőkhöz) kellenek:

```sql
insert into store_lists (type, number, label, sort_order) values
  ('store', 'B001', '1. számú bolt', 1),
  ('store', 'B002', '2. számú bolt', 2),
  ('trafik', 'T01', '1. trafik', 1);
```

(Ezeket később a **Beállítások → Bolt listák** felületen is kezelheted.)

## 5. Indítás

```powershell
npm run dev
```

Böngészőben: http://localhost:3204 → átirányít a `/login`-ra.
(A port a `package.json`-ban van rögzítve — `-p 3204` —, hogy ne ütközzön a
többi helyi Next projekttel.)

## 6. Google Drive — megosztott „Intranet" mappa (OAuth2)

A **Fájlok → Megosztott dokumentumok** fül a Google Drive egy közös „Intranet"
mappáját mutatja minden belépő felhasználónak (csak olvasás). Az admin **egyszer**
csatlakoztatja a céges Google fiókot (OAuth) — nincs szükség service account
kulcsra (azt sok cégnél tiltja a biztonsági szabály).

> Előfeltétel: futtasd a `0003_google_oauth.sql` migrációt is (SQL Editor).

### 6/A — OAuth consent screen

1. [Google Cloud Console](https://console.cloud.google.com) → projekt kiválasztása/létrehozása.
2. **APIs & Services → Library** → **Google Drive API** → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - Céges (Workspace) fióknál válaszd az **Internal** típust → így nincs külön verifikáció.
   - Töltsd ki az app nevét és a támogatási emailt → **Save**.

### 6/B — OAuth client ID

1. **APIs & Services → Credentials → + Create credentials → OAuth client ID**.
2. **Application type: Web application**.
3. **Authorized redirect URIs** → adj hozzá:
   - `http://localhost:3204/api/drive/oauth/callback` (fejlesztéshez)
   - (éles üzemnél a saját domained: `https://.../api/drive/oauth/callback`)
4. **Create** → megkapod a **Client ID**-t és **Client secret**-et.

### 6/C — Kulcsok a `.env.local`-ba

```
GOOGLE_OAUTH_CLIENT_ID=<a Client ID>
GOOGLE_OAUTH_CLIENT_SECRET=<a Client secret>
```

Opcionálisan a mappa ID is (az „Intranet" mappa URL-jének vége), különben név alapján keresi:

```
GOOGLE_DRIVE_INTRANET_FOLDER_ID=<mappa ID>
```

### 6/D — Csatlakoztatás

1. Indítsd újra a szervert (`npm run dev`).
2. Lépj be adminként → **Beállítások → Google Drive → „Google Drive csatlakoztatása"**.
3. Jelentkezz be a céges fiókkal, és engedélyezd a hozzáférést.
4. Kész — a **Fájlok → Megosztott dokumentumok** fülön megjelenik az „Intranet" mappa
   tartalma minden belépőnek.
