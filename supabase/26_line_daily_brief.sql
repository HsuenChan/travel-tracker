-- 推播紀錄：同一件事只推一次
-- Run in Supabase SQL Editor after 02_line_bot.sql (safe to re-run)
--
-- cron 每小時跑一次（因為「當地早上八點」在不同時區是不同的 UTC 時刻），所以同一個群組
-- 一天會被掃到 24 次。沒有這張表的話，時區推算一變動就可能同一天推兩次。
create table if not exists line_push_log (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  trip_id uuid not null references trips(id) on delete cascade,
  kind text not null,                 -- daily_brief / settlement
  -- daily_brief 是當地日期（YYYY-MM-DD）；settlement 一趟只推一次，放固定字串
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (group_id, trip_id, kind, dedupe_key)
);

create index if not exists line_push_log_created_idx on line_push_log (created_at desc);

alter table line_push_log enable row level security;
