-- 路線檔案：一條戶外路段的分級、性質、時間、進場、危險與出處
-- Run in Supabase SQL Editor after 09_itinerary_outdoor.sql (safe to re-run)
--
-- 為什麼是 jsonb 而不是一張新表：這些欄位永遠一次整包讀出來畫面，不會被單獨查詢、
-- 排序或 join，而且擁有權已經由母項目的 RLS 管好了 —— 拆表只會多一條重複的 policy。
--
-- 形狀定義在 lib/routeProfile.ts（RouteProfile），匯入端與顯示端共用同一份型別。
-- 沒有 route_profile 的戶外路段一切照舊：路線彈窗只會少掉那幾個分頁。
alter table itinerary_items
  add column if not exists route_profile jsonb;

-- 之後若要「列出所有 v5 以上的路線」才需要索引；目前一律整包讀，不先建。
