-- 分享連結是否開放對方複製成自己的旅程
-- Run in Supabase SQL Editor after 15_share_tabs.sql (safe to re-run)
--
-- 預設開放：複製帶走的內容，本來就是這條連結已經讓對方看得到的行程 —— 開放複製不會多露任何
-- 東西，只是省下對方照著重打一次。不想被複製的連結可以逐趟關掉。
alter table trips add column if not exists share_allow_copy boolean not null default true;
