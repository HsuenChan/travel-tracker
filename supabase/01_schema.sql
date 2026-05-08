-- Core schema
-- Run in Supabase SQL Editor before 02_line_bot.sql

-- Trips
create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  countries text,
  country_codes text,               -- comma-separated ISO 3166-1 alpha-2 codes (e.g. "TW,JP")
  notes text,
  photo_album_id text,
  people text[],
  currency text default 'TWD',
  enabled_tabs text[] default array['transport','itinerary','expenses','photos','notes'],
  destinations jsonb default '[]',
  ai_notes jsonb default null,
  line_token text unique,           -- one-time token for linking a LINE chat to this trip
  created_at timestamptz not null default now()
);

create index if not exists trips_line_token_idx on trips(line_token) where line_token is not null;

alter table trips enable row level security;
create policy "users can manage own trips" on trips for all using (auth.uid() = user_id);

-- Trip members (collaboration)
create table if not exists trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  avatar_url text,
  is_owner boolean default false,
  created_at timestamptz not null default now()
);

alter table trip_members enable row level security;
create policy "members can read their trips" on trip_members for select using (auth.uid() = user_id);

-- Transport segments
create table if not exists segments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  "order" integer,
  from_city text,
  from_iata text,
  to_city text,
  to_iata text,
  type text,
  date date,
  time text,
  flight_no text,
  aircraft text,
  created_at timestamptz not null default now()
);

-- Itinerary items
create table if not exists itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  date date not null,
  sort_order integer default 0,
  title text not null,
  category text,
  time text,
  end_date date,
  end_time text,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

-- Expenses
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  description text not null,
  amount numeric not null,
  currency text not null,
  category text,
  date date,
  paid_by text,
  split_with text[],
  notes text,
  created_at timestamptz not null default now()
);

-- Souvenirs / shopping list
create table if not exists souvenirs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  name text not null,
  is_checked boolean default false,
  image_url text,
  tags text[],
  notes text,
  created_at timestamptz not null default now()
);
