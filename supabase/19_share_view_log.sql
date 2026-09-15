-- 分享連結的瀏覽紀錄
-- Run in Supabase SQL Editor after 16_activity_log.sql (safe to re-run)
--
-- 後台原本只分「資料被改了」（change）與「登入登出」（auth）。分享連結的瀏覽是第三種：
-- 沒有帳號的人用一條連結讀了一整趟旅程 —— 那既不是異動也不是登入，但旅程擁有者
-- 應該看得到。
--
-- 它跟 auth 一起顯示在「存取」頁：兩者回答的是同一個問題（誰在什麼時候碰到這個系統），
-- 而「異動」頁只回答「資料被改成什麼樣」。
alter table activity_log drop constraint if exists activity_log_kind_check;
alter table activity_log
  add constraint activity_log_kind_check
  check (kind in ('change', 'auth', 'view'));

-- 去重用：同一條連結、同一個來源 IP，30 分鐘內只留一筆。
-- 分享頁一重整就是一次瀏覽，手機上讀個行程可以按十幾次，不擋的話這一頁會被洗成雜訊。
create index if not exists activity_log_view_dedupe_idx
  on activity_log (kind, trip_id, ip, created_at desc)
  where kind = 'view';
