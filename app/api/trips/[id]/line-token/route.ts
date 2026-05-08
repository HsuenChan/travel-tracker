import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateToken(): string {
  return Array.from({ length: 8 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

function formatToken(raw: string): string {
  return `TRIP-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();
  const { data: trip } = await service.from("trips").select("id, user_id, line_token").eq("id", id).single();
  if (!trip || trip.user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let raw = trip.line_token as string | null;
  if (!raw) {
    for (let i = 0; i < 5; i++) {
      raw = generateToken();
      const { error } = await service.from("trips").update({ line_token: raw }).eq("id", id);
      if (!error) break;
    }
  }

  const { count } = await service
    .from("line_group_mappings")
    .select("*", { count: "exact", head: true })
    .eq("default_trip_id", id);

  return NextResponse.json({ token: formatToken(raw!), linked_chats: count ?? 0 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();
  const { data: trip } = await service.from("trips").select("id, user_id").eq("id", id).single();
  if (!trip || trip.user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await service.from("line_group_mappings").delete().eq("default_trip_id", id);

  let raw = generateToken();
  for (let i = 0; i < 5; i++) {
    const { error } = await service.from("trips").update({ line_token: raw }).eq("id", id);
    if (!error) break;
    raw = generateToken();
  }

  return NextResponse.json({ token: formatToken(raw), linked_chats: 0 });
}
