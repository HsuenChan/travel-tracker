-- 旅程的當地時區，每日推播決定「早上八點是哪裡的八點」用
-- Run in Supabase SQL Editor after 01_schema.sql (safe to re-run)
--
-- 平常留空，由目的地座標推算（見 lib/tripTimezone.ts）。旅途中打開 App 時會把裝置時區寫進來
-- 蓋掉推算值 —— 那是實測值，比推算準，也涵蓋沒收錄的國家與一國跨多時區的情況。
--
-- 只在「今天落在這趟的起訖日之間」才寫：提前訂票時人還在家裡，那時候的裝置時區是出發地
-- 而不是目的地，寫進來會把推播時間整個帶偏。
alter table trips add column if not exists time_zone text;
