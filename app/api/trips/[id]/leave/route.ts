import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();

  const { data: trip } = await service.from("trips").select("user_id").eq("id", id).single();
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (trip.user_id === user.id) return NextResponse.json({ error: "Owner cannot leave" }, { status: 403 });

  await service.from("trip_members").delete().eq("trip_id", id).eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
