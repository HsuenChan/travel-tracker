import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id, is_checked, name, notes, image_url, tags, order_index } = await request.json();

  const { data, error } = await supabase
    .from("souvenirs")
    .update({ is_checked, name, notes, image_url, tags, order_index })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await request.json();

  const { error } = await supabase
    .from("souvenirs")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
