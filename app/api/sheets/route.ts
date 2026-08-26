import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: trips, error } = await supabase
    .from("trips")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 附上每趟旅程的封面（第一筆有照片的行程），單一查詢避免 N+1
  const list = trips ?? [];
  if (list.length > 0) {
    const { data: items } = await supabase
      .from("itinerary_items")
      .select("trip_id,image_urls,date,time")
      .in("trip_id", list.map((t) => t.id))
      .not("image_urls", "is", null)
      .order("date", { ascending: true })
      .order("time", { ascending: true, nullsFirst: true });
    const coverMap: Record<string, string> = {};
    for (const it of items ?? []) {
      if (!coverMap[it.trip_id] && it.image_urls?.length > 0) coverMap[it.trip_id] = it.image_urls[0];
    }
    for (const t of list) t.cover_url = coverMap[t.id] ?? null;
  }

  return NextResponse.json({ trips: list });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { name, startDate, endDate, countries, notes, photoAlbumId, people, currency, destinations, enabledTabs, country_codes } = body;

  const { data, error } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      name,
      start_date: startDate || null,
      end_date: endDate || null,
      countries: countries || null,
      notes: notes || null,
      photo_album_id: photoAlbumId || null,
      people: people ?? [],
      currency: currency || "TWD",
      destinations: destinations ?? [],
      enabled_tabs: enabledTabs ?? ['transport','itinerary','expenses','photos','notes'],
      country_codes: country_codes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { id, name, startDate, endDate, countries, notes, photoAlbumId, people, currency, destinations, enabledTabs, country_codes } = body;

  const { error } = await supabase
    .from("trips")
    .update({
      name,
      start_date: startDate || null,
      end_date: endDate || null,
      countries: countries || null,
      notes: notes || null,
      photo_album_id: photoAlbumId || null,
      people: people ?? [],
      currency: currency || "TWD",
      destinations: destinations ?? [],
      enabled_tabs: enabledTabs ?? ['transport','itinerary','expenses','photos','notes'],
      country_codes: country_codes || null,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await request.json();

  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
