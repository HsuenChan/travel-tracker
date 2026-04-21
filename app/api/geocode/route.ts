import { type NextRequest, NextResponse } from "next/server";

interface GeoResult {
  coords: [number, number] | null;
  countryCode: string | null;
}

const cache = new Map<string, GeoResult>();

function extractFromGoogleUrl(url: string): [number, number] | null {
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return [parseFloat(atMatch[1]), parseFloat(atMatch[2])];

  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return [parseFloat(qMatch[1]), parseFloat(qMatch[2])];

  const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) return [parseFloat(llMatch[1]), parseFloat(llMatch[2])];

  const dataMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dataMatch) return [parseFloat(dataMatch[1]), parseFloat(dataMatch[2])];

  return null;
}

function isGoogleMapsUrl(q: string): boolean {
  return /^https?:\/\/(maps\.google\.|www\.google\.com\/maps|goo\.gl\/maps|maps\.app\.goo\.gl)/.test(q);
}

async function resolveGoogleUrl(q: string): Promise<GeoResult> {
  const direct = extractFromGoogleUrl(q);
  if (direct) return { coords: direct, countryCode: null };

  if (/goo\.gl|maps\.app\.goo\.gl/.test(q)) {
    try {
      const res = await fetch(q, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": "travel-tracker-app/1.0" },
      });
      const resolved = res.url;
      if (resolved && resolved !== q) {
        const coords = extractFromGoogleUrl(resolved);
        if (coords) return { coords, countryCode: null };
      }
    } catch {
      return { coords: null, countryCode: null };
    }
  }

  return { coords: null, countryCode: null };
}

async function nominatim(q: string): Promise<GeoResult> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`;
  const res = await fetch(url, { headers: { "User-Agent": "travel-tracker-app/1.0" } });
  const data = await res.json();
  if (!data[0]) return { coords: null, countryCode: null };
  return {
    coords: [parseFloat(data[0].lat), parseFloat(data[0].lon)],
    countryCode: (data[0].address?.country_code as string | undefined)?.toUpperCase() ?? null,
  };
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });

  if (cache.has(q)) return NextResponse.json(cache.get(q));

  try {
    const result = isGoogleMapsUrl(q)
      ? await resolveGoogleUrl(q)
      : await nominatim(q);

    cache.set(q, result);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ coords: null, countryCode: null });
  }
}
