-- AI 用量紀錄
-- Run in Supabase SQL Editor (safe to re-run)
--
-- 專案用的是 Gemini Tier 1（付費層），速率上限一天 10,000 次、實際尖峰 2 次，
-- 所以會先出事的不是配額而是帳單。這張表存的重點因此是 token 數 —— 付費層按 token
-- 計價，token 量直接換算得出花了多少錢。
--
-- 為什麼不塞進 activity_log：那張表的欄位是為「誰改了什麼」設計的（changes、snapshot、
-- entity_*）。token 數與耗時是要拿來 SUM 與畫圖的數值，塞進自由文字欄位就再也加總不了，
-- 而且會同時汙染後台的異動頁與存取頁。
create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),

  -- itinerary（AI 排行程）/ notes（AI 筆記）/ receipt（收據辨識）/ flight（機票辨識）
  feature text not null,
  model text not null,

  -- 觸發的人。帳號被刪掉之後仍要讀得到當時是誰，所以名字存快照
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,

  trip_id uuid references trips(id) on delete set null,
  trip_name text,

  -- Gemini 回應的 usageMetadata。失敗時取不到，留 null
  prompt_tokens integer,
  output_tokens integer,
  total_tokens integer,

  duration_ms integer,

  -- 失敗的呼叫一定要記：被擋下來時也是失敗，只記成功的話畫面會顯示「用量很低」，
  -- 但實際上是一直在撞牆
  ok boolean not null default true,
  error text,

  created_at timestamptz not null default now()
);

create index if not exists ai_usage_created_idx on ai_usage (created_at desc);
create index if not exists ai_usage_feature_created_idx on ai_usage (feature, created_at desc);

-- 只有後台讀得到，而後台走 service client（繞過 RLS）。這裡開 RLS 但不給任何 policy，
-- 等於前端拿 anon key 一列都讀不到。
alter table ai_usage enable row level security;
