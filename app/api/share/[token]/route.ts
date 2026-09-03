import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: tripRow, error } = await supabase
    .from("trips")
    .select("id, name, start_date, end_date, countries, notes, photo_album_id, people, currency, ai_notes")
    .eq("share_token", token)
    .single();

  if (error || !tripRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ai_notes 是「筆記」分頁的內容（{ content }），與 trips.notes（旅程簡介）不同
  const { ai_notes: note, ...trip } = tripRow;

  const { data: segments } = await supabase
    .from("segments")
    .select("*")
    .eq("trip_id", trip.id)
    .order("order", { ascending: true });

  const { data: itinerary } = await supabase
    .from("itinerary_items")
    .select("*")
    .eq("trip_id", trip.id)
    .order("date", { ascending: true })
    .order("time", { ascending: true, nullsFirst: true });

  // 帶出關聯行程；06_expense_itinerary_link.sql 未執行時退回不帶關聯的查詢
  const linked = await supabase
    .from("expenses")
    .select("*, itinerary_items(id, title, date)")
    .eq("trip_id", trip.id)
    .order("date", { ascending: true });
  const plain = linked.error
    ? await supabase.from("expenses").select("*").eq("trip_id", trip.id).order("date", { ascending: true })
    : null;
  const expenses = (linked.data ?? plain?.data ?? []).map((row) => {
    const { itinerary_items, ...rest } = row as Record<string, unknown> & {
      itinerary_items?: { id: string; title: string; date: string } | null;
    };
    return { ...rest, itinerary_title: itinerary_items?.title ?? null };
  });

  // 裝備與途經點的 RLS 只放行旅程成員，所以唯讀分享頁一律由這裡（service client）供資料，
   // 前端不再自己打 /api/gear 與 /api/itinerary/waypoints
  // service client 繞過 RLS，所以這裡必須自己排除個人裝備 ——
  // 否則貼出去的唯讀連結會把所有人的個人打包清單一起露出去。
  const { data: gear } = await supabase
    .from("gear_items")
    .select("*")
    .eq("trip_id", trip.id)
    .eq("scope", "group")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  const itemIds = (itinerary ?? []).map((i) => i.id);
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
    segments: segments ?? [],
    itinerary: itinerary ?? [],
    expenses,
    note: note ?? null,
    gear: gear ?? [],
    waypoints,
  });
}
