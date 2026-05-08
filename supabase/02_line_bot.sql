-- LINE Bot integration tables
-- Run after 01_schema.sql (depends on trips table)

-- Pending expense while user selects split members (expires in 10 min)
create table if not exists line_pending_expenses (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric not null,
  currency text not null,
  paid_by text,
  selected_people text[] not null default '{}',
  all_people text[] not null default '{}',
  trip_name text,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);

alter table line_pending_expenses enable row level security;

-- Maps LINE group/room ID to a trip (linked via trip token)
create table if not exists line_group_mappings (
  id uuid primary key default gen_random_uuid(),
  group_id text not null unique,
  default_trip_id uuid references trips(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table line_group_mappings enable row level security;
