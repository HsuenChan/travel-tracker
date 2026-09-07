-- Outdoor legs: per-item distance / ascent / descent plus a waypoint list for the elevation profile
-- Run in Supabase SQL Editor after 01_schema.sql (safe to re-run)

alter table itinerary_items
  add column if not exists distance_km numeric,
  add column if not exists ascent_m numeric,
  add column if not exists descent_m numeric;

-- An outdoor leg is just an itinerary item (single-day when end_date is null, multi-day
-- otherwise), so a trip can hold several independent legs without any extra grouping.
create table if not exists route_waypoints (
  id uuid primary key default gen_random_uuid(),
  itinerary_item_id uuid not null references itinerary_items(id) on delete cascade,
  order_index integer not null default 0,
  name text not null,
  elevation_m numeric,
  distance_km numeric,                  -- cumulative from the start of the leg
  day_offset integer not null default 0, -- 0 = the item's start date, 1 = the next day, ...
  duration_min integer,                 -- time from the previous waypoint to this one
  drop_m numeric,                       -- measured drop for a rappel / downclimb / jump / slide
  type text,                            -- trailhead / peak / hut / camp / water / junction / other
  lat numeric,                          -- reserved for GPX import; unused by the editor
  lng numeric,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists route_waypoints_item_idx
  on route_waypoints(itinerary_item_id, order_index);

-- Trip owner or member only, resolved through the parent itinerary item. The read-only
-- share page gets waypoints from /api/share/[token] (service client) instead.
alter table route_waypoints enable row level security;

drop policy if exists "trip members manage route waypoints" on route_waypoints;
create policy "trip members manage route waypoints" on route_waypoints
  for all
  using (
    exists (
      select 1 from itinerary_items i
      join trips t on t.id = i.trip_id
      where i.id = route_waypoints.itinerary_item_id
        and (
          t.user_id = auth.uid()
          or exists (select 1 from trip_members m where m.trip_id = t.id and m.user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from itinerary_items i
      join trips t on t.id = i.trip_id
      where i.id = route_waypoints.itinerary_item_id
        and (
          t.user_id = auth.uid()
          or exists (select 1 from trip_members m where m.trip_id = t.id and m.user_id = auth.uid())
        )
    )
  );
