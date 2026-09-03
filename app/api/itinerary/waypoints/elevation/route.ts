import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveCoords } from "@/lib/coords";

const MAX_POINTS = 100;   // Open-Meteo's batch limit

interface Resolved {
  index: number;
  lat: number;
  lng: number;
  elevation: number | null;
}

/**
 * Looks up terrain elevation for waypoints, from coordinates only.
 *
 * Deliberately no place-name geocoding: names like "R14" or a hut name resolve to whatever
 * shares that name elsewhere in the world, and a silently wrong elevation on a canyon topo is
 * worse than a blank one. Accepts a coordinate pair or a Google Maps link per point.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { points } = await request.json();
  if (!Array.isArray(points) || points.length === 0) {
    return NextResponse.json({ error: "points must be a non-empty array" }, { status: 400 });
  }
  if (points.length > MAX_POINTS) {
    return NextResponse.json({ error: `At most ${MAX_POINTS} points per request` }, { status: 400 });
  }

  const resolved: Resolved[] = [];
  const unresolved: number[] = [];
  for (const p of points) {
    const index = Number(p?.index);
    const query = typeof p?.query === "string" ? p.query : "";
    if (!Number.isInteger(index)) continue;
    const coords = await resolveCoords(query);
    if (coords) resolved.push({ index, lat: coords[0], lng: coords[1], elevation: null });
    else unresolved.push(index);
  }

  if (resolved.length === 0) {
    return NextResponse.json({ results: [], unresolved });
  }

  // 一次打完，Open-Meteo 的 elevation 支援逗號分隔的批次查詢
  const params = new URLSearchParams({
    latitude: resolved.map((r) => r.lat).join(","),
    longitude: resolved.map((r) => r.lng).join(","),
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?${params}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return NextResponse.json({ error: "Elevation service unavailable" }, { status: 502 });
    const data = await res.json();
    const elevations: unknown[] = Array.isArray(data?.elevation) ? data.elevation : [];
    resolved.forEach((r, i) => {
      const v = Number(elevations[i]);
      r.elevation = Number.isFinite(v) ? Math.round(v) : null;
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the elevation service" }, { status: 502 });
  }

  return NextResponse.json({ results: resolved, unresolved });
}
