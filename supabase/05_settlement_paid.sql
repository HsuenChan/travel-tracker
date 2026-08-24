-- Settlement "paid" marks (per trip, per from→to pair)
create table if not exists settlement_paid (
  trip_id uuid not null references trips(id) on delete cascade,
  pair_key text not null,
  created_at timestamptz not null default now(),
  primary key (trip_id, pair_key)
);
