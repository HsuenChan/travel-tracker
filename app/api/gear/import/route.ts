import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lighterPackListId, parseLighterPackCsv } from "@/lib/gear";

const MAX_CSV_BYTES = 512 * 1024;

/**
 * Parses a LighterPack gear list into gear rows. Parse only — nothing is written here, so the
 * client can show what it is about to add before committing it.
 *
 * Two inputs, because LighterPack has no public API: an uploaded CSV (Share → Export to CSV,
 * the reliable path), or a share link, from which we derive lighterpack.com/csv/<id>. Only
 * that host is ever fetched, so this cannot be used as a general-purpose URL fetcher.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let csv: string | null = null;
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
    if (file.size > MAX_CSV_BYTES) return NextResponse.json({ error: "CSV too large" }, { status: 413 });
    csv = await file.text();
  } else {
    const { url } = await request.json();
    const listId = typeof url === "string" ? lighterPackListId(url) : null;
    if (!listId) return NextResponse.json({ error: "Unrecognised LighterPack link" }, { status: 400 });
    try {
      const res = await fetch(`https://lighterpack.com/csv/${listId}`, {
        headers: { "User-Agent": "travel-tracker-app/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return NextResponse.json({ error: "LighterPack list not found or not shared" }, { status: 404 });
      csv = await res.text();
    } catch {
      return NextResponse.json({ error: "Could not reach LighterPack" }, { status: 502 });
    }
  }

  const { rows, skipped } = parseLighterPackCsv(csv);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No gear rows found in that CSV" }, { status: 422 });
  }

  const totalWeight = rows.reduce((sum, r) => sum + (r.weight_g ?? 0) * r.qty, 0);
  return NextResponse.json({ rows, skipped, totalWeight });
}
