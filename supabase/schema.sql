-- ============================================================
-- RoadWatch AI — Supabase schema
-- Jalankan file ini di Supabase SQL Editor (Project -> SQL Editor -> New query)
-- ============================================================

-- 1. Extensions -------------------------------------------------
create extension if not exists postgis;
create extension if not exists vector;

-- 2. Tables -------------------------------------------------------
create table if not exists reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users,
  damage_type   text not null,                 -- 'pothole', 'longitudinal_crack', dst
  confidence    real,
  severity      text not null default 'low',   -- 'low' | 'medium' | 'high' | 'emergency'
  hazard_score  int not null default 0,
  location      geography(Point, 4326) not null,
  embedding     vector(512),                   -- output CLIP image encoder, L2-normalized
  support_count int not null default 1,
  status        text not null default 'open',  -- 'open' | 'resolved'
  created_at    timestamptz not null default now()
);

create table if not exists report_images (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid references reports(id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now()
);

-- 3. Indexes --------------------------------------------------------
create index if not exists reports_location_idx on reports using gist (location);
create index if not exists reports_embedding_idx on reports using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists reports_status_idx on reports (status);

-- 4. RPC: find_similar_reports --------------------------------------
-- Combines PostGIS distance + pgvector cosine similarity in one query,
-- filtered to the same damage_type and only open reports.
create or replace function find_similar_reports(
  new_lat float,
  new_lng float,
  new_damage_type text,
  new_embedding vector(512),
  radius_meters int default 50
)
returns table (
  id uuid,
  damage_type text,
  distance_m float,
  similarity float,
  support_count int,
  created_at timestamptz
)
language sql
stable
as $$
  select
    r.id,
    r.damage_type,
    st_distance(r.location, st_setsrid(st_makepoint(new_lng, new_lat), 4326)::geography) as distance_m,
    1 - (r.embedding <=> new_embedding) as similarity,
    r.support_count,
    r.created_at
  from reports r
  where r.status = 'open'
    and r.damage_type = new_damage_type
    and st_dwithin(r.location, st_setsrid(st_makepoint(new_lng, new_lat), 4326)::geography, radius_meters)
  order by similarity desc
  limit 5;
$$;

-- 5. RPC: increment_support ------------------------------------------
-- Called when a user confirms an existing report is the same damage.
create or replace function increment_support(report_id uuid)
returns reports
language sql
as $$
  update reports
  set support_count = support_count + 1
  where id = report_id
  returning *;
$$;

-- 6. Row Level Security ------------------------------------------------
alter table reports enable row level security;
alter table report_images enable row level security;

-- Anyone (including anon) can read open reports — this is a public civic map.
create policy "Public read access to reports"
  on reports for select
  using (true);

-- Anyone can insert a report (adjust to `auth.uid() is not null` if you require login).
create policy "Anyone can create a report"
  on reports for insert
  with check (true);

create policy "Public read access to report_images"
  on report_images for select
  using (true);

create policy "Anyone can attach an image to a report"
  on report_images for insert
  with check (true);

-- 7. Storage bucket for photos ------------------------------------------
-- Run in Supabase Dashboard > Storage if this insert fails due to permissions:
insert into storage.buckets (id, name, public)
values ('report-images', 'report-images', true)
on conflict (id) do nothing;

create policy "Public read of report images"
  on storage.objects for select
  using (bucket_id = 'report-images');

create policy "Anyone can upload report images"
  on storage.objects for insert
  with check (bucket_id = 'report-images');
