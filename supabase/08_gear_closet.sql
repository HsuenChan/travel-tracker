-- Personal gear closet (per user, reused across trips)
-- Run in Supabase SQL Editor after 07_gear.sql (safe to re-run)

create table if not exists gear_closet (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  category text,
  weight_g numeric,
  qty integer not null default 1,
  weight_role text not null default 'base'
    check (weight_role in ('base', 'worn', 'consumable')),
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists gear_closet_user_idx on gear_closet(user_id);

-- Unlike gear_items (trip content, readable from the read-only share page), the closet is
-- private to its owner, so it does need RLS.
alter table gear_closet enable row level security;

drop policy if exists "users manage own gear closet" on gear_closet;
create policy "users manage own gear closet" on gear_closet
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
