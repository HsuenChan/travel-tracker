-- Measured drop per waypoint, so rope length stops living in the name string
-- Run in Supabase SQL Editor after 09_itinerary_outdoor.sql (safe to re-run)

alter table route_waypoints add column if not exists drop_m numeric;

-- Backfill from names that already carry the height, e.g. 'R2 17m', 'DC 3m', 'J 5m'.
--
-- Restricted to descent types on purpose: an approach waypoint named '820m 等高線' would
-- otherwise be read as an 820 metre drop, and 'HL 8m' is an 8 metre highline traverse
-- (type 'anchor'), not a descent. Names are left untouched — they match the guidebook's own
-- labels, and rewriting them with a regex risks mangling notes like 'R3 10m（可跳 3m）'.
-- The 'm' must not be followed by a letter, or a name like 'R4 20 min 接近' would be read
-- as a 20 metre drop.
update route_waypoints
set drop_m = (regexp_match(name, '(\d+(?:\.\d+)?)\s*m(?![a-zA-Z])'))[1]::numeric
where drop_m is null
  and type in ('rappel', 'downclimb', 'jump', 'slide')
  and name ~ '(\d+(?:\.\d+)?)\s*m(?![a-zA-Z])';
