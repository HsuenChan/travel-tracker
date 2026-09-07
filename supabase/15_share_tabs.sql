-- 分享連結要露出哪些分頁
-- Run in Supabase SQL Editor after 01_schema.sql (safe to re-run)
--
-- null 表示還沒設定過，讀取時沿用該趟的 enabled_tabs（見 lib/tripTabs.ts 的 resolveSharedTabs），
-- 所以跑完這支 migration 之後，既有分享連結的可見範圍不會有任何變化。
alter table trips add column if not exists shared_tabs text[];

-- share_token 一直只存在線上資料庫、沒有進過 migration，這裡補上讓全新建立的資料庫也能分享。
-- 型別跟著線上走（uuid）；已經有這個欄位的資料庫跑起來是 no-op，不會重新產生現有連結的 token。
alter table trips add column if not exists share_token uuid unique default gen_random_uuid();
update trips set share_token = gen_random_uuid() where share_token is null;
