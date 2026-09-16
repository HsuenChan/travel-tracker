import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { actorFrom, logChange } from "@/lib/activityLog";

/*
  里程／爬升／下降（distance_km / ascent_m / descent_m）刻意不由這支寫入。

  那三個數字是從途經點導出來的，唯一的寫入者是 /api/itinerary/waypoints 的
  deriveWaypointStats。兩支都寫的話會變成後寫的贏：存一次行程就把途經點算出來的
  值蓋掉，而且沒有任何提示。
*/

const STATUSES = ["planned", "wishlist", "backup"] as const;

/**
 * 狀態與日期要對得上。
 *
 * 資料庫有同樣的 check constraint，這裡先擋是為了回一個看得懂的訊息 —— 而且沒有日期的
 * planned 會在時間軸上人間蒸發，那種錯安靜到沒人會發現。
 */
function validateStatus(status: unknown, date: unknown): NextResponse | null {
  if (status !== undefined && !STATUSES.includes(status as typeof STATUSES[number])) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const effective = status ?? "planned";
  if (effective !== "wishlist" && !date) {
    return NextResponse.json({ error: "Date is required unless the item is on the wishlist" }, { status: 400 });
  }
  if (effective === "wishlist" && date) {
    return NextResponse.json({ error: "A wishlist item cannot have a date" }, { status: 400 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const tripId = request.nextUrl.searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const { data: items, error } = await supabase
    .from("itinerary_items")
    .select("*")
    .eq("trip_id", tripId)
    .order("date", { ascending: true })
    .order("time", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: items ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { tripId, date, title, category, time, end_date, end_time, location, notes, image_urls, status } = body;
  const statusError = validateStatus(status, date);
  if (statusError) return statusError;

  const { data: created, error } = await supabase
    .from("itinerary_items")
    .insert({ trip_id: tripId, user_id: user.id, date: date ?? null, title, category, time, end_date: end_date ?? null, end_time: end_time ?? null, location, notes, image_urls: image_urls ?? [], status: status ?? "planned" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logChange({ action: "create", table: "itinerary_items", actor: actorFrom(user), after: created, request });
  return NextResponse.json({ success: true });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { id, date, title, category, time, end_date, end_time, location, notes, image_urls, status } = body;
  const statusError = validateStatus(status, date);
  if (statusError) return statusError;

  // 後台的欄位級 diff 與還原都靠這份舊值，所以覆寫前先讀一次
  const { data: before } = await supabase.from("itinerary_items").select("*").eq("id", id).maybeSingle();

  const { data: after, error } = await supabase
    .from("itinerary_items")
    .update({ date: date ?? null, title, category, time, end_date: end_date ?? null, end_time: end_time ?? null, location, notes, image_urls: image_urls ?? [], status: status ?? "planned" })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logChange({ action: "update", table: "itinerary_items", actor: actorFrom(user), before, after, request });
  return NextResponse.json({ success: true });
}

/**
 * Partial update for display-only flags.
 *
 * Separate from PUT on purpose: PUT writes the whole row, so calling it with a single field
 * would blank the rest. Only the whitelisted keys below can be set here.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id, show_elevation, status, date } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data: before } = await supabase.from("itinerary_items").select("*").eq("id", id).maybeSingle();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (show_elevation === null || typeof show_elevation === "boolean") {
    patch.show_elevation = show_elevation;
  }
  /*
    「排進某一天」是同時改 status 與 date，所以兩個一起走這裡。

    沒帶 date 時要拿這一列現有的日期去驗證，不能當成沒有日期 —— 只切備案的請求本來就不會
    帶日期，而那一列明明有；用 undefined 去驗證會把「標為備案」整個擋掉。
    帶了才動它：null 是丟回想去清單，字串是排到那一天。
  */
  if (status !== undefined) {
    const effectiveDate = date !== undefined ? date : before.date;
    const statusError = validateStatus(status, effectiveDate);
    if (statusError) return statusError;
    patch.status = status;
  }
  if (date !== undefined) patch.date = date;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const { data: after, error } = await supabase.from("itinerary_items").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logChange({ action: "update", table: "itinerary_items", actor: actorFrom(user), before, after, request });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await request.json();

  // 刪除後這筆就不在了，還原完全靠這份快照
  const { data: before } = await supabase.from("itinerary_items").select("*").eq("id", id).maybeSingle();

  const { error } = await supabase
    .from("itinerary_items")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logChange({ action: "delete", table: "itinerary_items", actor: actorFrom(user), before, entityId: id, request });
  return NextResponse.json({ success: true });
}
