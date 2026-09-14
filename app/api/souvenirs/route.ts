import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { actorFrom, logChange } from "@/lib/activityLog";

export async function GET(request: NextRequest) {
  const tripId = request.nextUrl.searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "Missing tripId" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // souvenirs 開了 RLS 之後，匿名讀取會靜靜回空陣列而不是報錯，明確擋成 401 比較好 debug。
  // 唯讀分享頁不走這裡，資料由 /api/share/[token] 以 service client 提供。
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("souvenirs")
    .select("*")
    .eq("trip_id", tripId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { tripId, name, notes, image_url, tags } = await request.json();

  const { data, error } = await supabase
    .from("souvenirs")
    .insert({ trip_id: tripId, name, notes, image_url, tags, is_checked: false, order_index: 0 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logChange({ action: "create", table: "souvenirs", actor: actorFrom(user), after: data, request });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id, is_checked, name, notes, image_url, tags, order_index } = await request.json();

  // 後台的欄位級 diff 與還原都靠這份舊值
  const { data: before } = await supabase.from("souvenirs").select("*").eq("id", id).maybeSingle();

  const { data, error } = await supabase
    .from("souvenirs")
    .update({ is_checked, name, notes, image_url, tags, order_index })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logChange({ action: "update", table: "souvenirs", actor: actorFrom(user), before, after: data, request });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await request.json();

  // 刪除後這筆就不在了，還原完全靠這份快照
  const { data: before } = await supabase.from("souvenirs").select("*").eq("id", id).maybeSingle();

  const { error } = await supabase
    .from("souvenirs")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logChange({ action: "delete", table: "souvenirs", actor: actorFrom(user), before, entityId: id, request });
  return NextResponse.json({ success: true });
}
