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
  duration_out_min integer,             -- outbound: time from the previous waypoint to this one
  duration_back_min integer,            -- return leg, which is rarely the same
  type text,                            -- trailhead / peak / hut / camp / water / junction / other
  lat numeric,                          -- reserved for GPX import; unused by the editor
  lng numeric,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists route_waypoints_item_idx
  on route_waypoints(itinerary_item_id, order_index);

-- Same posture as itinerary_items: no RLS, so the read-only share page can draw the profile.
