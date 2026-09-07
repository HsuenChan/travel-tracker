-- RLS for the remaining trip content tables
-- Run in Supabase SQL Editor after 01_schema.sql (safe to re-run)
--
-- souvenirs / itinerary_items / expenses shipped without RLS, which means anyone holding the
-- anon key and a trip id could read and write them. Every server route that touches these
-- tables already runs on the user-scoped client and requires a session, and the two paths that
-- legitimately need to bypass authorisation — /api/share/[token] and the LINE webhook — use the
-- service client, so enabling RLS costs them nothing.
--
-- Gate is trip membership, matching 05_settlement_paid.sql and 07_gear.sql.

alter table souvenirs       enable row level security;
alter table itinerary_items enable row level security;
alter table expenses        enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array['souvenirs', 'itinerary_items', 'expenses'])
  loop
    execute format('drop policy if exists %I on %I', 'trip members manage ' || t, t);
    execute format($f$
      create policy %I on %I
        for all
        using (
          exists (select 1 from trips tr where tr.id = %I.trip_id and tr.user_id = auth.uid())
          or exists (select 1 from trip_members m where m.trip_id = %I.trip_id and m.user_id = auth.uid())
        )
        with check (
          exists (select 1 from trips tr where tr.id = %I.trip_id and tr.user_id = auth.uid())
          or exists (select 1 from trip_members m where m.trip_id = %I.trip_id and m.user_id = auth.uid())
        )
    $f$, 'trip members manage ' || t, t, t, t, t, t);
  end loop;
end $$;
