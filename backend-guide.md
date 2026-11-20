# Backend Guide: Lourdes Boilerplate

Panduan sisi **database & server** untuk app yang dibangun dari `lourdes-boilerplate`. Pasangan dari
[`frontend-guide.md`](frontend-guide.md): setiap fitur frontend di sana punya tabel, fungsi, dan aturan
akses di sini.

Kondisi per **18 Nov 2026**. SQL di dokumen ini adalah **rancangan acuan** untuk menyusun file `db/`
boilerplate. Setiap file wajib di-dry-run dan diuji (§14) sebelum di-push.

---

## 0. Posisi dokumen

| Dokumen | Isi |
|---|---|
| `lourdes-db/docs/claude-app-guide.md` | Fakta platform, alur migration, aturan wajib Claude |
| `lourdes-db/docs/standar-app.md` | Standar repo app (keamanan, pola kode, DB per app, deploy) |
| **`backend-guide.md`** | **Ini.** Modul DB boilerplate: approval engine, notifikasi, push, log, CCTV, retensi, dsb. |
| `frontend-guide.md` | Rasa UI/UX dan pemakaian modul-modul ini di frontend |

**Aturan yang tidak berubah** (dari standar, wajib):

1. Semua perubahan skema = migration di `~/project/lourdes-db/supabase/migrations/`. Dry-run → tunjukkan
   ke user → **konfirmasi** → push. Repo app tidak punya `supabase/migrations`.
2. Setiap tabel: RLS aktif, satu policy per aksi, helper dibungkus `(select …)`, FK ber-index,
   `comment on table`.
3. Schema `public` hanya diubah dengan izin eksplisit user. Perubahan platform yang **sudah disetujui**
   untuk boilerplate ada di §2.
4. App tidak membuat/menghapus/memblokir user dan tidak mengubah profil orang lain.
5. Secret key Supabase tidak dipasang di app. Semua modul di sini jalan dengan sesi user + RLS + fungsi
   `security definer` yang mengecek akses sendiri.

---

## 1. Peta data

```
public (platform, dikelola lourdes-db)
├─ profiles, departments, job_titles, locations      (sudah ada)
├─ apps, app_access, audit_log, bucket avatars       (sudah ada)
├─ ★ companies               master perusahaan (§2.1)
├─ ★ cctv_events             jejak aksi penting SEMUA app → konsol monitoring "CCTV" (§2.2)
└─ ★ run_maintenance_all()   pemicu retensi & pengingat harian semua app (§2.3)

<app_id> (satu schema per app)
├─ members                    data user khusus app
├─ <dokumen>, <dokumen>_items domain app
├─ <dokumen>_logs             riwayat per dokumen (trigger)          → sebagian dikirim ke CCTV
├─ doc_sequences              penomoran dokumen
├─ approval_*                 approval engine generik (§6)
├─ followups
├─ notifications, push_subscriptions
├─ support_threads, support_messages        (Bantuan Admin)
├─ feedback
├─ updates, update_reactions, update_comments, update_seen   (Update Web)
├─ maintenance_runs, *_logs_archive
└─ bucket <app>-lampiran, <app>-media
```

**Prinsip pembagian:**

- Modul (notifikasi, Bantuan, Feedback, Update Web, approval) **per app**: admin app yang menangani, dan
  app hanya menulis schema miliknya.
- **CCTV terpusat**: setiap app mengirim aksi penting ke `public.cctv_events`, sehingga tim IT bisa
  melacak lintas app dari satu konsol.

---

## 2. Perubahan platform (schema `public`)

Ditulis **sekali** di `lourdes-db` (bukan per app), dengan nama migration `<ts>_platform_<deskripsi>.sql`.
Disetujui user 18 Nov 2026. Tetap melalui dry-run + konfirmasi sebelum push.

### 2.1 `public.companies`

```sql
create table public.companies (
  code                text primary key check (code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
  name                text not null check (length(btrim(name)) between 1 and 200),
  short_name          text not null check (length(btrim(short_name)) between 1 and 30),
  address             text check (length(address) <= 500),
  phone               text check (length(phone) <= 50),
  email               text check (length(email) <= 200),
  logo_url            text,
  logo_landscape_url  text,
  accent              text not null default 'zinc' check (accent ~ '^[a-z][a-z0-9-]{1,30}$'),
  is_group            boolean not null default false,   -- true = mencakup semua anak perusahaan (LOURDES)
  sort_order          integer not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.companies is
  'Master perusahaan grup Lourdes. Dikelola platform admin (konsol monitoring); nonaktifkan, jangan hapus.';

insert into public.companies (code, name, short_name, address, phone, email, logo_url, logo_landscape_url, accent, is_group, sort_order) values
  ('GMI', 'PT. Garuda Mart Indonesia', 'GMI', 'Sakura Regency Blok J5-8A, Jatiasih, Bekasi 17423 - Indonesia',
   '(021) 824-073-09', 'info@garudamart.com', '/gmi-logo.webp', '/gmi-landscape-stroke.webp', 'gmi', false, 1),
  ('GIS', 'PT. Global Inti Sejati', 'GIS', 'Jl. Wibawa Mukti II No.88, RT.003/RW.001, Jatiluhur, Kec. Jatiasih, Kota Bks, Jawa Barat 17425',
   '(021) 82-741-900', 'info@globalinti.com', '/gis-logo.webp', '/gis-landscape.webp', 'gis', false, 2),
  ('LOURDES', 'Lourdes Auto Parts', 'Lourdes', 'Sakura Regency J5-8A, Jati Asih, Bekasi 17423',
   '(+021) 82407309', 'info@garudamart.com', '/lourdes-logo.webp', '/lourdes-logo.webp', 'zinc', true, 0);

create trigger companies_set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger audit_companies after insert or update or delete on public.companies
  for each row execute function public.audit_row();

alter table public.companies enable row level security;
revoke all on public.companies from anon;
grant select, insert, update on public.companies to authenticated;
create policy "companies: staff read" on public.companies
  for select to authenticated using (true);
create policy "companies: platform admin insert" on public.companies
  for insert to authenticated with check ((select public.is_platform_admin()));
create policy "companies: platform admin update" on public.companies
  for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
```

`profiles.company` dipindah ke FK dalam **dua tahap** (app lama tetap jalan):

| Tahap | Migration | Kapan |
|---|---|---|
| 1 | `alter table public.profiles add constraint profiles_company_fkey foreign key (company) references public.companies(code);` | Bersama tabel di atas |
| 2 | `alter table public.profiles drop constraint profiles_company_check;` + generalisasi aturan NRP | Setelah konsol monitoring punya menu Perusahaan |

> **Catatan NRP:** `profiles_company_nrp` dan kolom `nrp_gmi`/`nrp_gis` masih khusus GMI/GIS. Sebelum
> company baru bisa dipakai di profil, aturan NRP perlu dirancang ulang, misalnya tabel
> `public.profile_company_ids (profile_id, company_code, nrp)`. Ini keputusan platform terpisah
> ([§16](#16-hal-terbuka)).

### 2.2 `public.cctv_events` (fitur "CCTV")

Rekaman **append-only** dari aksi penting di semua app. Tujuannya audit dan tracing: siapa melakukan apa,
di app mana, terhadap dokumen apa, kapan, dari perangkat apa.

```sql
create table public.cctv_events (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  app_id        text not null references public.apps(id),
  actor_id      uuid references public.profiles(id) on delete set null,   -- null = sistem / publik
  actor_name    text,                                                     -- salinan nama saat kejadian
  category      text not null check (category in
                  ('auth', 'access', 'approval', 'data', 'export', 'security', 'config', 'public')),
  action        text not null check (action ~ '^[a-z][a-z0-9_.]{1,80}$'),  -- mis. pengajuan.approve
  severity      text not null default 'info' check (severity in ('info', 'notice', 'warning', 'critical')),
  entity        text,                    -- nama tabel/jenis data
  record_id     text,
  record_label  text,                    -- kode dokumen (PJ/GMI/2611/0042)
  company_code  text,
  summary       text not null check (length(summary) between 1 and 500),     -- kalimat Indonesia
  url           text check (url is null or url ~ '^https://'),
  changes       jsonb,                   -- {"kolom": {"old": …, "new": …}}
  metadata      jsonb,                   -- catatan, alasan, jumlah baris export, dll.
  client        jsonb,                   -- {ip, user_agent, path} dari server app
  constraint cctv_events_size check (pg_column_size(changes) + pg_column_size(metadata) + pg_column_size(client) < 16384)
);
comment on table public.cctv_events is
  'CCTV: jejak aksi penting semua app (append-only). Ditulis lewat public.cctv_log(); dibaca konsol monitoring. Retensi 5 tahun.';

create index cctv_events_at_idx       on public.cctv_events (at desc);
create index cctv_events_app_idx      on public.cctv_events (app_id, at desc);
create index cctv_events_actor_idx    on public.cctv_events (actor_id, at desc);
create index cctv_events_record_idx   on public.cctv_events (app_id, entity, record_id, at desc);
create index cctv_events_severity_idx on public.cctv_events (severity, at desc) where severity in ('warning', 'critical');

alter table public.cctv_events enable row level security;
revoke all on public.cctv_events from anon, authenticated;
grant select on public.cctv_events to authenticated;
-- Platform admin lihat semua; admin app hanya event app-nya.
create policy "cctv_events: platform admin or app admin read" on public.cctv_events
  for select to authenticated
  using ((select public.is_platform_admin()) or public.has_app_role(app_id, 'admin'));

-- Append-only: tidak ada yang boleh mengubah/menghapus, kecuali job retensi (§2.3).
create or replace function public.cctv_events_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('lourdes.retention', true) = 'on' then
    return old;
  end if;
  raise exception 'Rekaman CCTV tidak boleh diubah atau dihapus' using errcode = '42501';
end $$;
create trigger cctv_events_immutable before update or delete on public.cctv_events
  for each row execute function public.cctv_events_immutable();
```

Satu-satunya pintu tulis:

```sql
create or replace function public.cctv_log(
  p_app          text,
  p_category     text,
  p_action       text,
  p_summary      text,
  p_severity     text  default 'info',
  p_entity       text  default null,
  p_record_id    text  default null,
  p_record_label text  default null,
  p_company_code text  default null,
  p_url          text  default null,
  p_changes      jsonb default null,
  p_metadata     jsonb default null,
  p_client       jsonb default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := (select auth.uid());
  v_name text;
  v_id   bigint;
begin
  -- User login wajib punya akses ke app yang dilaporkan (tidak bisa memalsukan event app lain).
  -- auth.uid() null = dipanggil fungsi internal/job (postgres) atau halaman publik lewat fungsi definer.
  if v_uid is not null and not public.has_app_role(p_app, 'viewer') then
    raise exception 'Tidak punya akses ke app %', p_app using errcode = '42501';
  end if;
  if v_uid is not null then
    select full_name into v_name from public.profiles where id = v_uid;
  end if;

  insert into public.cctv_events (app_id, actor_id, actor_name, category, action, severity, entity,
    record_id, record_label, company_code, summary, url, changes, metadata, client)
  values (p_app, v_uid, v_name, p_category, p_action, p_severity, p_entity,
    p_record_id, left(p_record_label, 100), p_company_code, left(p_summary, 500), p_url, p_changes, p_metadata,
    case when p_client is null then null else jsonb_build_object(
      'ip', left(p_client ->> 'ip', 64), 'user_agent', left(p_client ->> 'user_agent', 300), 'path', left(p_client ->> 'path', 300)) end)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.cctv_log(text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.cctv_log(text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, jsonb) to authenticated, service_role;
```

Isi dan taksonomi event ada di [§9](#9-cctv-apa-yang-direkam). `public.audit_log` tetap ada untuk
perubahan data platform (profil, akses, master). Konsol CCTV menampilkan keduanya dalam satu timeline.

### 2.3 Pemicu maintenance harian

Sama dengan pola backup dan kolektor monitoring: **systemd timer di VPS** + `docker exec` (tidak ada
`pg_cron`, tidak ada container tambahan).

```sql
create table public.maintenance_runs (
  id       bigint generated always as identity primary key,
  ran_at   timestamptz not null default now(),
  result   jsonb not null
);
comment on table public.maintenance_runs is 'Hasil run_maintenance_all() harian (dibaca konsol monitoring).';
alter table public.maintenance_runs enable row level security;
revoke all on public.maintenance_runs from anon, authenticated;
grant select on public.maintenance_runs to authenticated;
create policy "maintenance_runs: platform admin read" on public.maintenance_runs
  for select to authenticated using ((select public.is_platform_admin()));

create or replace function public.run_maintenance_all()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r      record;
  v_res  jsonb;
  v_all  jsonb := '{}';
  v_cctv integer;
begin
  -- Setiap app aktif yang punya fungsi <app>.run_maintenance()
  for r in
    select a.id from public.apps a
    where a.is_active
      and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = a.id and p.proname = 'run_maintenance')
  loop
    begin
      execute format('select %I.run_maintenance()', r.id) into v_res;
      v_all := v_all || jsonb_build_object(r.id, v_res);
    exception when others then
      v_all := v_all || jsonb_build_object(r.id, jsonb_build_object('error', sqlerrm));
    end;
  end loop;

  -- Retensi CCTV: 5 tahun
  perform set_config('lourdes.retention', 'on', true);
  delete from public.cctv_events where at < now() - interval '5 years';
  get diagnostics v_cctv = row_count;
  perform set_config('lourdes.retention', '', true);

  v_all := v_all || jsonb_build_object('cctv_deleted', v_cctv);
  insert into public.maintenance_runs (result) values (v_all);
  delete from public.maintenance_runs where ran_at < now() - interval '1 year';
  return v_all;
end $$;
revoke execute on function public.run_maintenance_all() from public, anon, authenticated;
```

Unit di VPS (file disimpan di `lourdes-db/infra/maintenance/`, pasang seperti `infra/backup/`):

```ini
# lourdes-maintenance.service
[Service]
Type=oneshot
ExecStart=/usr/bin/docker exec lourdes-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "select public.run_maintenance_all()"

# lourdes-maintenance.timer   (03:00 WIB = 20:00 UTC, setelah backup 02:00 WIB)
[Timer]
OnCalendar=*-*-* 20:00:00 UTC
Persistent=true
[Install]
WantedBy=timers.target
```

Pemasangan timer adalah perubahan VPS, jadi **minta izin user** dan jangan menyentuh container
`supabase-*` milik wms-gmi.

---

## 3. Konvensi tambahan boilerplate

Melengkapi standar §7.

### 3.1 Kolom standar tabel dokumen

```sql
create table __APP__.pengajuan (
  id            uuid primary key default gen_random_uuid(),
  code          text unique,                                  -- diisi saat diajukan (§5)
  company_code  text not null references public.companies(code),
  department_id uuid references public.departments(id),
  status        text not null default 'draft'
                check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'cancelled', 'completed')),
  title         text not null check (length(btrim(title)) between 1 and 200),
  total_amount  numeric(18,2) not null default 0 check (total_amount >= 0),
  search_text   text,                                         -- diisi trigger, untuk pencarian (§10)
  verify_token  uuid unique default gen_random_uuid(),        -- hanya kalau modul verifikasi aktif (§11)
  created_by    uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

| Kolom | Aturan |
|---|---|
| `code` | Nomor dokumen dari `next_doc_number()`, **bukan** dari client |
| `company_code` | FK `public.companies`, wajib di setiap dokumen; dipakai RLS scope (§4) |
| `status` | `text check (...)`. Label Indonesia di `lib/<domain>-rules.ts`. **Hanya berubah lewat RPC/engine** (guard §6.6) |
| `search_text` | `lower()` gabungan kolom yang dicari + isi item, diisi trigger. Index trigram |
| `created_by` | Default `auth.uid()`, tidak dari form |

### 3.2 Fungsi

- Default `security invoker`. `security definer` hanya kalau perlu, dan **wajib**:
  `set search_path = ''`, nama lengkap `schema.objek`, cek akses di baris awal.
- **Wajib revoke.** Default privileges schema app memberi `execute` ke `authenticated` untuk **semua**
  fungsi baru. Fungsi internal (dipanggil fungsi lain atau trigger) wajib di-`revoke execute … from
  public, anon, authenticated` tepat setelah dibuat.
- Default privileges juga memberi `insert/update/delete` tabel ke `authenticated`. Tabel yang hanya boleh
  ditulis lewat RPC/trigger (log, approvals, notifications, sequences) wajib `revoke insert, update,
  delete … from authenticated`. RLS saja tidak cukup jelas.
- RPC yang memicu notifikasi **mengembalikan `jsonb`** berisi `notification_ids`, supaya server app bisa
  mengirim Web Push (§7.3).

### 3.3 Error untuk user

| Kasus | `errcode` | Ditampilkan di app |
|---|---|---|
| Aturan bisnis, pesan untuk user ("Masih menunggu approver sebelumnya.") | `P0001` | **Pesan apa adanya** (Bahasa Indonesia, sopan, menyebut langkah berikutnya) |
| Akses ditolak tanpa perlu penjelasan | `42501` | "Anda tidak punya izin untuk aksi ini." + event CCTV `security` |
| Constraint (`23505`, `23503`, `23514`, …) | bawaan | Pesan umum dari `dbError()` |

Boilerplate menambah satu kasus di `dbError()` (`lib/action-state.ts`):

```ts
case "P0001":
  return fail(e.message); // pesan bisnis dari RPC, sudah Bahasa Indonesia
```

Karena itu **pesan `P0001` tidak boleh berisi detail teknis atau data orang lain.**

### 3.4 Konteks log dalam transaksi

RPC memberi tahu trigger log "aksi apa ini" lewat setting transaksi, sehingga satu aksi = satu baris log
dengan nama aksi yang benar (bukan "update" generik):

```sql
create or replace function __APP__.set_log_context(p_action text, p_note text)
returns void language sql set search_path = '' as $$
  select set_config('app.log_action', coalesce(p_action, ''), true),
         set_config('app.log_note',   coalesce(p_note, ''),   true);
$$;
revoke execute on function __APP__.set_log_context(text, text) from public, anon, authenticated;
```

---

## 4. Scope perusahaan

```sql
-- '{*}' = semua (platform admin, company grup, akun IT tanpa company)
-- '{}'  = tidak ada (profil tidak ditemukan / nonaktif) → aman secara default
create or replace function __APP__.my_company_scope()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when public.is_platform_admin() or p.company is null or c.is_group then array['*']
      else array[p.company] || coalesce((select array_agg(g.code) from public.companies g where g.is_group), '{}')
    end
    from public.profiles p
    left join public.companies c on c.code = p.company
    where p.id = (select auth.uid()) and p.is_active
  ), '{}');
$$;
```

Dipakai di policy (dievaluasi sekali per query karena dibungkus `select`):

```sql
create policy "pengajuan: viewer read" on __APP__.pengajuan for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer'))
         and ('*' = any ((select __APP__.my_company_scope()))
              or company_code = any ((select __APP__.my_company_scope()))));
```

- Policy insert/update memakai syarat scope yang sama di `with check`, sehingga user GMI tidak bisa
  membuat dokumen GIS.
- Loader app tetap memfilter dengan `companyScope()` (frontend §16), supaya hitungan dan export cocok.

---

## 5. Penomoran dokumen

Format default: `<PREFIX>/<COMPANY>/<YYMM>/<NNNN>`, contohnya `PJ/GMI/2611/0042`. Nomor urut direset per
bulan, per jenis, per company. Dihitung di DB secara atomik, sehingga tidak bentrok saat dua orang
mengajukan bersamaan.

```sql
create table __APP__.doc_sequences (
  prefix        text not null,
  company_code  text not null,
  period        text not null,               -- YYMM (WIB)
  last_no       integer not null default 0,
  primary key (prefix, company_code, period)
);
comment on table __APP__.doc_sequences is 'Counter nomor dokumen; hanya ditulis next_doc_number().';
alter table __APP__.doc_sequences enable row level security;
revoke insert, update, delete on __APP__.doc_sequences from authenticated;
create policy "doc_sequences: admin read" on __APP__.doc_sequences for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));

create or replace function __APP__.next_doc_number(p_prefix text, p_company text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_period text := to_char(now() at time zone 'Asia/Jakarta', 'YYMM');
  v_no     integer;
begin
  insert into __APP__.doc_sequences as s (prefix, company_code, period, last_no)
  values (p_prefix, p_company, v_period, 1)
  on conflict (prefix, company_code, period) do update set last_no = s.last_no + 1
  returning last_no into v_no;
  return format('%s/%s/%s/%s', p_prefix, p_company, v_period, lpad(v_no::text, 4, '0'));
end $$;
revoke execute on function __APP__.next_doc_number(text, text) from public, anon, authenticated;
```

Kapan nomor dibuat:

| Jenis dokumen | Kapan | Caranya |
|---|---|---|
| Dengan approval | **Saat diajukan** (draft tidak memakan nomor) | Di hook `on_done(…, 'submitted')`: `code = coalesce(code, next_doc_number('PJ', company_code))` |
| Tanpa approval | Saat dibuat | Trigger `before insert`: `new.code := coalesce(new.code, __APP__.next_doc_number(tg_argv[0], new.company_code))` |

Di UI, draft menampilkan "Draft · nomor dibuat saat diajukan" (frontend §9).

---

## 6. Approval engine generik

Satu engine untuk semua jenis dokumen. App cukup **mendaftarkan** jenis dokumennya (§6.5).

### 6.1 Konsep

```
approval_doc_types ── jenis dokumen terdaftar + 2 fungsi hook (context, on_done)
approval_templates ── aturan jalur: per jenis, (opsional) per company/departemen/rentang nominal
  └ approval_template_steps ── urutan langkah: tipe + approver (user tetap / kepala departemen)
department_heads ── kepala departemen per company (diatur admin app)

approvals ── langkah nyata per dokumen per putaran (round): pending → approved/rejected/skipped
followups ── permintaan follow-up ke approver yang sedang giliran
```

Alur:

```
draft ──approval_start──▶ pending_approval ──approve (langkah terakhir)──▶ approved
                              │   └─approve (bukan terakhir)──▶ giliran berikutnya (tetap pending_approval)
                              ├─reject──▶ rejected ──(ubah, ajukan ulang = round baru)──▶ pending_approval
                              └─approval_cancel (pemohon)──▶ draft
```

- **Berurutan**: hanya langkah pending dengan `step_no` terkecil yang bisa diproses.
- Tipe langkah: `mengetahui`, `memeriksa`, `menyetujui`. Semuanya harus dilewati. Tipe hanya
  label/makna.
- Approver = pemohon sendiri → langkah otomatis `skipped` ("Dilewati: approver adalah pemohon").
- Ditolak → sisa langkah `skipped`. Ajukan ulang → `round` baru dari template yang berlaku saat itu.
- Approver **tidak perlu role `editor`**. Cukup punya akses app (`viewer`) dan tercatat sebagai approver
  langkah itu.

### 6.2 Tabel

```sql
create type __APP__.approval_context as (
  requester_id   uuid,
  company_code   text,
  department_id  uuid,
  amount         numeric,
  code           text
);

create table __APP__.approval_doc_types (
  code         text primary key check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  label        text not null,                 -- "Pengajuan"
  table_name   text not null,                 -- tabel dokumen di schema app (punya <table>_logs)
  href_prefix  text not null check (href_prefix ~ '^/.*/$'),   -- "/pengajuan/"
  context_fn   regprocedure not null,         -- fn(uuid) returns approval_context
  on_done_fn   regprocedure not null,         -- fn(uuid, text) returns void
  is_active    boolean not null default true
);
comment on table __APP__.approval_doc_types is 'Registry jenis dokumen yang memakai approval engine. Diisi migration, bukan dari app.';

create table __APP__.approval_templates (
  id             uuid primary key default gen_random_uuid(),
  doc_type       text not null references __APP__.approval_doc_types(code),
  name           text not null check (length(btrim(name)) between 1 and 120),
  description    text check (length(description) <= 500),
  company_code   text references public.companies(code),        -- null = semua company
  department_id  uuid references public.departments(id),        -- null = semua departemen
  min_amount     numeric(18,2),
  max_amount     numeric(18,2),
  priority       integer not null default 0,
  is_active      boolean not null default true,
  created_by     uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (min_amount is null or max_amount is null or min_amount <= max_amount)
);

create table __APP__.approval_template_steps (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid not null references __APP__.approval_templates(id) on delete cascade,
  step_no        integer not null check (step_no between 1 and 20),
  approval_type  text not null check (approval_type in ('mengetahui', 'memeriksa', 'menyetujui')),
  approver_kind  text not null check (approver_kind in ('user', 'department_head')),
  approver_id    uuid references public.profiles(id),
  due_hours      integer check (due_hours between 1 and 720),   -- batas waktu (SLA), opsional
  unique (template_id, step_no),
  check ((approver_kind = 'user') = (approver_id is not null))
);

create table __APP__.department_heads (
  department_id  uuid not null references public.departments(id),
  company_code   text not null references public.companies(code),
  user_id        uuid not null references public.profiles(id),
  updated_at     timestamptz not null default now(),
  primary key (department_id, company_code)
);

create table __APP__.approvals (
  id             uuid primary key default gen_random_uuid(),
  doc_type       text not null references __APP__.approval_doc_types(code),
  record_id      uuid not null,
  round          integer not null default 1,
  step_no        integer not null,
  approval_type  text not null,
  approver_id    uuid not null references public.profiles(id),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'skipped')),
  note           text check (length(note) <= 1000),
  decided_at     timestamptz,
  due_hours      integer,
  due_at         timestamptz,
  reminded_at    timestamptz,
  template_id    uuid references __APP__.approval_templates(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (doc_type, record_id, round, step_no)
);
create index approvals_record_idx  on __APP__.approvals (doc_type, record_id, round, step_no);
create index approvals_pending_idx on __APP__.approvals (approver_id) where status = 'pending';

create table __APP__.followups (
  id            uuid primary key default gen_random_uuid(),
  approval_id   uuid not null references __APP__.approvals(id) on delete cascade,
  requested_by  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  requested_at  timestamptz not null default now()
);
create index followups_approval_idx on __APP__.followups (approval_id, requested_at desc);
```

RLS ringkas (semua tabel `enable row level security`):

| Tabel | select | insert/update/delete |
|---|---|---|
| `approval_doc_types` | viewer | tidak ada (migration saja) |
| `approval_templates`, `approval_template_steps`, `department_heads` | viewer | **admin** app (halaman builder template) |
| `approvals`, `followups` | viewer | tidak ada (`revoke`); hanya lewat RPC |

Perubahan template tidak mengubah dokumen yang sedang berjalan (langkahnya sudah disalin ke
`approvals`). Template + kepala departemen diberi trigger log, dan perubahannya dikirim ke CCTV kategori
`config`.

### 6.3 RPC

Semua `security definer`, `set search_path = ''`, cek akses di awal, dan mengembalikan `jsonb` dengan
`notification_ids`.

| RPC | Siapa | Fungsi |
|---|---|---|
| `approval_start(doc_type, record_id)` | Pemohon / editor | Pilih template, salin langkah, nomor dokumen, status `pending_approval`, notifikasi approver pertama |
| `approval_decide(approval_id, decision, note)` | Approver yang sedang giliran | Setujui/tolak (tolak wajib alasan ≥ 5 karakter), lanjut ke langkah berikutnya atau selesai |
| `approval_cancel(doc_type, record_id, note)` | Pemohon | Tarik pengajuan selama masih pending → `draft` |
| `approval_override(approval_id, mode, new_approver, note)` | **Admin** app | `reassign` (ganti approver) / `skip` (lewati), alasan wajib, CCTV `warning` |
| `request_followup(approval_id)` | Pemohon / editor | Follow-up ke approver yang giliran, jeda 1 jam per (langkah, peminta) |
| `pending_for_me(limit)` | Siapa saja | Antrian approval user (dashboard, Inbox, global search) |

Template pemilihan (urutan menang): `priority` tertinggi → yang punya `company_code` → yang punya
`department_id` → terlama. Tidak ada yang cocok → `P0001` "Belum ada template approval yang cocok untuk
dokumen ini. Hubungi admin app."

Inti `approval_start`:

```sql
create or replace function __APP__.approval_start(p_doc_type text, p_record_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_type   __APP__.approval_doc_types;
  v_ctx    __APP__.approval_context;
  v_tpl    uuid;
  v_round  integer;
  v_first  __APP__.approvals;
  v_notif  uuid[] := '{}';
begin
  select * into v_type from __APP__.approval_doc_types where code = p_doc_type and is_active;
  if not found then raise exception 'Jenis dokumen tidak dikenal.' using errcode = 'P0001'; end if;

  execute format('select * from %s($1)', v_type.context_fn::regproc) into v_ctx using p_record_id;
  if v_ctx.requester_id is null then raise exception 'Dokumen tidak ditemukan.' using errcode = 'P0001'; end if;
  if v_ctx.requester_id is distinct from v_uid and not public.has_app_role('__APP__', 'editor') then
    raise exception 'Hanya pemohon atau editor yang bisa mengajukan dokumen ini.' using errcode = 'P0001';
  end if;

  -- cegah klik ganda / dua tab mengajukan bersamaan
  perform pg_advisory_xact_lock(hashtext('approval:' || p_doc_type || ':' || p_record_id));
  if exists (select 1 from __APP__.approvals
             where doc_type = p_doc_type and record_id = p_record_id and status = 'pending') then
    raise exception 'Dokumen ini sedang dalam proses approval.' using errcode = 'P0001';
  end if;

  select t.id into v_tpl
    from __APP__.approval_templates t
   where t.doc_type = p_doc_type and t.is_active
     and (t.company_code  is null or t.company_code  = v_ctx.company_code)
     and (t.department_id is null or t.department_id = v_ctx.department_id)
     and (t.min_amount is null or v_ctx.amount >= t.min_amount)
     and (t.max_amount is null or v_ctx.amount <= t.max_amount)
   order by t.priority desc, (t.company_code is not null) desc, (t.department_id is not null) desc, t.created_at
   limit 1;
  if v_tpl is null then
    raise exception 'Belum ada template approval yang cocok untuk dokumen ini. Hubungi admin app.' using errcode = 'P0001';
  end if;

  if exists (select 1 from __APP__.approval_template_steps s
             where s.template_id = v_tpl and s.approver_kind = 'department_head'
               and not exists (select 1 from __APP__.department_heads h
                               where h.department_id = v_ctx.department_id and h.company_code = v_ctx.company_code)) then
    raise exception 'Kepala departemen untuk dokumen ini belum diatur. Hubungi admin app.' using errcode = 'P0001';
  end if;

  select coalesce(max(round), 0) + 1 into v_round
    from __APP__.approvals where doc_type = p_doc_type and record_id = p_record_id;

  insert into __APP__.approvals (doc_type, record_id, round, step_no, approval_type, approver_id, status, note, due_hours, template_id)
  select p_doc_type, p_record_id, v_round, s.step_no, s.approval_type, x.approver_id,
         case when x.approver_id = v_ctx.requester_id then 'skipped' else 'pending' end,
         case when x.approver_id = v_ctx.requester_id then 'Dilewati: approver adalah pemohon' end,
         s.due_hours, v_tpl
    from __APP__.approval_template_steps s
    cross join lateral (
      select case s.approver_kind
               when 'user' then s.approver_id
               else (select h.user_id from __APP__.department_heads h
                      where h.department_id = v_ctx.department_id and h.company_code = v_ctx.company_code)
             end as approver_id) x
   where s.template_id = v_tpl;

  select * into v_first from __APP__.approvals
   where doc_type = p_doc_type and record_id = p_record_id and round = v_round and status = 'pending'
   order by step_no limit 1;

  perform __APP__.set_log_context('submit', null);
  execute format('select %s($1, $2)', v_type.on_done_fn::regproc) using p_record_id, 'submitted';

  if v_first.id is null then
    -- semua langkah dilewati → langsung disetujui
    perform __APP__.set_log_context('approve', 'Semua langkah approval dilewati');
    execute format('select %s($1, $2)', v_type.on_done_fn::regproc) using p_record_id, 'approved';
  else
    update __APP__.approvals set due_at = now() + make_interval(hours => due_hours)
     where id = v_first.id and due_hours is not null;
    v_notif := array(select * from __APP__.notify(
      array[v_first.approver_id], 'approval.request',
      format('Menunggu persetujuan Anda: %s %s', v_type.label, coalesce(v_ctx.code, '')), null,
      v_type.href_prefix || p_record_id, 'approval', p_doc_type, p_record_id::text));
  end if;
  perform __APP__.set_log_context(null, null);

  return jsonb_build_object('round', v_round, 'notification_ids', to_jsonb(v_notif));
end $$;
```

Inti `approval_decide`:

```sql
create or replace function __APP__.approval_decide(p_approval_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_a     __APP__.approvals;
  v_type  __APP__.approval_doc_types;
  v_ctx   __APP__.approval_context;
  v_next  __APP__.approvals;
  v_href  text;
  v_notif uuid[] := '{}';
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Keputusan tidak valid.' using errcode = 'P0001';
  end if;

  select * into v_a from __APP__.approvals where id = p_approval_id for update;   -- kunci baris: anti klik ganda
  if not found or v_a.status <> 'pending' then
    raise exception 'Approval ini sudah diproses. Muat ulang halaman.' using errcode = 'P0001';
  end if;
  if v_a.approver_id is distinct from v_uid then
    raise exception 'Bukan giliran Anda untuk memproses dokumen ini.' using errcode = 'P0001';
  end if;
  if exists (select 1 from __APP__.approvals
             where doc_type = v_a.doc_type and record_id = v_a.record_id and round = v_a.round
               and step_no < v_a.step_no and status = 'pending') then
    raise exception 'Masih menunggu approver sebelumnya.' using errcode = 'P0001';
  end if;
  if p_decision = 'rejected' and length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Alasan penolakan wajib diisi (minimal 5 karakter).' using errcode = 'P0001';
  end if;

  select * into v_type from __APP__.approval_doc_types where code = v_a.doc_type;
  execute format('select * from %s($1)', v_type.context_fn::regproc) into v_ctx using v_a.record_id;
  v_href := v_type.href_prefix || v_a.record_id;

  update __APP__.approvals set status = p_decision, decided_at = now(), note = nullif(btrim(p_note), '')
   where id = v_a.id;

  if p_decision = 'rejected' then
    update __APP__.approvals set status = 'skipped', note = 'Dihentikan: dokumen ditolak'
     where doc_type = v_a.doc_type and record_id = v_a.record_id and round = v_a.round and status = 'pending';
    perform __APP__.set_log_context('reject', p_note);
    execute format('select %s($1, $2)', v_type.on_done_fn::regproc) using v_a.record_id, 'rejected';
    v_notif := array(select * from __APP__.notify(array[v_ctx.requester_id], 'approval.rejected',
      format('%s %s ditolak', v_type.label, v_ctx.code), p_note, v_href, 'approval', v_a.doc_type, v_a.record_id::text));
  else
    select * into v_next from __APP__.approvals
     where doc_type = v_a.doc_type and record_id = v_a.record_id and round = v_a.round and status = 'pending'
     order by step_no limit 1;
    if found then
      -- langkah tengah: dokumen tidak berubah, log ditulis langsung
      update __APP__.approvals set due_at = now() + make_interval(hours => due_hours)
       where id = v_next.id and due_hours is not null;
      perform __APP__.write_log(v_type.table_name, v_a.record_id, 'approve',
        jsonb_build_object('langkah', jsonb_build_object('old', null, 'new', v_a.step_no)), p_note,
        v_ctx.code, v_ctx.company_code, v_type.href_prefix, v_type.label, true);
      v_notif := array(select * from __APP__.notify(array[v_next.approver_id], 'approval.request',
        format('Menunggu persetujuan Anda: %s %s', v_type.label, v_ctx.code), null, v_href, 'approval',
        v_a.doc_type, v_a.record_id::text));
    else
      perform __APP__.set_log_context('approve', p_note);
      execute format('select %s($1, $2)', v_type.on_done_fn::regproc) using v_a.record_id, 'approved';
      v_notif := array(select * from __APP__.notify(array[v_ctx.requester_id], 'approval.approved',
        format('%s %s disetujui', v_type.label, v_ctx.code), null, v_href, 'approval', v_a.doc_type, v_a.record_id::text));
    end if;
  end if;
  perform __APP__.set_log_context(null, null);

  return jsonb_build_object('status', p_decision, 'notification_ids', to_jsonb(v_notif));
end $$;
```

`request_followup` (ringkas):

1. Kunci baris approval (`for update`).
2. Harus `pending` dan sedang giliran.
3. Pemanggil = pemohon atau editor, dan **bukan** approver itu sendiri.
4. Ada follow-up dari pemanggil ke langkah itu < 1 jam → `P0001` "Follow-up ke {nama} sudah dikirim
   {n} menit lalu. Coba lagi setelah 1 jam."
5. Insert `followups` → `write_log(..., 'followup', ..., cctv => true)` → notify approver
   `approval.followup` "Follow-up: mohon proses {label} {kode}".

`pending_for_me`:

```sql
create or replace function __APP__.pending_for_me(p_limit integer default 50)
returns table (approval_id uuid, doc_type text, doc_label text, record_id uuid, step_no integer,
               approval_type text, waiting_since timestamptz, due_at timestamptz, href text,
               followup_count integer)
language sql stable security definer set search_path = '' as $$
  select a.id, a.doc_type, t.label, a.record_id, a.step_no, a.approval_type,
         coalesce((select max(p.decided_at) from __APP__.approvals p
                    where p.doc_type = a.doc_type and p.record_id = a.record_id
                      and p.round = a.round and p.step_no < a.step_no), a.created_at),
         a.due_at, t.href_prefix || a.record_id,
         (select count(*)::integer from __APP__.followups f where f.approval_id = a.id)
    from __APP__.approvals a
    join __APP__.approval_doc_types t on t.code = a.doc_type
   where a.approver_id = (select auth.uid()) and a.status = 'pending'
     and not exists (select 1 from __APP__.approvals b
                      where b.doc_type = a.doc_type and b.record_id = a.record_id and b.round = a.round
                        and b.step_no < a.step_no and b.status = 'pending')
   order by followup_count desc, 7
   limit least(p_limit, 200);
$$;
```

Kode dokumen untuk ditampilkan diambil loader app per `doc_type` dalam satu query `.in("id", ids)`.

### 6.4 Grant

```sql
revoke insert, update, delete on __APP__.approvals, __APP__.followups from authenticated;
revoke execute on function __APP__.approval_start(text, uuid), __APP__.approval_decide(uuid, text, text),
  __APP__.approval_cancel(text, uuid, text), __APP__.approval_override(uuid, text, uuid, text),
  __APP__.request_followup(uuid), __APP__.pending_for_me(integer) from public, anon;
-- tetap execute untuk authenticated (default privileges); fungsi mengecek akses sendiri
```

### 6.5 Mendaftarkan jenis dokumen

Untuk setiap dokumen yang butuh approval, migration app menambahkan **dua hook + satu baris registry**:

```sql
create or replace function __APP__.pengajuan_approval_context(p_id uuid)
returns __APP__.approval_context language sql stable security definer set search_path = '' as $$
  select created_by, company_code, department_id, total_amount, code
    from __APP__.pengajuan where id = p_id;
$$;

-- WAJIB meng-update baris dokumen (trigger log membaca konteks aksi dari set_log_context)
create or replace function __APP__.pengajuan_on_approval(p_id uuid, p_outcome text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update __APP__.pengajuan
     set status = case p_outcome
                    when 'submitted' then 'pending_approval'
                    when 'approved'  then 'approved'
                    when 'rejected'  then 'rejected'
                    when 'cancelled' then 'draft'
                  end,
         code = case when p_outcome = 'submitted'
                     then coalesce(code, __APP__.next_doc_number('PJ', company_code)) else code end
   where id = p_id;
end $$;

revoke execute on function __APP__.pengajuan_approval_context(uuid), __APP__.pengajuan_on_approval(uuid, text)
  from public, anon, authenticated;

insert into __APP__.approval_doc_types (code, label, table_name, href_prefix, context_fn, on_done_fn)
values ('pengajuan', 'Pengajuan', 'pengajuan', '/pengajuan/',
        '__APP__.pengajuan_approval_context(uuid)', '__APP__.pengajuan_on_approval(uuid,text)');
```

### 6.6 Status hanya berubah lewat engine

Guard di tabel dokumen (pola `profiles_guard`):

```sql
create or replace function __APP__.pengajuan_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') = 'authenticated'
     and nullif(current_setting('app.log_action', true), '') is null then
    if new.status is distinct from old.status or new.code is distinct from old.code then
      raise exception 'Status dan nomor dokumen hanya bisa diubah lewat proses approval.' using errcode = 'P0001';
    end if;
    if old.status not in ('draft', 'rejected') then
      raise exception 'Dokumen yang sedang diproses atau sudah selesai tidak bisa diubah.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger pengajuan_guard before update on __APP__.pengajuan
  for each row execute function __APP__.pengajuan_guard();
```

Admin yang perlu mengubah dokumen yang sudah berjalan memakai RPC khusus (`pengajuan_admin_edit`) yang
memanggil `set_log_context('admin_edit', alasan)`. Dengan begitu tercatat sebagai "Diedit Admin" + CCTV
`notice`.

### 6.7 Opsional (tambahkan saat app butuh)

- **Delegasi** (approver cuti): `approval_delegations (from_user, to_user, start_date, end_date)`.
  `approval_start` dan `approval_decide` memakai delegasi yang aktif hari itu, dan log mencatat "atas nama".
- **Edit & Setujui** (approver merevisi isi): `<dokumen>_revisions (record_id, revision_no, snapshot jsonb,
  created_by, created_at)`, ditulis sebelum perubahan. UI "Versi Asli / Revisi n".
- **Paralel** (beberapa approver satu langkah): kolom `step_mode` (`all`/`any`) di template step.

---

## 7. Notifikasi & Web Push

### 7.1 Tabel

```sql
create table __APP__.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  type        text not null check (type ~ '^[a-z][a-z0-9_.]{1,60}$'),
  category    text not null default 'umum' check (category ~ '^[a-z][a-z0-9_]{1,30}$'),
  title       text not null check (length(btrim(title)) between 1 and 200),
  body        text check (length(body) <= 1000),
  href        text check (href is null or href ~ '^/'),
  entity      text,
  record_id   text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx   on __APP__.notifications (user_id, created_at desc);
create index notifications_unread_idx on __APP__.notifications (user_id) where read_at is null;
create index notifications_created_idx on __APP__.notifications (created_at);

alter table __APP__.notifications enable row level security;
revoke insert, update, delete on __APP__.notifications from authenticated;
grant update (read_at) on __APP__.notifications to authenticated;        -- hanya kolom read_at
create policy "notifications: own read" on __APP__.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications: own mark read" on __APP__.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table __APP__.notifications;
```

### 7.2 `notify()`: internal

**Tidak bisa dipanggil langsung dari app.** Notifikasi hanya lahir dari RPC domain (approval, Bantuan,
feedback, dll.), sehingga user tidak bisa mengirim teks bebas ke orang lain.

```sql
create or replace function __APP__.notify(
  p_user_ids uuid[], p_type text, p_title text, p_body text default null, p_href text default null,
  p_category text default 'umum', p_entity text default null, p_record_id text default null)
returns setof uuid language plpgsql security definer set search_path = '' as $$
begin
  return query
  insert into __APP__.notifications (user_id, actor_id, type, category, title, body, href, entity, record_id)
  select distinct u, (select auth.uid()), p_type, p_category, left(p_title, 200), left(p_body, 1000),
         p_href, p_entity, p_record_id
    from unnest(p_user_ids) as u
   where u is not null
     and u is distinct from (select auth.uid())                       -- tidak menotifikasi diri sendiri
     and exists (select 1 from public.app_access a join public.profiles p on p.id = a.user_id
                  where a.user_id = u and p.is_active
                    and (a.app_id = '__APP__' or (a.app_id = 'platform' and a.role = 'admin')))
  returning id;
end $$;
revoke execute on function __APP__.notify(uuid[], text, text, text, text, text, text, text) from public, anon, authenticated;
```

Menandai dibaca cukup dari client/action: `update notifications set read_at = now() where id = any(…)`
(RLS + grant kolom menjaga).

### 7.3 Web Push

```sql
create table __APP__.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  endpoint      text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh        text not null check (length(p256dh) <= 200),
  auth          text not null check (length(auth) <= 100),
  user_agent    text check (length(user_agent) <= 300),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now()
);
create index push_subscriptions_user_idx on __APP__.push_subscriptions (user_id);
alter table __APP__.push_subscriptions enable row level security;
revoke insert, update on __APP__.push_subscriptions from authenticated;
create policy "push_subscriptions: own read" on __APP__.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "push_subscriptions: own delete" on __APP__.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
```

| RPC | Fungsi |
|---|---|
| `push_subscribe(endpoint, p256dh, auth, user_agent)` | Hapus baris lama dengan endpoint yang sama (HP dipakai bergantian), lalu simpan untuk user ini. Dipanggil ulang tiap app dibuka (memperbarui `last_used_at`) |
| `push_targets(notification_ids uuid[])` | Kembalikan `(notification_id, endpoint, p256dh, auth, title, body, href, tag)` **hanya** untuk notifikasi dengan `actor_id = auth.uid()` dan `created_at > now() - interval '2 minutes'` |
| `push_prune(endpoints text[])` | Hapus endpoint yang dibalas 404/410, hanya yang termasuk penerima notifikasi pemanggil 5 menit terakhir |

Alur di server app:

```ts
// app/(app)/pengajuan/actions.ts
"use server";
export async function decideApprovalAction(_: FormState, fd: FormData): Promise<FormState> {
  const access = await actionAccess("viewer");            // approver cukup viewer
  if (!access) return NOT_ALLOWED;
  const parsed = decideInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_decide", {
    p_approval_id: parsed.data.approvalId, p_decision: parsed.data.decision, p_note: parsed.data.note ?? null,
  });
  if (error) return dbError(error);
  after(() => sendPushFor(supabase, data.notification_ids));   // lib/push.ts, tidak memperlambat respons
  revalidatePath(`/pengajuan/${parsed.data.recordId}`);
  return ok(parsed.data.decision === "approved" ? "Dokumen disetujui." : "Dokumen ditolak.");
}
```

`lib/push.ts` (server-only): `push_targets` → `web-push.sendNotification` paralel (timeout 5 s, TTL
24 jam, `topic`/tag per dokumen) → kumpulkan endpoint 404/410 → `push_prune`. Semua error ditangkap dan
dicatat (`console.error`). Push **tidak pernah** menggagalkan aksi.

### 7.4 Pengingat approval terlambat

Di `run_maintenance()` (§12): langkah `pending` dengan `due_at < now()` dan (`reminded_at` null atau
> 24 jam lalu) → `notify(approval.overdue)` "Approval {label} {kode} melewati batas waktu" + set
`reminded_at`. Pengingat ini **tanpa push**, karena job DB tidak punya kunci VAPID. Pengingat muncul di
Inbox dan badge, dan push ikut terkirim saat ada aksi berikutnya.

---

## 8. Riwayat dokumen (`<entitas>_logs`)

### 8.1 Tabel log (bentuk sama untuk semua dokumen)

```sql
create table __APP__.pengajuan_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,                     -- sengaja tanpa FK: log tetap ada walau dokumen dihapus
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,                             -- {"kolom": {"old": …, "new": …}}
  note       text check (length(note) <= 2000)
);
create index pengajuan_logs_record_idx on __APP__.pengajuan_logs (record_id, at desc);
create index pengajuan_logs_actor_idx  on __APP__.pengajuan_logs (actor_id, at desc);
alter table __APP__.pengajuan_logs enable row level security;
revoke insert, update, delete on __APP__.pengajuan_logs from authenticated;
-- baca mengikuti hak baca dokumen
create policy "pengajuan_logs: read with document" on __APP__.pengajuan_logs for select to authenticated
  using (exists (select 1 from __APP__.pengajuan d where d.id = record_id));
```

Policy `exists` memakai RLS tabel dokumen, sehingga scope company otomatis ikut. Untuk log dokumen
yang dihapus, tambahkan policy kedua: admin app boleh membaca semua.

### 8.2 Penulis log + jembatan ke CCTV

```sql
create or replace function __APP__.action_label(p_action text)
returns text language sql immutable set search_path = '' as $$
  select case p_action
    when 'create' then 'dibuat'          when 'update' then 'diubah'
    when 'delete' then 'dihapus'         when 'submit' then 'diajukan'
    when 'approve' then 'disetujui'      when 'reject' then 'ditolak'
    when 'cancel' then 'dibatalkan'      when 'followup' then 'di-follow-up'
    when 'override' then 'approval diubah admin'
    when 'admin_edit' then 'diedit admin'
    else replace(p_action, '_', ' ') end;
$$;

create or replace function __APP__.write_log(
  p_table text, p_record_id uuid, p_action text, p_changes jsonb, p_note text,
  p_label text, p_company text, p_href text, p_entity_label text, p_cctv boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  execute format('insert into %I.%I (record_id, action, changes, note, actor_id) values ($1, $2, $3, $4, $5)',
                 '__APP__', p_table || '_logs')
    using p_record_id, p_action, p_changes, p_note, (select auth.uid());

  if p_cctv then
    perform public.cctv_log(
      p_app          => '__APP__',
      p_category     => case when p_action in ('submit', 'approve', 'reject', 'cancel', 'followup', 'override')
                             then 'approval' else 'data' end,
      p_action       => p_table || '.' || p_action,
      p_summary      => format('%s %s %s', p_entity_label, coalesce(p_label, left(p_record_id::text, 8)),
                               __APP__.action_label(p_action)),
      p_severity     => case when p_action in ('delete', 'override') then 'warning'
                             when p_action in ('reject', 'admin_edit', 'cancel') then 'notice'
                             else 'info' end,
      p_entity       => p_table,
      p_record_id    => p_record_id::text,
      p_record_label => p_label,
      p_company_code => p_company,
      p_url          => case when p_href is null or p_action = 'delete' then null
                             else 'https://__HOST__.lourdes.cloud' || p_href || p_record_id end,
      p_changes      => p_changes,
      p_metadata     => case when p_note is null then null else jsonb_build_object('catatan', p_note) end);
  end if;
end $$;
revoke execute on function __APP__.write_log(text, uuid, text, jsonb, text, text, text, text, text, boolean)
  from public, anon, authenticated;

-- Trigger generik. Argumen: (mode_cctv, href_prefix, label_entitas)
--   mode_cctv: 'important' (default: semua kecuali edit biasa oleh pemilik) | 'all' | 'none'
create or replace function __APP__.log_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_mode    text  := coalesce(tg_argv[0], 'important');
  v_href    text  := tg_argv[1];
  v_elabel  text  := coalesce(tg_argv[2], tg_table_name);
  v_row     jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_action  text  := nullif(current_setting('app.log_action', true), '');
  v_note    text  := nullif(current_setting('app.log_note', true), '');
  v_owner   uuid  := (v_row ->> 'created_by')::uuid;
  v_changes jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := coalesce(v_action, 'create');
  elsif tg_op = 'DELETE' then
    v_action := coalesce(v_action, 'delete');
    v_changes := v_row - 'search_text';                        -- salinan terakhir
  else
    select jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value))
      into v_changes
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.key not in ('updated_at', 'search_text') and n.value is distinct from o.value;
    if v_changes is null then return null; end if;            -- tidak ada yang berubah
    v_action := coalesce(v_action,
      case when v_owner is not null and v_owner is distinct from (select auth.uid()) then 'admin_edit' else 'update' end);
  end if;

  perform __APP__.write_log(tg_table_name, (v_row ->> 'id')::uuid, v_action, v_changes, v_note,
    v_row ->> 'code', v_row ->> 'company_code', v_href, v_elabel,
    case v_mode when 'all' then true when 'none' then false else v_action <> 'update' end);
  return null;
end $$;
revoke execute on function __APP__.log_changes() from public, anon, authenticated;

create trigger pengajuan_log after insert or update or delete on __APP__.pengajuan
  for each row execute function __APP__.log_changes('important', '/pengajuan/', 'Pengajuan');
```

- Tabel **item** (`pengajuan_items`) tidak punya log sendiri. Perubahan item ditulis RPC penyimpan
  dokumen sebagai satu baris `update` dengan `changes.items` berisi ringkasan (ditambah/diubah/dihapus).
- Label kolom dan format nilai untuk UI ada di `FIELD_LABELS` app (frontend §11). DB menyimpan nilai
  mentah.

---

## 9. CCTV: apa yang direkam

### 9.1 Taksonomi

| Kategori | Contoh `action` | Severity | Sumber |
|---|---|---|---|
| `auth` | `auth.login`, `auth.logout`, `auth.password_reset_request` | info | Server action auth app (`lib/cctv.ts`) |
| `access` | `access.grant`, `access.change_role`, `access.revoke`, `access.denied_page` | notice / warning | Action Pengguna & Akses; `requireAccess` yang menolak |
| `approval` | `pengajuan.submit`, `.approve`, `.reject`, `.cancel`, `.followup`, `.override` | info / notice / warning | Engine (DB, otomatis) |
| `data` | `pengajuan.create`, `.delete`, `.admin_edit`, `member.update` | info / notice / warning | Trigger log (DB, otomatis) |
| `export` | `export.excel`, `export.print`, `export.print_qr` | info | Route ekspor & action cetak (`lib/cctv.ts`) |
| `security` | `security.rls_denied`, `security.invalid_input`, `security.verify_failed` | warning / critical | `dbError` (42501), action yang menolak, verifikasi publik |
| `config` | `approval_template.update`, `department_head.update`, `settings.update` | notice | Trigger log tabel konfigurasi |
| `public` | `public.verify_document` | info | Fungsi verifikasi publik (DB) |

Aturan isi:

- `summary` = satu kalimat Indonesia yang bisa dibaca tanpa membuka detail: "Pengajuan PJ/GMI/2611/0042
  disetujui", "Download Excel Pengajuan (230 baris, filter: status=approved)".
- **Tidak boleh** berisi password, token, NRP, No HP, isi lampiran, atau payload penuh. `changes` hanya
  kolom yang berubah, tanpa kolom sensitif (daftar `CCTV_REDACT` per app; trigger membuang kolom
  bernama `*_token`, `nrp*`, `phone`).
- `url` selalu link ke dokumennya di app, supaya konsol bisa "lompat ke TKP".
- Edit biasa oleh pemilik dokumen (draft) **tidak** dikirim. Itu cukup di log app. CCTV untuk yang
  penting.

### 9.2 Dari server app (`lib/cctv.ts`)

```ts
import "server-only";
import { after } from "next/server";
import { headers } from "next/headers";
import { APP_ID } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function cctv(e: {
  category: "auth" | "access" | "export" | "security" | "config";
  action: string; summary: string; severity?: "info" | "notice" | "warning" | "critical";
  entity?: string; recordId?: string; recordLabel?: string; companyCode?: string;
  url?: string; metadata?: Record<string, unknown>;
}) {
  const h = await headers();
  const supabase = await createClient();            // dibuat sebelum after(): sesi user
  const client = {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: h.get("user-agent"),
    path: h.get("referer") ? new URL(h.get("referer")!).pathname : null,
  };
  after(async () => {                                 // best-effort, tidak memperlambat respons
    const { error } = await supabase.schema("public").rpc("cctv_log", {
      p_app: APP_ID, p_category: e.category, p_action: e.action, p_summary: e.summary,
      p_severity: e.severity ?? "info", p_entity: e.entity ?? null, p_record_id: e.recordId ?? null,
      p_record_label: e.recordLabel ?? null, p_company_code: e.companyCode ?? null, p_url: e.url ?? null,
      p_changes: null, p_metadata: e.metadata ?? null, p_client: client,
    });
    if (error) console.error("[cctv]", error.code, error.message);
  });
}
```

| Titik di app | Event |
|---|---|
| Login berhasil (action auth) | `auth.login` (setelah sesi terbentuk) |
| Signout route | `auth.logout` (sebelum `signOut`) |
| `requireAccess` ditolak (role kurang) | `access.denied_page` warning, path di `client.path` |
| `dbError` kena `42501` | `security.rls_denied` warning |
| Route `/<fitur>/ekspor` | `export.excel` + jumlah baris + filter (metadata) |
| Action cetak (dipanggil sebelum `print()`) | `export.print` / `export.print_qr` |
| Action Pengguna & Akses | `access.grant/change_role/revoke` notice |

### 9.3 Event DB vs event app

- **DB (trigger/engine)**: satu transaksi dengan aksinya. Kalau CCTV gagal ditulis, aksinya ikut batal,
  sehingga tidak ada aksi bisnis tanpa rekaman.
- **App (`lib/cctv.ts`)**: best-effort setelah respons. Kegagalan hanya dicatat di log server.
- `client` (IP, user agent) hanya ada di event app. Event DB tidak tahu IP. Konsol menautkan keduanya
  lewat `actor_id` + waktu.

### 9.4 Untuk konsol monitoring (repo `monitoring-lourdes`)

Saran fitur halaman **CCTV** (bukan bagian boilerplate, tapi datanya disiapkan di sini):

- Timeline semua app; filter app, kategori, severity, pelaku, company, rentang waktu, dan cari kode
  dokumen.
- **Rekam jejak dokumen**: semua event `(app_id, entity, record_id)` berurutan, plus link "buka di app".
- **Rekam jejak orang**: semua aksi satu user lintas app, lengkap dengan IP/perangkat.
- Sorotan `warning`/`critical` (badge + daftar terpisah), penolakan akses berulang, export besar.
- Gabung dengan `public.audit_log` (perubahan akun & akses dari konsol).
- Export Excel (style sama dengan boilerplate) untuk keperluan audit.

---

## 10. Pencarian, list, dashboard

### 10.1 `search_text` + trigram

```sql
-- pg_trgm dipasang sekali di level platform: create extension if not exists pg_trgm with schema extensions;
create or replace function __APP__.pengajuan_search_text()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_text := lower(concat_ws(' ', new.code, new.title,
    (select string_agg(i.item_name || ' ' || coalesce(i.part_number, ''), ' ')
       from __APP__.pengajuan_items i where i.pengajuan_id = new.id)));
  return new;
end $$;
create trigger pengajuan_search before insert or update on __APP__.pengajuan
  for each row execute function __APP__.pengajuan_search_text();
create index pengajuan_search_idx on __APP__.pengajuan using gin (search_text extensions.gin_trgm_ops);
```

RPC penyimpan item menyentuh `updated_at` dokumen setelah mengubah item, sehingga `search_text` ikut
segar. Loader: `.ilike("search_text", `%${escapeLike(q.toLowerCase())}%`)`. Kalau ada beberapa kata,
semuanya harus ada (urutan bebas): satu `.ilike` per kata.

### 10.2 List & export (server app)

- Satu loader `listPengajuan(params, { all })` di `lib/pengajuan.ts`: kolom eksplisit, filter dari
  `search-params`, scope company, sort whitelist + `.order("id")`, `range()` + `count: "exact"`.
- `all: true` (export) mengambil per 1.000 baris sampai habis, dengan batas 50.000.
- Route `app/(app)/pengajuan/ekspor/route.ts`: `requireAccess` → loader → `buildWorkbook()` (`lib/excel.ts`)
  → `cctv(export.excel)` → `Response` xlsx.

### 10.3 Global search

```sql
create or replace function __APP__.global_search(p_q text, p_limit integer default 5)
returns table (kind text, id text, title text, subtitle text, status text, amount numeric,
               href text, is_exact boolean)
language sql stable security invoker set search_path = '' as $$
  with q as (select lower(btrim(p_q)) as t)
  (select 'pengajuan', d.id::text, d.code, d.title, d.status, d.total_amount, '/pengajuan/' || d.id,
          lower(d.code) = q.t
     from __APP__.pengajuan d, q
    where length(q.t) >= 3 and d.search_text like '%' || q.t || '%'
    order by (lower(d.code) = q.t) desc, d.created_at desc
    limit least(p_limit, 10))
  -- union all (select … dokumen/master lain …)
$$;
```

`security invoker`: RLS + scope company berlaku otomatis, sama dengan list. Kata kunci di-escape di app
sebelum dikirim (`%`, `_`).

### 10.4 Dashboard

- Satu RPC ringkasan `dashboard_summary(p_from date, p_to date, p_company text)` (`security invoker`)
  mengembalikan `jsonb` semua angka stat card + tren periode sebelumnya. Satu round trip.
- Insight berat terpisah (`dashboard_top_items`, `dashboard_approval_time`), masing-masing di
  `<Suspense>`.
- Batas hari dihitung WIB: `(p_from::timestamp at time zone 'Asia/Jakarta')`.
- Drill-down stat card = loader list biasa dengan filter, bukan RPC baru.

---

## 11. Modul pendukung

Semua per app. RLS: satu policy per aksi. Aksi yang memicu notifikasi = RPC (mengembalikan
`notification_ids`).

### 11.1 Bantuan Admin

| Tabel | Kolom inti | RLS |
|---|---|---|
| `support_threads` | `user_id` (default `auth.uid()`), `category`, `subject`, `status` (`menunggu`/`dibalas`/`selesai`), `assigned_to`, `context` jsonb (halaman, perangkat), `last_message_at`, timestamps | select: pemilik atau admin; insert: pemilik (viewer); update `status`: pemilik (hanya → `selesai`) atau admin |
| `support_messages` | `thread_id`, `sender_id`, `body` (≤ 4000), `attachment_path`, `read_at`, `created_at` | select: peserta thread (pemilik/admin); insert hanya lewat RPC |

RPC:

- `support_open(category, subject, body, context, attachment_path)` → thread + pesan pertama →
  notify semua admin app (`support.new`).
- `support_send(thread_id, body, attachment_path)` → notify lawan bicara (pemilik ↔ admin yang
  ditugaskan, atau semua admin kalau belum ada) → status otomatis (`dibalas` kalau admin yang
  mengirim, `menunggu` kalau pemilik).
- `support_assign(thread_id, admin_id)`, `support_set_status(thread_id, status)` (admin).

Realtime: `support_messages` (dipakai hanya di halaman `/bantuan`). Lampiran di
`<app>-lampiran/support/<thread_id>/…`.

### 11.2 Feedback

| Tabel | Kolom inti | RLS |
|---|---|---|
| `feedback` | `user_id`, `category`, `content` jsonb (Tiptap), `attachments` text[], `context` jsonb (halaman asal, versi, perangkat, tema), `status` (`baru`/`diproses`/`selesai`), `admin_note`, timestamps | select: pemilik (tanpa `admin_note`, lewat view) atau admin; insert: pemilik; update: admin |

- `admin_note` disembunyikan dari pelapor lewat view `feedback_mine` (`security_invoker`) tanpa kolom
  itu. App membaca view untuk "Feedback saya".
- RPC `feedback_submit(...)` → notify admin; `feedback_set_status(id, status, admin_note)` → notify
  pelapor.

### 11.3 Update Web

| Tabel | Kolom inti | RLS |
|---|---|---|
| `updates` | `version_major/minor/patch`, `version` (generated `major.minor.patch`), `title`, `thumbnail_path`, `highlights` text[] (≤ 10), `content` jsonb, `created_by`, timestamps; unique versi | select: viewer; insert/update/delete: admin |
| `update_reactions` | PK (`update_id`, `user_id`), `emoji` check in (👍 ❤️ 🎉 😂 😮 🙏) | select: viewer; insert/update/delete: milik sendiri |
| `update_comments` | `update_id`, `user_id`, `body` (≤ 2000), `reply_to`, `created_at` | select: viewer; insert: milik sendiri; delete: milik sendiri atau admin |
| `update_seen` | PK `user_id`, `last_seen_id`, `seen_at` | milik sendiri (upsert) |

Versi baru harus lebih besar dari versi terakhir (constraint lewat trigger). Tentang App membaca versi
dari post terbaru.

### 11.4 Members (data user khusus app)

Pola dari `claude-app-guide.md` §6. Kolom yang ditentukan admin (level approval, tim) dijaga trigger guard
seperti `profiles_guard`: user biasa hanya boleh mengubah kolom "milik sendiri". Perubahan oleh admin
tercatat di log + CCTV `data` (`member.update`).

### 11.5 Pengguna & Akses

Tidak ada tabel baru. App menulis langsung ke `public.app_access` (policy mengizinkan admin app):

- insert `{ user_id, app_id: APP_ID, role, granted_by: auth.uid() }`, update `role`, delete.
- Guard di action: tidak boleh mencabut/menurunkan **admin terakhir** app. Cek `count` admin sebelum
  menulis.
- `public.audit_log` mencatat otomatis (trigger platform). App menambah event CCTV `access.*`.

### 11.6 Verifikasi publik (modul opsional)

```sql
create or replace function __APP__.verify_document(p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  select jsonb_build_object(
           'jenis', 'Pengajuan', 'kode', d.code, 'perusahaan', c.name, 'tanggal', d.created_at,
           'status', d.status,
           'disetujui', (select jsonb_agg(jsonb_build_object('nama', p.full_name, 'waktu', a.decided_at) order by a.step_no)
                           from __APP__.approvals a join public.profiles p on p.id = a.approver_id
                          where a.doc_type = 'pengajuan' and a.record_id = d.id and a.status = 'approved'
                            and a.round = (select max(round) from __APP__.approvals x
                                            where x.doc_type = 'pengajuan' and x.record_id = d.id)))
    into v
    from __APP__.pengajuan d join public.companies c on c.code = d.company_code
   where d.verify_token = p_token and d.status not in ('draft', 'cancelled');

  perform public.cctv_log('__APP__', 'public', 'public.verify_document',
    case when v is null then 'Verifikasi dokumen gagal (token tidak dikenal)'
         else format('Dokumen %s diverifikasi lewat QR', v ->> 'kode') end,
    case when v is null then 'warning' else 'info' end, 'pengajuan', null, v ->> 'kode');
  return v;   -- null = tidak ditemukan
end $$;
revoke execute on function __APP__.verify_document(uuid) from public;
grant  execute on function __APP__.verify_document(uuid) to anon, authenticated;
```

- `anon` hanya mendapat `execute` fungsi ini. **Tidak ada** grant tabel ke `anon`.
- Agar `anon` bisa memanggil RPC di schema app, schema itu butuh `grant usage on schema __APP__ to anon`.
  Ini menambah permukaan serangan, jadi aktifkan hanya dengan izin user dan catat di `CLAUDE.md`.
  Alternatif yang lebih tertutup: fungsi di schema terpisah `__APP___public` yang hanya berisi fungsi
  verifikasi.
- Token dibuat ulang (`update … set verify_token = gen_random_uuid()`) oleh admin lewat RPC saat dokumen
  direvisi/dicetak ulang.

---

## 12. Maintenance per app (`run_maintenance`)

Dipanggil `public.run_maintenance_all()` setiap 03:00 WIB (§2.3).

```sql
create table __APP__.maintenance_runs (
  id      bigint generated always as identity primary key,
  ran_at  timestamptz not null default now(),
  result  jsonb not null
);
alter table __APP__.maintenance_runs enable row level security;
revoke insert, update, delete on __APP__.maintenance_runs from authenticated;
create policy "maintenance_runs: admin read" on __APP__.maintenance_runs for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));

create or replace function __APP__.run_maintenance()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_res jsonb := '{}';
  n     integer;
begin
  -- 1. Pengingat approval terlambat (maks. 1x per 24 jam per langkah)
  with due as (
    update __APP__.approvals a set reminded_at = now()
     where a.status = 'pending' and a.due_at < now()
       and (a.reminded_at is null or a.reminded_at < now() - interval '24 hours')
    returning a.approver_id, a.doc_type, a.record_id)
  insert into __APP__.notifications (user_id, type, category, title, href, entity, record_id)
  select d.approver_id, 'approval.overdue', 'approval',
         format('Approval %s melewati batas waktu', t.label), t.href_prefix || d.record_id, d.doc_type, d.record_id::text
    from due d join __APP__.approval_doc_types t on t.code = d.doc_type;
  get diagnostics n = row_count; v_res := v_res || jsonb_build_object('reminders', n);

  -- 2. Retensi
  delete from __APP__.notifications
   where (read_at is not null and created_at < now() - interval '90 days')
      or (read_at is null and created_at < now() - interval '180 days');
  get diagnostics n = row_count; v_res := v_res || jsonb_build_object('notifications', n);

  delete from __APP__.push_subscriptions where last_used_at < now() - interval '90 days';
  get diagnostics n = row_count; v_res := v_res || jsonb_build_object('push_subscriptions', n);

  delete from __APP__.followups f using __APP__.approvals a
   where a.id = f.approval_id and a.status <> 'pending' and f.requested_at < now() - interval '180 days';
  get diagnostics n = row_count; v_res := v_res || jsonb_build_object('followups', n);

  delete from __APP__.support_threads where status = 'selesai' and updated_at < now() - interval '1 year';
  get diagnostics n = row_count; v_res := v_res || jsonb_build_object('support_threads', n);
  -- (file lampiran thread yang dihapus dibersihkan oleh storage cleanup di bawah)

  -- 3. Arsip log > 5 tahun (per tabel *_logs): pindah ke *_logs_archive, tidak dihapus
  --    for r in select tablename … where tablename like '%\_logs' loop execute format(…) end loop;

  insert into __APP__.maintenance_runs (result) values (v_res);
  delete from __APP__.maintenance_runs where ran_at < now() - interval '1 year';
  return v_res;
end $$;
revoke execute on function __APP__.run_maintenance() from public, anon, authenticated;
```

- Pembersihan **file storage** (lampiran thread yang dihapus, gambar Update Web yang tidak dipakai)
  tidak bisa dengan `delete from storage.objects` saja, karena file fisiknya tertinggal. Kumpulkan path
  di tabel `storage_cleanup_queue`, lalu hapus lewat Storage API dari action admin app (tombol
  "Bersihkan file") atau job terpisah, dengan izin user.
- Batas hari adalah konstanta di fungsi. App dengan kewajiban arsip lebih panjang mengubahnya di
  migration-nya sendiri.

---

## 13. Storage

| Bucket | Isi | Akses | Batas |
|---|---|---|---|
| `avatars` (platform, sudah ada) | Foto profil `<uid>/avatar-<ts>.webp` | public-read; tulis milik sendiri | 2 MB, jpeg/png/webp |
| `<app>-lampiran` | Lampiran dokumen `<record_id>/<nama>`, Bantuan `support/<thread_id>/…`, feedback `feedback/<id>/…` | private, signed URL 10 menit | 20 MB, pdf/gambar/office |
| `<app>-media` | Thumbnail & gambar Update Web `updates/<id>/…` | private, signed URL 1 jam | 5 MB, gambar |

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('__HOST__-lampiran', '__HOST__-lampiran', false, 20971520,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;
-- policy: viewer read, editor insert/update, admin delete (pola claude-app-guide.md §6 "Storage")
```

Nama bucket mengikuti standar `<app_id>-<isi>`. Ganti `__HOST__` ke `__APP__` kalau app_id tanpa `_`;
pilih satu dan konsisten. Path selalu diawali id record, sehingga policy ketat per dokumen bisa
ditambahkan: `(storage.foldername(name))[1]::uuid in (select id from __APP__.pengajuan)` untuk ikut
scope company.

---

## 14. Pengujian & verifikasi

Sebelum push (setiap migration):

1. `scripts/push.sh --dry-run` → tunjukkan daftar migration ke user → konfirmasi → `scripts/push.sh`.
2. Semua tabel RLS aktif:
   `scripts/query.sh "select relname, relrowsecurity from pg_class where relnamespace = '<app>'::regnamespace and relkind = 'r'"`
3. Tidak ada fungsi internal yang bisa dipanggil `authenticated`:
   ```sql
   select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as bisa
     from pg_proc p where p.pronamespace = '<app>'::regnamespace
      and p.proname in ('notify', 'write_log', 'log_changes', 'set_log_context', 'next_doc_number',
                        'run_maintenance') ;   -- semua harus false
   ```
4. Tabel tulis-RPC tidak punya grant tulis:
   `select table_name, privilege_type from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = '<app>' and table_name in ('approvals','notifications','followups','pengajuan_logs','doc_sequences')`
   → hanya `SELECT` (+ `UPDATE` kolom `read_at` di notifications).
5. Simulasi user (read-only, di-rollback):
   ```sql
   begin;
   set local role authenticated;
   select set_config('request.jwt.claims', '{"sub":"<uuid-user-uji>","role":"authenticated"}', true);
   select count(*) from <app>.pengajuan;          -- sesuai scope company user uji?
   select * from <app>.pending_for_me(10);
   rollback;
   ```

Skenario wajib (dengan data "UJI", dihapus setelahnya):

| Skenario | Harapan |
|---|---|
| User GMI membaca dokumen GIS | 0 baris |
| Viewer mengubah status lewat `update` langsung | Ditolak guard |
| Approver langkah 2 menyetujui sebelum langkah 1 | `P0001` "Masih menunggu approver sebelumnya." |
| Dua kali `approval_decide` cepat (klik ganda) | Yang kedua `P0001` "sudah diproses" |
| Tolak tanpa alasan | `P0001` |
| Follow-up 2x dalam 1 jam | Yang kedua `P0001` |
| `select notify(...)` dari user | `permission denied` |
| `push_targets` untuk notifikasi orang lain | 0 baris |
| Update/delete `public.cctv_events` | Ditolak trigger |
| Event app lain lewat `cctv_log('appX', …)` tanpa akses appX | `42501` |
| Hapus dokumen | Log tetap ada; CCTV `warning` |

---

## 15. Definisi selesai (backend)

Melengkapi standar §11.

- [ ] Tabel dokumen punya kolom standar (§3.1), trigger `updated_at`, log (`*_logs` + `log_changes`),
      `search_text` + index trigram, dan guard status (kalau memakai approval).
- [ ] Scope company di policy select/insert/update (§4).
- [ ] Dokumen dengan approval terdaftar di `approval_doc_types` dengan dua hook, dan punya template
      default.
- [ ] Fungsi internal di-`revoke`; tabel tulis-RPC di-`revoke` tulisnya (§3.2, §14).
- [ ] Pesan `P0001` Bahasa Indonesia, tanpa detail teknis/data orang lain.
- [ ] RPC yang memicu notifikasi mengembalikan `notification_ids`, dan action memanggil push di `after()`.
- [ ] Aksi penting tercatat di log dokumen **dan** CCTV dengan `summary` yang bisa dibaca + `url`.
- [ ] Tidak ada data sensitif di `changes`/`metadata` CCTV.
- [ ] Bucket baru dengan batas ukuran + MIME, path diawali id record.
- [ ] Data lama terjaga oleh `run_maintenance` (retensi yang sesuai untuk tabel baru).
- [ ] Skenario §14 lulus; migration di-commit di `lourdes-db`; `npm run db:types` di app.

---

## 16. Hal terbuka

1. **Migration platform** (§2): `public.companies`, `public.cctv_events` + `cctv_log`,
   `public.maintenance_runs` + `run_maintenance_all`, FK `profiles.company` tahap 1. Belum ditulis ke
   `lourdes-db`. Perlu dry-run + konfirmasi.
2. **NRP untuk company baru**: kolom `nrp_gmi`/`nrp_gis` + constraint masih khusus GMI/GIS. Perlu desain
   ulang sebelum company ke-4 bisa dipakai di profil.
3. **`pg_trgm`**: pastikan terpasang di instance Lourdes (`select * from pg_extension where extname = 'pg_trgm'`).
   Kalau belum, pemasangannya perubahan platform.
4. **Systemd timer maintenance** (§2.3): perlu izin user untuk dipasang di VPS.
5. **Halaman CCTV di `monitoring-lourdes`** (§9.4): butuh desain UI sendiri; datanya sudah disiapkan
   di sini.
6. **Penamaan bucket** (`<app_id>` vs host dengan `-`): samakan dengan aturan standar sebelum app pertama.

---

## Lampiran A. Isi folder `db/` boilerplate

File SQL dengan placeholder `__APP__` (app_id) dan `__HOST__` (subdomain). Disalin dan digabung ke
**satu** migration app di `lourdes-db` saat app dibuat.

| File | Isi | Wajib |
|---|---|---|
| `db/platform/p01_companies.sql` | §2.1 (sekali untuk seluruh platform) | Sekali |
| `db/platform/p02_cctv.sql` | §2.2 | Sekali |
| `db/platform/p03_maintenance.sql` | §2.3 + unit systemd di `infra/maintenance/` | Sekali |
| `db/app/01_base.sql` | `members`, `my_company_scope`, `set_log_context`, `action_label`, `write_log`, `log_changes`, `doc_sequences`, `next_doc_number` | ✔ |
| `db/app/02_notifications.sql` | `notifications`, `notify`, `push_subscriptions`, `push_subscribe/targets/prune`, realtime | ✔ |
| `db/app/03_approval.sql` | Approval engine §6 | ✔ |
| `db/app/04_support.sql` | Bantuan Admin §11.1 | ✔ |
| `db/app/05_feedback.sql` | Feedback §11.2 | ✔ |
| `db/app/06_updates.sql` | Update Web §11.3 | ✔ |
| `db/app/07_storage.sql` | Bucket `-lampiran`, `-media` + policy | ✔ |
| `db/app/08_maintenance.sql` | `run_maintenance`, `maintenance_runs` | ✔ |
| `db/app/09_verify.sql` | Verifikasi publik §11.6 | Opsional |
| `db/app/example_pengajuan.sql` | Contoh dokumen lengkap: tabel, item, log, search, guard, hook approval, registry, global search, dashboard summary | Contoh, dihapus setelah ada dokumen asli |

Alur membuat app dari boilerplate (script `scripts/create-app.sh <app_id> "<Nama>"` di boilerplate):

1. Salin boilerplate ke `~/project/<app-id>-lourdes`, ganti placeholder `__APP__`, `__HOST__`,
   `__REPO__`, `__NAME__`, lalu `git init`.
2. Tulis `~/project/lourdes-db/supabase/migrations/<ts>_app_<app_id>.sql` = bagian schema + grant +
   registry dari `lourdes-db/templates/new_app.sql` (tanpa contoh `items`) + gabungan `db/app/0*.sql`
   (+ `example_pengajuan.sql`).
3. Lanjut alur standar: rancang tabel → dry-run → konfirmasi user → push → `expose-schema.sh` →
   `npm run db:types` → beri akses user uji → bangun fitur.

Perubahan pada `db/` boilerplate tidak otomatis masuk ke app yang sudah ada. Buat migration baru
`<ts>_<app>_boilerplate_<perubahan>.sql` per app.
