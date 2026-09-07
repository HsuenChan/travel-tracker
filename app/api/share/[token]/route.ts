import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveSharedTabs } from "@/lib/tripTabs";

/**
 * 唯讀分享頁的資料來源。
 *
 * 只回傳被分享的分頁 —— 沒勾的分頁連查詢都不發，資料不會離開伺服器，而不是查回來以後在畫面
 * 上藏起來（那種藏法打開 devtools 就看得到）。
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();

  const COLUMNS = "id, name, start_date, end_date, countries, notes, photo_album_id, people, currency, ai_notes, enabled_tabs";

  // shared_tabs 是 15_share_tabs.sql 才有的欄位；還沒跑 migration 時退回只讀 enabled_tabs，
  // 不要讓既有的分享連結整頁變成「找不到這筆旅程」
  const scoped = await supabase
    .from("trips")
    .select(`${COLUMNS}, shared_tabs`)
    .eq("share_token", token)
    .single();
  const { data: tripRow, error } = scoped.error
    ? await supabase.from("trips").select(COLUMNS).eq("share_token", token).single()
    : scoped;

  if (error || !tripRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ai_notes 是「筆記」分頁的內容（{ content }），與 trips.notes（旅程簡介）不同
  const { ai_notes: note, shared_tabs, enabled_tabs, ...rest } = tripRow as typeof tripRow & { shared_tabs?: string[] | null };
  const tabs = resolveSharedTabs(shared_tabs, enabled_tabs);
  const shared = (key: string) => tabs.includes(key);

  const trip = {
    ...rest,
    // 分享頁就是照這份清單畫分頁與排序，所以這裡回的是「這條連結看得到的分頁」
    enabled_tabs: tabs,
    photo_album_id: shared("photos") ? rest.photo_album_id : null,
  };

  const segments = shared("transport")
    ? (await supabase
        .from("segments")
        .select("*")
        .eq("trip_id", trip.id)
        .order("order", { ascending: true })).data ?? []
    : [];

  const itinerary = shared("itinerary")
    ? (await supabase
        .from("itinerary_items")
        .select("*")
        .eq("trip_id", trip.id)
        .order("date", { ascending: true })
        .order("time", { ascending: true, nullsFirst: true })).data ?? []
    : [];

  let expenses: Record<string, unknown>[] = [];
  if (shared("expenses")) {
    // 帶出關聯行程；06_expense_itinerary_link.sql 未執行時退回不帶關聯的查詢
    const linked = await supabase
      .from("expenses")
      .select("*, itinerary_items(id, title, date)")
      .eq("trip_id", trip.id)
      .order("date", { ascending: true });
    const plain = linked.error
      ? await supabase.from("expenses").select("*").eq("trip_id", trip.id).order("date", { ascending: true })
      : null;
    expenses = (linked.data ?? plain?.data ?? []).map((row) => {
      const { itinerary_items, ...expense } = row as Record<string, unknown> & {
        itinerary_items?: { id: string; title: string; date: string } | null;
      };
      // 沒分享行程時連行程名稱都不帶：那是費用列表上唯一會露出行程內容的欄位
      return { ...expense, itinerary_title: shared("itinerary") ? itinerary_items?.title ?? null : null };
    });
  }

  // 裝備與途經點的 RLS 只放行旅程成員，所以唯讀分享頁一律由這裡（service client）供資料，
  // 前端不再自己打 /api/gear 與 /api/itinerary/waypoints
  // service client 繞過 RLS，所以這裡必須自己排除個人裝備 ——
  // 否則貼出去的唯讀連結會把所有人的個人打包清單一起露出去。
  const gear = shared("gear")
    ? (await supabase
        .from("gear_items")
        .select("*")
        .eq("trip_id", trip.id)
        .eq("scope", "group")
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true })).data ?? []
    : [];

  const souvenirs = shared("souvenirs")
    ? (await supabase
        .from("souvenirs")
        .select("*")
        .eq("trip_id", trip.id)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true })).data ?? []
    : [];

  const itemIds = itinerary.map((i) => i.id);
  const waypoints: Record<string, unknown[]> = {};
  if (itemIds.length > 0) {
    const { data: rows } = await supabase
      .from("route_waypoints")
      .select("*")
      .in("itinerary_item_id", itemIds)
      .order("order_index", { ascending: true });
    for (const row of rows ?? []) {
      (waypoints[row.itinerary_item_id] ??= []).push(row);
    }
  }

  return NextResponse.json({
    trip,
    segments,
    itinerary,
    expenses,
    note: shared("notes") ? note ?? null : null,
    gear,
    souvenirs,
    waypoints,
  });
}
