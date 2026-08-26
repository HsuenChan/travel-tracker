import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";

/* settlement_paid 建表時沒開放 user-scoped 寫入（RLS），
   這裡改走 service role ＋ 明確檢查「旅程擁有者或成員」 */
async function canAccessTrip(service: SupabaseClient, tripId: string, userId: string) {
  const { data: trip } = await service.from("trips").select("user_id").eq("id", tripId).maybeSingle();
  if (!trip) return false;
  if (trip.user_id === userId) return true;
  const { data: member } = await service
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!member;
}

async function authorize(tripId: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (!tripId) return { error: NextResponse.json({ error: "tripId required" }, { status: 400 }) };

  const service = createServiceClient();
  if (!(await canAccessTrip(service, tripId, user.id))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { service };
}

export async function GET(request: NextRequest) {
  const tripId = request.nextUrl.searchParams.get("tripId");
  const { service, error } = await authorize(tripId);
  if (error) return error;

  const { data, error: dbError } = await service
    .from("settlement_paid")
    .select("pair_key")
    .eq("trip_id", tripId);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ keys: (data ?? []).map((row) => row.pair_key) });
}

export async function POST(request: NextRequest) {
  const { tripId, pairKey } = await request.json();
  if (!pairKey) return NextResponse.json({ error: "tripId and pairKey required" }, { status: 400 });
  const { service, error } = await authorize(tripId ?? null);
  if (error) return error;

  const { error: dbError } = await service
    .from("settlement_paid")
    .upsert({ trip_id: tripId, pair_key: pairKey });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { tripId, pairKey } = await request.json();
  if (!pairKey) return NextResponse.json({ error: "tripId and pairKey required" }, { status: 400 });
  const { service, error } = await authorize(tripId ?? null);
  if (error) return error;

  const { error: dbError } = await service
    .from("settlement_paid")
    .delete()
    .eq("trip_id", tripId)
    .eq("pair_key", pairKey);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
