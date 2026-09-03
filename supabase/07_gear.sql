-- Gear / packing list (per trip)
-- Run in Supabase SQL Editor after 01_schema.sql (safe to re-run)

create table if not exists gear_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  name text not null,
  notes text,
  category text,                    -- one free-form category per item (single-select in the UI)
  -- 'personal' is only visible to owner_user_id; 'group' (公裝, shared kit) to every trip member
  scope text not null default 'personal' check (scope in ('personal', 'group')),
  owner_user_id uuid references auth.users(id) on delete set null,
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

-- Group gear is shared with the trip; personal gear is private to its owner. Two permissive
-- policies OR together, so someone else's personal gear matches neither and stays invisible.
-- See 12_gear_scope_category.sql for the same policies as a migration.
alter table gear_items enable row level security;

drop policy if exists "trip members manage group gear" on gear_items;
create policy "trip members manage group gear" on gear_items
  for all
  using (
    scope = 'group' and (
      exists (select 1 from trips t where t.id = gear_items.trip_id and t.user_id = auth.uid())
      or exists (select 1 from trip_members m where m.trip_id = gear_items.trip_id and m.user_id = auth.uid())
    )
  )
  with check (
    scope = 'group' and (
      exists (select 1 from trips t where t.id = gear_items.trip_id and t.user_id = auth.uid())
      or exists (select 1 from trip_members m where m.trip_id = gear_items.trip_id and m.user_id = auth.uid())
    )
  );

drop policy if exists "owners manage personal gear" on gear_items;
create policy "owners manage personal gear" on gear_items
  for all
  using (scope = 'personal' and owner_user_id = auth.uid())
  with check (scope = 'personal' and owner_user_id = auth.uid());
