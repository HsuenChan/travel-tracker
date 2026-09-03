import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Deletes one category across a trip's whole gear list — the tag is stripped from every item
 * that carries it; the items themselves stay. An item left with no tags falls back to 未分類.
 *
 * PostgREST has no array_remove in an update expression, so this reads the affected rows and
 * writes them back. It runs on the user-scoped client, so the gear_items RLS policy is what
 * decides whether the caller may touch this trip.
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { tripId, tag } = await request.json();
  if (!tripId || typeof tag !== "string" || tag === "") {
    return NextResponse.json({ error: "Missing tripId or tag" }, { status: 400 });
  }

  const { data: rows, error } = await supabase
    .from("gear_items")
    .select("id, tags")
    .eq("trip_id", tripId)
    .contains("tags", [tag]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json({ updated: 0 });

  const results = await Promise.all(
    rows.map((row) => {
      const tags = (row.tags as string[] | null)?.filter((t) => t !== tag) ?? [];
      return supabase
        .from("gear_items")
        .update({ tags: tags.length > 0 ? tags : null })
        .eq("id", row.id);
    })
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  return NextResponse.json({ updated: rows.length });
}
