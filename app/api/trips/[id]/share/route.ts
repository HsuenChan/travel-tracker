import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Allow owner or members to get share URL (RLS handles access control)
  const { data: trip } = await supabase
    .from("trips")
    .select("share_token")
    .eq("id", id)
    .single();

  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { origin } = new URL(request.url);
  return NextResponse.json({ shareUrl: `${origin}/share/${trip.share_token}` });
}
