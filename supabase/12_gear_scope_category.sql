-- Personal vs group gear, and a single category per item
-- Run in Supabase SQL Editor after 08_gear_closet.sql (safe to re-run)

-- ─────────────────────────────────────────────────────────────
-- ① 個人／公裝
-- ─────────────────────────────────────────────────────────────
alter table gear_items add column if not exists scope text;
alter table gear_items
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

-- 既有資料一律視為公裝（group）。若讓它們吃 'personal' 的預設值，owner_user_id 會是 null，
-- 而 null 永遠不等於 auth.uid() —— 那些裝備就會對所有人隱形（包含建立者）。
update gear_items set scope = 'group' where scope is null;

alter table gear_items alter column scope set default 'personal';
alter table gear_items alter column scope set not null;

-- Postgres 沒有 add constraint if not exists
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gear_items_scope_check') then
    alter table gear_items
      add constraint gear_items_scope_check check (scope in ('personal', 'group'));
  end if;
end $$;

create index if not exists gear_items_owner_idx
  on gear_items(owner_user_id) where owner_user_id is not null;

-- ─────────────────────────────────────────────────────────────
-- ② 分類改成單選（tags text[] → category text）
--    搬移與刪除都包在存在性檢查裡，這個檔案才能重複執行 ——
--    第二次執行時 tags 已經不存在，直接跑 tags[1] 會噴 column does not exist。
-- ─────────────────────────────────────────────────────────────
alter table gear_items  add column if not exists category text;
alter table gear_closet add column if not exists category text;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'gear_items' and column_name = 'tags') then
    update gear_items set category = tags[1]
      where category is null and tags is not null and array_length(tags, 1) >= 1;
    alter table gear_items drop column tags;
  end if;

  if exists (select 1 from information_schema.columns
             where table_name = 'gear_closet' and column_name = 'tags') then
    update gear_closet set category = tags[1]
      where category is null and tags is not null and array_length(tags, 1) >= 1;
    alter table gear_closet drop column tags;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- ③ RLS：兩條 permissive policy 會以 OR 結合 ——
--    公裝走第一條，自己的個人裝備走第二條，
--    別人的個人裝備兩條都不符合 → 讀不到也改不了。
-- ─────────────────────────────────────────────────────────────
drop policy if exists "trip members manage gear items" on gear_items;
drop policy if exists "trip members manage group gear" on gear_items;
drop policy if exists "owners manage personal gear" on gear_items;

create policy "trip members manage group gear" on gear_items
  for all
  using (
    scope = 'group' and (
      exists (select 1 from trips t where t.id = gear_items.trip_id and t.user_id = auth.uid())
      or exists (select 1 from trip_members m where m.trip_id = gear_items.trip_id and m.user_id = auth.uid())
    )
  )
  with check (
    scope = 'group' and (
      exists (select 1 from trips t where t.id = gear_items.trip_id and t.user_id = auth.uid())
      or exists (select 1 from trip_members m where m.trip_id = gear_items.trip_id and m.user_id = auth.uid())
    )
  );

-- 個人裝備只認 owner 本人。with check 同時擋掉「把裝備掛到別人名下」。
create policy "owners manage personal gear" on gear_items
  for all
  using (scope = 'personal' and owner_user_id = auth.uid())
  with check (scope = 'personal' and owner_user_id = auth.uid());
