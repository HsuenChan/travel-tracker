-- Gear / packing list (per trip)
-- Run in Supabase SQL Editor after 01_schema.sql (safe to re-run)

create table if not exists gear_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  name text not null,
  notes text,
  tags text[],                      -- free-form categories, same idea as souvenirs.tags
  weight_g numeric,                 -- weight of a single unit in grams; null = not weighed yet
  qty integer not null default 1,
  -- Drives the base-weight formula: base = total - worn - consumable
  weight_role text not null default 'base'
    check (weight_role in ('base', 'worn', 'consumable')),
  assigned_to text,                 -- who carries it (matches a name in trips.people)
  image_url text,
  is_checked boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists gear_items_trip_idx on gear_items(trip_id);

-- Trip owner or member only. The read-only share page does not read this table directly:
-- it gets its copy from /api/share/[token], which runs on the service client, so no
-- anonymous access is needed here.
alter table gear_items enable row level security;

drop policy if exists "trip members manage gear items" on gear_items;
create policy "trip members manage gear items" on gear_items
  for all
  using (
    exists (select 1 from trips t where t.id = gear_items.trip_id and t.user_id = auth.uid())
    or exists (select 1 from trip_members m where m.trip_id = gear_items.trip_id and m.user_id = auth.uid())
  )
  with check (
    exists (select 1 from trips t where t.id = gear_items.trip_id and t.user_id = auth.uid())
    or exists (select 1 from trip_members m where m.trip_id = gear_items.trip_id and m.user_id = auth.uid())
  );
