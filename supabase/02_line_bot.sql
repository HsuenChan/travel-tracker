-- LINE Bot integration tables
-- Run after 01_schema.sql (depends on trips table)

-- Maps LINE user ID to app user + default trip
create table if not exists line_user_mappings (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  default_trip_id uuid references trips(id) on delete set null,
  default_person text,
  created_at timestamptz not null default now()
);

alter table line_user_mappings enable row level security;

create policy "users can read own mapping"
  on line_user_mappings for select
  using (auth.uid() = user_id);

-- Temp codes for binding LINE account to app account (expire in 10 min)
create table if not exists line_binding_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used boolean not null default false,
  created_at timestamptz not null default now()
);

alter table line_binding_codes enable row level security;

create policy "users can read own binding codes"
  on line_binding_codes for select
  using (auth.uid() = user_id);

create policy "users can insert own binding codes"
  on line_binding_codes for insert
  with check (auth.uid() = user_id);

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

-- Maps LINE group/room ID to a shared default trip
create table if not exists line_group_mappings (
  id uuid primary key default gen_random_uuid(),
  group_id text not null unique,
  default_trip_id uuid references trips(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table line_group_mappings enable row level security;
