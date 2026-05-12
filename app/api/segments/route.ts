import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tripId = searchParams.get("tripId");

  let query = supabase
    .from("segments")
    .select("*")
    .order("order", { ascending: true });

  if (tripId) query = query.eq("trip_id", tripId);

  const { data: segments, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ segments: segments ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { tripId, order, from, fromIata, to, toIata, type, date, time, arrivalDate, arrivalTime, flightNo, aircraft } = body;

  const { data, error } = await supabase
    .from("segments")
    .insert({
      user_id: user.id,
      trip_id: tripId,
      order: order ?? 0,
      from_city: from,
      from_iata: fromIata || null,
      to_city: to,
      to_iata: toIata || null,
      type,
      date: date || null,
      time: time || null,
      arrival_date: arrivalDate || null,
      arrival_time: arrivalTime || null,
      flight_no: flightNo || null,
      aircraft: aircraft || null,
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
  const { id, from, fromIata, to, toIata, type, date, time, arrivalDate, arrivalTime, flightNo, aircraft } = body;

  const { error } = await supabase
    .from("segments")
    .update({
      from_city: from,
      from_iata: fromIata || null,
      to_city: to,
      to_iata: toIata || null,
      type,
      date: date || null,
      time: time || null,
      arrival_date: arrivalDate || null,
      arrival_time: arrivalTime || null,
      flight_no: flightNo || null,
      aircraft: aircraft || null,
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
    .from("segments")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
