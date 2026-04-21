import { type NextRequest, NextResponse } from "next/server";

interface WeatherDay {
  date: string;
  code: number;
  maxTemp: number;
  minTemp: number;
}

const cache = new Map<string, WeatherDay[]>();

async function geocode(city: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { "User-Agent": "travel-tracker-app/1.0" } });
  const data = await res.json();
  if (!data[0]) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function fetchOpenMeteo(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
  archive: boolean,
): Promise<WeatherDay[]> {
  const base = archive
    ? "https://archive-api.open-meteo.com/v1/archive"
    : "https://api.open-meteo.com/v1/forecast";
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    start_date: startDate,
    end_date: endDate,
    timezone: "auto",
  });
  const res = await fetch(`${base}?${params}`);
  const data = await res.json();
  if (!data.daily?.time) return [];
  return data.daily.time.map((date: string, i: number) => ({
    date,
    code: data.daily.weather_code[i] ?? 0,
    maxTemp: Math.round(data.daily.temperature_2m_max[i] ?? 0),
    minTemp: Math.round(data.daily.temperature_2m_min[i] ?? 0),
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const city = searchParams.get("city");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!city || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const cacheKey = `${city}|${startDate}|${endDate}`;
  if (cache.has(cacheKey)) {
    return NextResponse.json({ weather: cache.get(cacheKey) });
  }

  try {
    const coords = await geocode(city);
    if (!coords) return NextResponse.json({ weather: [] });

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    let weather: WeatherDay[] = [];

    if (endDate < today) {
      weather = await fetchOpenMeteo(coords.lat, coords.lon, startDate, endDate, true);
    } else if (startDate >= today) {
      weather = await fetchOpenMeteo(coords.lat, coords.lon, startDate, endDate, false);
    } else {
      // Spans past and future — two requests merged
      const [past, future] = await Promise.all([
        fetchOpenMeteo(coords.lat, coords.lon, startDate, yesterday, true),
        fetchOpenMeteo(coords.lat, coords.lon, today, endDate, false),
      ]);
      weather = [...past, ...future];
    }

    cache.set(cacheKey, weather);
    return NextResponse.json({ weather });
  } catch {
    return NextResponse.json({ weather: [] });
  }
}
