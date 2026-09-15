import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TRIP_TAB_KEYS, resolveSharedTabs } from "@/lib/tripTabs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Allow owner or members to get share URL (RLS handles access control)
  const { data: trip } = await supabase
    .from("trips")
    .select("share_token, shared_tabs, enabled_tabs")
    .eq("id", id)
    .single();

  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // share_allow_copy 要等 23_share_fork.sql；單獨查，併進上面的 select 會讓整個分享設定
  // 在跑 migration 之前變成 404。查不到就當作開放（與欄位預設一致）
  const allowRow = await supabase
    .from("trips")
    .select("share_allow_copy")
    .eq("id", id)
    .maybeSingle();

  const { origin } = new URL(request.url);
  return NextResponse.json({
    shareUrl: `${origin}/share/${trip.share_token}`,
    // 分享範圍設定的預選值：沒設定過就是這趟啟用的分頁
    sharedTabs: resolveSharedTabs(trip.shared_tabs, trip.enabled_tabs),
    enabledTabs: trip.enabled_tabs ?? TRIP_TAB_KEYS,
    allowCopy: allowRow.error ? true : allowRow.data?.share_allow_copy ?? true,
  });
}

/**
 * 設定這條分享連結要露出哪些分頁。
 *
 * 一趟旅程只有一條分享連結，所以這份設定是連結的可見範圍本身 —— 改完之後，之前貼出去的
 * 同一條連結看到的東西也跟著變。
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { tabs, allowCopy } = await request.json();
  if (!Array.isArray(tabs)) return NextResponse.json({ error: "tabs must be an array" }, { status: 400 });

  // 用這趟自己的分頁順序過濾：順序就是分享頁的分頁順序，旅程裡關掉的分頁也順帶擋掉
  const { data: trip } = await supabase
    .from("trips")
    .select("enabled_tabs")
    .eq("id", id)
    .single();
  const order: string[] = trip?.enabled_tabs?.length ? trip.enabled_tabs : TRIP_TAB_KEYS;
  const cleaned = order.filter((key) => tabs.includes(key) && TRIP_TAB_KEYS.includes(key));
  if (cleaned.length === 0) {
    return NextResponse.json({ error: "Pick at least one tab to share" }, { status: 400 });
  }

  const { error } = await supabase.from("trips").update({ shared_tabs: cleaned }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 分開寫：23_share_fork.sql 還沒跑的時候，分享範圍仍然要存得起來
  let savedAllowCopy = true;
  if (typeof allowCopy === "boolean") {
    const { error: allowError } = await supabase
      .from("trips")
      .update({ share_allow_copy: allowCopy })
      .eq("id", id);
    savedAllowCopy = allowError ? true : allowCopy;
  }

  return NextResponse.json({ success: true, sharedTabs: cleaned, allowCopy: savedAllowCopy });
}
