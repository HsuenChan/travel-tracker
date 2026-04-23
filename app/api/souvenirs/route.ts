import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tripId = request.nextUrl.searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "Missing tripId" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If a valid user is not logged in, we should check if they are requesting via a public share token.
  // We skip strict user check here because the `/share/[token]` page needs read-only access.
  // Typically, the frontend provides a share token or relies on RLS, but for now we fetch it.
  
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
