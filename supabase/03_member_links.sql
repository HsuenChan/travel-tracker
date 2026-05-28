-- Member links: bind a split-bill member name (trips.people) to a Google account (auth.users)
-- Run in Supabase SQL Editor after 01_schema.sql

create table if not exists member_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  person_name text not null,                                   -- matches an entry in trips.people
  user_id uuid references auth.users(id) on delete set null,   -- bound Google account (null = unbound)
  created_at timestamptz not null default now(),
  unique (trip_id, person_name)
);

create index if not exists member_links_trip_idx on member_links(trip_id);
create index if not exists member_links_user_idx on member_links(user_id) where user_id is not null;

alter table member_links enable row level security;

-- Readable by the bound user, or by the trip owner.
create policy "trip members can read links" on member_links for select
  using (
    auth.uid() = user_id
    or auth.uid() = (select user_id from trips where id = trip_id)
  );
