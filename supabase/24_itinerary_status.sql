-- 行程的三種狀態：已排入、想去、備案
-- Run in Supabase SQL Editor after 09_itinerary_outdoor.sql (safe to re-run)
--
--   planned   已排進行程，會去（現況；既有資料全部是這個）
--   wishlist  想去，還沒決定哪一天 —— 這種沒有日期
--   backup    已排在某一天，但可去可不去，當天再決定
--
-- 不另開一張表：想去清單的每一筆最後都會變成行程，欄位一模一樣。分成兩張表的話，
-- 「排進行程」就變成搬家，圖片、備註、途經點都要跟著複製一次。
alter table itinerary_items
  add column if not exists status text not null default 'planned';

-- 想去清單還沒有日期，所以 date 不能再是必填。
-- 既有資料一列都不會變（全部都有日期），只是把限制放開。
alter table itinerary_items alter column date drop not null;

-- 只有 wishlist 可以沒有日期：漏填日期的 planned 會在時間軸上人間蒸發，
-- 與其讓它安靜消失，不如在寫入時就擋下來。
alter table itinerary_items drop constraint if exists itinerary_items_status_date_ck;
alter table itinerary_items add constraint itinerary_items_status_date_ck
  check (
    status in ('planned', 'wishlist', 'backup')
    and (status = 'wishlist' or date is not null)
  );

create index if not exists itinerary_items_status_idx
  on itinerary_items(trip_id, status);
