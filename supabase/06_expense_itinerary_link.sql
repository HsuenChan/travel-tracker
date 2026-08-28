-- Link an expense to an itinerary item (record spending from inside the itinerary)
-- Run in Supabase SQL Editor after 01_schema.sql

alter table expenses
  add column if not exists itinerary_item_id uuid
  references itinerary_items(id) on delete set null;

-- Deleting an itinerary item keeps its expenses; only the link is cleared.
create index if not exists expenses_itinerary_item_idx
  on expenses(itinerary_item_id) where itinerary_item_id is not null;
