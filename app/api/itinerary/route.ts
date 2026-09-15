import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { actorFrom, logChange } from "@/lib/activityLog";

/*
  里程／爬升／下降（distance_km / ascent_m / descent_m）刻意不由這支寫入。

  那三個數字是從途經點導出來的，唯一的寫入者是 /api/itinerary/waypoints 的
  deriveWaypointStats。兩支都寫的話會變成後寫的贏：存一次行程就把途經點算出來的
  值蓋掉，而且沒有任何提示。
*/

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
  const { tripId, date, title, category, time, end_date, end_time, location, notes, image_urls } = body;

  const { data: created, error } = await supabase
    .from("itinerary_items")
    .insert({ trip_id: tripId, user_id: user.id, date, title, category, time, end_date: end_date ?? null, end_time: end_time ?? null, location, notes, image_urls: image_urls ?? [] })
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
  const { id, date, title, category, time, end_date, end_time, location, notes, image_urls } = body;

  // 後台的欄位級 diff 與還原都靠這份舊值，所以覆寫前先讀一次
  const { data: before } = await supabase.from("itinerary_items").select("*").eq("id", id).maybeSingle();

  const { data: after, error } = await supabase
    .from("itinerary_items")
    .update({ date, title, category, time, end_date: end_date ?? null, end_time: end_time ?? null, location, notes, image_urls: image_urls ?? [] })
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

  const { id, show_elevation } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (show_elevation === null || typeof show_elevation === "boolean") {
    patch.show_elevation = show_elevation;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data: before } = await supabase.from("itinerary_items").select("*").eq("id", id).maybeSingle();
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
