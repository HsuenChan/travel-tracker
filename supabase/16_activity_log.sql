-- 後台操作紀錄：資料異動 + 登入事件
-- Run in Supabase SQL Editor after 01_schema.sql (safe to re-run)
--
-- 這張表只有後台管理員讀得到，寫入一律走 service client（lib/activityLog.ts），
-- 所以刻意不建任何 policy —— 開了 RLS 又沒有 policy，等於擋掉所有 anon / authenticated
-- 的直接存取，只剩 server 端拿 service key 的路徑進得來，正好是我們要的。
--
-- 已知盲區：繞過 app/api/* 直接改資料庫（psql、Supabase Studio、curl 打 PostgREST）
-- 不會留下紀錄。要補這塊只能改用 table trigger，但那樣就拿不到「誰、從哪個 tab、
-- 用什麼裝置」，所以這裡選擇 app 層記錄。

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),

  -- 'change'：資料異動；'auth'：登入登出
  kind text not null check (kind in ('change', 'auth')),
  -- change: create / update / delete / restore ; auth: login / logout / login_failed
  action text not null,

  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,                                    -- 當下的顯示名稱快照，成員被移除後仍讀得到
  actor_source text not null default 'web',           -- web / line / ai / import / system

  trip_id uuid references trips(id) on delete set null,
  trip_name text,                                     -- 快照，旅程被刪掉後仍讀得到
  tab text,                                           -- lib/tripTabs.ts 的 key，auth 事件為 null
  entity_table text,                                  -- itinerary_items / expenses / ...
  entity_id uuid,
  entity_label text,                                  -- 當下的標題快照

  note text,                                          -- 批次操作的一句話說明（例如「重新命名 8 件裝備的分類」）
  changes jsonb,                                      -- [{ field, label, before, after }]
  snapshot jsonb,                                     -- 異動前的完整整列，還原用
  restored_from uuid references activity_log(id) on delete set null,

  ip text,
  user_agent text,

  created_at timestamptz not null default now()
);

-- 後台預設是「最近 24 小時」，所以時間倒序是最熱的路徑
create index if not exists activity_log_created_idx      on activity_log (created_at desc);
create index if not exists activity_log_kind_created_idx on activity_log (kind, created_at desc);
create index if not exists activity_log_trip_created_idx on activity_log (trip_id, created_at desc);
create index if not exists activity_log_tab_created_idx  on activity_log (tab, created_at desc);
create index if not exists activity_log_action_idx       on activity_log (action, created_at desc);
-- 還原後要能從原事件找到它的還原紀錄
create index if not exists activity_log_restored_idx     on activity_log (restored_from) where restored_from is not null;

alter table activity_log enable row level security;
