import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const tripId = request.nextUrl.searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const { data, error } = await supabase
    .from("settlement_paid")
    .select("pair_key")
    .eq("trip_id", tripId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: (data ?? []).map((row) => row.pair_key) });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { tripId, pairKey } = await request.json();
  if (!tripId || !pairKey) return NextResponse.json({ error: "tripId and pairKey required" }, { status: 400 });

  const { error } = await supabase
    .from("settlement_paid")
    .upsert({ trip_id: tripId, pair_key: pairKey });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { tripId, pairKey } = await request.json();
  if (!tripId || !pairKey) return NextResponse.json({ error: "tripId and pairKey required" }, { status: 400 });

  const { error } = await supabase
    .from("settlement_paid")
    .delete()
    .eq("trip_id", tripId)
    .eq("pair_key", pairKey);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
