-- Per-leg override for whether the elevation profile is worth showing
-- Run in Supabase SQL Editor after 09_itinerary_outdoor.sql (safe to re-run)
--
-- Three states, which is why it is nullable rather than a default-false boolean:
--   null   decide from the data (see lib/elevationDisplay.ts)
--   true   always show, even at low elevation coverage
--   false  never show
--
-- It lives on the item rather than in a browser because "this profile is misleading" is a
-- property of the route's data, not of whoever is looking at it — every trip member should
-- see the same thing.
alter table itinerary_items
  add column if not exists show_elevation boolean;
