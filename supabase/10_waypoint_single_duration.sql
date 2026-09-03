-- One time per leg instead of an out-and-back pair
-- Run in Supabase SQL Editor after 09_itinerary_outdoor.sql (safe to re-run)
--
-- The out/back pair came from the Taiwanese 上河 topo convention for out-and-back peak routes.
-- It does not fit one-way descents (canyoning never climbs back up), and an out-and-back is a
-- property of the whole leg rather than of a single waypoint, so a per-point return time was
-- both noise and double the typing.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'route_waypoints' and column_name = 'duration_out_min'
  ) then
    alter table route_waypoints rename column duration_out_min to duration_min;
  end if;
end $$;

alter table route_waypoints drop column if exists duration_back_min;
