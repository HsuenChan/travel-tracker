-- Settlement "paid" marks (per trip, per from→to pair)
create table if not exists settlement_paid (
  trip_id uuid not null references trips(id) on delete cascade,
  pair_key text not null,
  created_at timestamptz not null default now(),
  primary key (trip_id, pair_key)
);

-- API 用 user-scoped client 讀寫，需要 RLS policy：旅程擁有者或成員可管理
alter table settlement_paid enable row level security;

drop policy if exists "trip members manage settlement paid" on settlement_paid;
create policy "trip members manage settlement paid" on settlement_paid
  for all
  using (
    exists (select 1 from trips t where t.id = settlement_paid.trip_id and t.user_id = auth.uid())
    or exists (select 1 from trip_members m where m.trip_id = settlement_paid.trip_id and m.user_id = auth.uid())
  )
  with check (
    exists (select 1 from trips t where t.id = settlement_paid.trip_id and t.user_id = auth.uid())
    or exists (select 1 from trip_members m where m.trip_id = settlement_paid.trip_id and m.user_id = auth.uid())
  );
