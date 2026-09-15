-- 伺服器端未捕捉例外的紀錄
-- Run in Supabase SQL Editor (safe to re-run)
--
-- 來源是 Next 的 instrumentation.ts / onRequestError —— 它收得到 route handler、
-- Server Component 與 Server Action 真正拋出來的錯誤。比在每支 API 包 try/catch 好的
-- 地方是不會漏：之後新增的 API 自動就被涵蓋。
--
-- 刻意「只記例外」：像 return NextResponse.json({ error }, { status: 500 }) 那種不是
-- 例外而是正常回應，onRequestError 收不到；而 4xx 多半是正常的驗證失敗，記了只會變噪音，
-- 把真正的當機埋掉。
create table if not exists api_errors (
  id uuid primary key default gen_random_uuid(),

  -- 實際被請求的路徑（含 query），例如 /api/itinerary?tripId=...
  path text not null,
  method text,
  -- 路由檔案的位置，例如 /api/trips/[id]/notes/generate
  route_path text,
  -- route / render / action / proxy
  route_type text,

  message text not null,
  stack text,
  -- Next 給的錯誤指紋，同一個錯誤在不同請求間會一樣
  digest text,

  ip text,
  user_agent text,

  created_at timestamptz not null default now()
);

create index if not exists api_errors_created_idx on api_errors (created_at desc);

-- 去重用：同一支路由、同一個訊息，短時間內只留一筆。
-- 一支壞掉的 API 被前端輪詢就會是幾千筆一模一樣的錯誤，不擋的話這頁讀不了，
-- 真正需要注意的其他錯誤也會被洗掉。
create index if not exists api_errors_dedupe_idx on api_errors (route_path, message, created_at desc);

-- 只有後台讀得到，而後台走 service client（繞過 RLS）。開 RLS 但不給 policy，
-- 等於前端拿 anon key 一列都讀不到 —— stack trace 會揭露伺服器路徑與程式結構。
alter table api_errors enable row level security;
