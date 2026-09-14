-- 縱剖面圖需要的三個欄位：落水潭、錨點註記、路段分段
-- Run in Supabase SQL Editor after 09_itinerary_outdoor.sql (safe to re-run)
--
-- 這三件事都是官方 CanyonTopo 圖上畫得出來、但現有欄位表達不了的：
--
--   pool_type    落水潭深淺。不是裝飾 —— 落進去的是淺潭（可能撞底）、深潭，還是會把人
--                壓住的 hydraulic，是現場決定跳不跳的依據。原圖沒區分時用 'unknown'。
--   anchor_note  錨點註記（'TR X X' = 右岸兩顆岩栓）。圖上是標籤底下那一行小字，
--                塞進 notes 會跟人寫的長段落混在一起，畫面上再也分不出哪一段是錨點資訊。
--   section      屬於哪一段。Major Mayhem 有 80 個障礙，不分段會變成一張爆寬的圖。
--                day_offset 是「第幾天」，語意不同，不能挪用。
alter table route_waypoints
  add column if not exists pool_type text,
  add column if not exists anchor_note text,
  add column if not exists section text;

-- 只收認得的四種，其餘一律擋下 —— 畫面依這個值選顏色，寫進奇怪的值會靜靜地畫錯
alter table route_waypoints drop constraint if exists route_waypoints_pool_type_check;
alter table route_waypoints
  add constraint route_waypoints_pool_type_check
  check (pool_type is null or pool_type in ('unknown', 'shallow', 'deep', 'hydraulic'));
