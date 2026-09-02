import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TYPES = ["trailhead", "peak", "hut", "camp", "water", "junction", "other"];

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function int(value: unknown, fallback: number | null = null): number | null {
  const n = num(value);
  return n === null ? fallback : Math.round(n);
}

export async function GET(request: NextRequest) {
  const itemId = request.nextUrl.searchParams.get("itineraryItemId");
  if (!itemId) return NextResponse.json({ error: "Missing itineraryItemId" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // 同 /api/gear：RLS 擋掉的匿名讀取會回空陣列，這裡直接擋成 401。
  // 分享頁的高度圖資料由 /api/share/[token] 提供。
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("route_waypoints")
    .select("*")
    .eq("itinerary_item_id", itemId)
    .order("order_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ waypoints: data || [] });
}

/**
 * Replaces the whole waypoint list for one itinerary item — the editor submits the rows it
 * has, so a diff would only add ways to get out of sync with what the user sees.
 *
 * The leg's distance / ascent / descent are derived here and written back onto the itinerary
 * item, so the timeline and the trip total can be drawn without loading every waypoint.
 */
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { itineraryItemId, waypoints } = await request.json();
  if (!itineraryItemId) return NextResponse.json({ error: "Missing itineraryItemId" }, { status: 400 });
  if (!Array.isArray(waypoints)) return NextResponse.json({ error: "waypoints must be an array" }, { status: 400 });

  const rows = waypoints
    .filter((w: Record<string, unknown>) => String(w?.name ?? "").trim() !== "")
    .map((w: Record<string, unknown>, i: number) => ({
      itinerary_item_id: itineraryItemId,
      order_index: i,
      name: String(w.name).trim(),
      elevation_m: num(w.elevation_m),
      distance_km: num(w.distance_km),
      day_offset: Math.max(0, int(w.day_offset, 0) ?? 0),
      duration_out_min: int(w.duration_out_min),
      duration_back_min: int(w.duration_back_min),
      type: TYPES.includes(String(w.type)) ? String(w.type) : null,
      lat: num(w.lat),
      lng: num(w.lng),
      notes: (w.notes as string) ?? null,
    }));

  const { error: delError } = await supabase
    .from("route_waypoints")
    .delete()
    .eq("itinerary_item_id", itineraryItemId);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  let inserted: unknown[] = [];
  if (rows.length > 0) {
    const { data, error } = await supabase.from("route_waypoints").insert(rows).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    inserted = data ?? [];
  }

  const stats = deriveStats(rows);
  const { error: itemError } = await supabase
    .from("itinerary_items")
    .update(stats)
    .eq("id", itineraryItemId);
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });

  return NextResponse.json({ waypoints: inserted, ...stats });
}

/** 里程取最後一個累積距離；爬升／下降是相鄰海拔差的正負累加 */
function deriveStats(rows: { elevation_m: number | null; distance_km: number | null }[]) {
  if (rows.length === 0) return { distance_km: null, ascent_m: null, descent_m: null };

  const distances = rows.map((r) => r.distance_km).filter((d): d is number => d !== null);
  const distance_km = distances.length > 0 ? Math.max(...distances) : null;

  let ascent = 0, descent = 0, seen = 0;
  let prev: number | null = null;
  for (const r of rows) {
    if (r.elevation_m === null) continue;
    seen++;
    if (prev !== null) {
      const d = r.elevation_m - prev;
      if (d > 0) ascent += d; else descent -= d;
    }
    prev = r.elevation_m;
  }

  return {
    distance_km,
    ascent_m: seen >= 2 ? Math.round(ascent) : null,
    descent_m: seen >= 2 ? Math.round(descent) : null,
  };
}
