import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, name, start_date, end_date, countries, notes, photo_album_id")
    .eq("share_token", token)
    .single();

  if (error || !trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: segments } = await supabase
    .from("segments")
    .select("*")
    .eq("trip_id", trip.id)
    .order("order", { ascending: true });

  return NextResponse.json({ trip, segments: segments ?? [] });
}
