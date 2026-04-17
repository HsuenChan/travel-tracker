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
  return NextResponse.json({ trips: trips ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { name, startDate, endDate, countries, notes, photoAlbumId, people, currency } = body;

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
  const { id, name, startDate, endDate, countries, notes, photoAlbumId, people, currency } = body;

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
