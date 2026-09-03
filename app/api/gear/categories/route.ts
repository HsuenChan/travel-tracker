import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Deletes one category across a trip's gear list, or renames it.
 *
 * DELETE clears the category on every item that carries it; the items themselves stay and fall
 * back to 未分類. PATCH renames it in place.
 *
 * Runs on the user-scoped client, so the gear_items RLS policies decide what the caller may
 * touch — which also means someone else's personal gear is never rewritten from here.
 */
async function affected(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const body = await request.json();
  const { tripId, category } = body;
  if (!tripId || typeof category !== "string" || category === "") {
    return { error: NextResponse.json({ error: "Missing tripId or category" }, { status: 400 }) };
  }
  return { supabase, tripId: tripId as string, category, body };
}

export async function DELETE(request: NextRequest) {
  const ctx = await affected(request);
  if ("error" in ctx) return ctx.error;
  const { supabase, tripId, category } = ctx;

  const { data, error } = await supabase
    .from("gear_items")
    .update({ category: null })
    .eq("trip_id", tripId)
    .eq("category", category)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data?.length ?? 0 });
}

export async function PATCH(request: NextRequest) {
  const ctx = await affected(request);
  if ("error" in ctx) return ctx.error;
  const { supabase, tripId, category, body } = ctx;

  const renameTo = typeof body.renameTo === "string" ? body.renameTo.trim() : "";
  if (!renameTo) return NextResponse.json({ error: "Missing renameTo" }, { status: 400 });
  if (renameTo === category) return NextResponse.json({ updated: 0 });

  const { data, error } = await supabase
    .from("gear_items")
    .update({ category: renameTo })
    .eq("trip_id", tripId)
    .eq("category", category)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data?.length ?? 0 });
}
