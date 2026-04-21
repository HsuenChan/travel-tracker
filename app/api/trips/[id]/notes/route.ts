import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: trip } = await supabase
    .from("trips")
    .select("ai_notes")
    .eq("id", id)
    .single();

  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ notes: trip.ai_notes ?? null });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Verify user has access to this trip (owner or member)
  const { data: access } = await supabase.from("trips").select("id").eq("id", id).single();
  if (!access) return NextResponse.json({ error: "Not found or no access" }, { status: 404 });

  const { notes } = await request.json();

  // Use service client so members (not just owners) can save notes
  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from("trips")
    .update({ ai_notes: notes })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
