import { type NextRequest, NextResponse } from "next/server";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: { country_code?: string };
}

function shortenDisplayName(displayName: string): string {
  const parts = displayName.split(", ");
  return parts.slice(0, 3).join(", ");
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "travel-tracker-app/1.0" },
    });
    const data: NominatimResult[] = await res.json();

    const results = data
      .filter((item) => item.lat && item.lon)
      .slice(0, 5)
      .map((item) => {
        const label = shortenDisplayName(item.display_name);
        return {
          value: label,
          label,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          countryCode: item.address?.country_code?.toUpperCase() ?? "",
        };
      });

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
