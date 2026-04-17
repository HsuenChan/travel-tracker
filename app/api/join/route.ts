import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const serviceClient = createServiceClient();

  const { data: trip, error: tripError } = await serviceClient
    .from("trips")
    .select("id, user_id, name")
    .eq("invite_token", token)
    .single();

  if (tripError) return NextResponse.json({ error: "Server error", detail: tripError.message }, { status: 500 });
  if (!trip) return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });

  // Already the owner
  if (trip.user_id === user.id) {
    return NextResponse.json({ tripId: trip.id, alreadyOwner: true });
  }

  // Add to trip_members (upsert to handle duplicate joins)
  await serviceClient
    .from("trip_members")
    .upsert(
      { trip_id: trip.id, user_id: user.id, role: "editor" },
      { onConflict: "trip_id,user_id" }
    );

  return NextResponse.json({ tripId: trip.id, tripName: trip.name });
}
