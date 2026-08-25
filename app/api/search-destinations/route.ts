import { type NextRequest, NextResponse } from "next/server";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: { country_code?: string };
}

interface OpenMeteoResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
}

interface DestinationResult {
  value: string;
  label: string;
  lat: number;
  lng: number;
  countryCode: string;
}

// 程序內查詢快取：Nominatim 限制 1 req/s，重複查詢直接吃快取避免被 429
const cache = new Map<string, { ts: number; results: DestinationResult[] }>();
const CACHE_TTL = 1000 * 60 * 60 * 24;

// Nominatim 掛掉時的繁中備援：Open-Meteo 只認英文/簡中，常見地名先轉英文再查
const ZH_ALIASES: Record<string, string> = {
  "紐西蘭": "New Zealand", "澳洲": "Australia", "義大利": "Italy", "韓國": "South Korea",
  "泰國": "Thailand", "越南": "Vietnam", "法國": "France", "西班牙": "Spain",
  "英國": "United Kingdom", "美國": "United States", "德國": "Germany", "瑞士": "Switzerland",
  "奧地利": "Austria", "捷克": "Czechia", "荷蘭": "Netherlands", "希臘": "Greece",
  "土耳其": "Turkey", "冰島": "Iceland", "挪威": "Norway", "瑞典": "Sweden",
  "芬蘭": "Finland", "丹麥": "Denmark", "葡萄牙": "Portugal", "匈牙利": "Hungary",
  "波蘭": "Poland", "克羅埃西亞": "Croatia", "斯洛維尼亞": "Slovenia", "印尼": "Indonesia",
  "菲律賓": "Philippines", "馬來西亞": "Malaysia", "新加坡": "Singapore", "柬埔寨": "Cambodia",
  "埃及": "Egypt", "摩洛哥": "Morocco", "墨西哥": "Mexico", "加拿大": "Canada",
  "巴西": "Brazil", "秘魯": "Peru", "阿根廷": "Argentina", "比利時": "Belgium",
  "愛爾蘭": "Ireland", "蘇格蘭": "Scotland", "峇里島": "Bali", "沖繩": "Okinawa",
  "北海道": "Hokkaido", "首爾": "Seoul", "釜山": "Busan", "曼谷": "Bangkok",
  "倫敦": "London", "巴黎": "Paris", "紐約": "New York", "舊金山": "San Francisco",
};

function shortenDisplayName(displayName: string): string {
  const parts = displayName.split(", ");
  return parts.slice(0, 3).join(", ");
}

async function searchNominatim(q: string): Promise<DestinationResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1&accept-language=zh-TW`;
  const res = await fetch(url, {
    headers: { "User-Agent": "travel-tracker/1.0 (github.com/HsuenChan/travel-tracker)" },
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const data: NominatimResult[] = await res.json();
  return data
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
}

async function searchOpenMeteo(q: string): Promise<DestinationResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=zh`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const data: { results?: OpenMeteoResult[] } = await res.json();
  return (data.results ?? []).slice(0, 5).map((item) => {
    const label = [item.name, item.admin1, item.country]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(", ");
    return {
      value: label,
      label,
      lat: item.latitude,
      lng: item.longitude,
      countryCode: item.country_code?.toUpperCase() ?? "",
    };
  });
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const hit = cache.get(q);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return NextResponse.json({ results: hit.results });
  }

  let nominatimFailed = false;
  let results: DestinationResult[] = [];

  try {
    results = await searchNominatim(q);
  } catch {
    nominatimFailed = true;
  }

  if (results.length === 0) {
    try {
      const alias = ZH_ALIASES[q];
      if (alias) {
        // 別名命中：用英文查座標，但標籤保留使用者輸入的繁中
        const aliasResults = await searchOpenMeteo(alias);
        if (aliasResults.length > 0) {
          results = [{ ...aliasResults[0], value: q, label: q }];
        }
      }
      if (results.length === 0) {
        const fallback = await searchOpenMeteo(q);
        if (fallback.length > 0) results = fallback;
      }
    } catch {
      if (nominatimFailed) {
        // 兩個來源都失敗 → 誠實回報，UI 顯示「服務忙碌」而不是「找不到」
        return NextResponse.json({ results: [], error: "search_unavailable" }, { status: 503 });
      }
    }
    if (results.length === 0 && nominatimFailed) {
      return NextResponse.json({ results: [], error: "search_unavailable" }, { status: 503 });
    }
  }

  cache.set(q, { ts: Date.now(), results });
  return NextResponse.json({ results });
}
