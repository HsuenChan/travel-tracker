import { getCountryCodes } from "@/lib/countries";

/**
 * 從旅程的目的地推出當地時區。
 *
 * 用 IANA 時區名而不是自己算 UTC 偏移：夏令時間換算交給 Intl，偏移會自己跟著日期變。
 * 純算經度的話，歐洲的夏天會整個差一小時。
 */

interface ZonePoint {
  zone: string;
  cc: string;
  lat: number;
  lng: number;
}

/**
 * 每個支援國家一個代表點；跨多個時區的國家（美、俄、澳、巴西、加拿大、印尼）多放幾個。
 * 判斷方式是取最近的代表點，所以點位要落在該時區真正有人去的地方。
 */
const ZONE_POINTS: ZonePoint[] = [
  { zone: "Asia/Taipei", cc: "TW", lat: 23.7, lng: 120.96 },
  { zone: "Asia/Tokyo", cc: "JP", lat: 36.2, lng: 138.25 },
  { zone: "Asia/Seoul", cc: "KR", lat: 35.91, lng: 127.77 },
  { zone: "Asia/Shanghai", cc: "CN", lat: 35.86, lng: 104.2 },
  { zone: "Asia/Hong_Kong", cc: "HK", lat: 22.32, lng: 114.17 },
  { zone: "Asia/Macau", cc: "MO", lat: 22.2, lng: 113.54 },
  { zone: "Asia/Singapore", cc: "SG", lat: 1.35, lng: 103.82 },
  { zone: "Asia/Bangkok", cc: "TH", lat: 15.87, lng: 100.99 },
  { zone: "Asia/Ho_Chi_Minh", cc: "VN", lat: 14.06, lng: 108.28 },
  { zone: "Asia/Phnom_Penh", cc: "KH", lat: 12.57, lng: 104.99 },
  { zone: "Asia/Vientiane", cc: "LA", lat: 19.86, lng: 102.5 },
  { zone: "Asia/Yangon", cc: "MM", lat: 21.91, lng: 95.96 },
  { zone: "Asia/Kuala_Lumpur", cc: "MY", lat: 4.21, lng: 101.98 },
  { zone: "Asia/Jakarta", cc: "ID", lat: -6.2, lng: 106.85 },
  { zone: "Asia/Makassar", cc: "ID", lat: -8.41, lng: 115.19 },
  { zone: "Asia/Manila", cc: "PH", lat: 12.88, lng: 121.77 },
  { zone: "Asia/Kolkata", cc: "IN", lat: 20.59, lng: 78.96 },
  { zone: "Asia/Kathmandu", cc: "NP", lat: 28.39, lng: 84.12 },
  { zone: "Asia/Thimphu", cc: "BT", lat: 27.51, lng: 90.43 },
  { zone: "Asia/Colombo", cc: "LK", lat: 7.87, lng: 80.77 },
  { zone: "Indian/Maldives", cc: "MV", lat: 3.2, lng: 73.22 },
  { zone: "Asia/Dubai", cc: "AE", lat: 23.42, lng: 53.85 },
  { zone: "Asia/Amman", cc: "JO", lat: 30.59, lng: 36.24 },
  { zone: "Asia/Jerusalem", cc: "IL", lat: 31.05, lng: 34.85 },
  { zone: "Europe/Istanbul", cc: "TR", lat: 38.96, lng: 35.24 },
  { zone: "Africa/Cairo", cc: "EG", lat: 26.82, lng: 30.8 },
  { zone: "Africa/Casablanca", cc: "MA", lat: 31.79, lng: -7.09 },
  { zone: "Africa/Nairobi", cc: "KE", lat: -0.02, lng: 37.91 },
  { zone: "Africa/Dar_es_Salaam", cc: "TZ", lat: -6.37, lng: 34.89 },
  { zone: "Africa/Johannesburg", cc: "ZA", lat: -30.56, lng: 22.94 },
  { zone: "Europe/London", cc: "GB", lat: 55.38, lng: -3.44 },
  { zone: "Europe/Dublin", cc: "IE", lat: 53.41, lng: -8.24 },
  { zone: "Europe/Lisbon", cc: "PT", lat: 39.4, lng: -8.22 },
  { zone: "Europe/Madrid", cc: "ES", lat: 40.46, lng: -3.75 },
  { zone: "Europe/Paris", cc: "FR", lat: 46.23, lng: 2.21 },
  { zone: "Europe/Brussels", cc: "BE", lat: 50.5, lng: 4.47 },
  { zone: "Europe/Amsterdam", cc: "NL", lat: 52.13, lng: 5.29 },
  { zone: "Europe/Berlin", cc: "DE", lat: 51.17, lng: 10.45 },
  { zone: "Europe/Zurich", cc: "CH", lat: 46.82, lng: 8.23 },
  { zone: "Europe/Vienna", cc: "AT", lat: 47.52, lng: 14.55 },
  { zone: "Europe/Rome", cc: "IT", lat: 41.87, lng: 12.57 },
  { zone: "Europe/Ljubljana", cc: "SI", lat: 46.15, lng: 14.99 },
  { zone: "Europe/Zagreb", cc: "HR", lat: 45.1, lng: 15.2 },
  { zone: "Europe/Budapest", cc: "HU", lat: 47.16, lng: 19.5 },
  { zone: "Europe/Prague", cc: "CZ", lat: 49.82, lng: 15.47 },
  { zone: "Europe/Warsaw", cc: "PL", lat: 51.92, lng: 19.15 },
  { zone: "Europe/Athens", cc: "GR", lat: 39.07, lng: 21.82 },
  { zone: "Europe/Copenhagen", cc: "DK", lat: 56.26, lng: 9.5 },
  { zone: "Europe/Oslo", cc: "NO", lat: 60.47, lng: 8.47 },
  { zone: "Europe/Stockholm", cc: "SE", lat: 60.13, lng: 18.64 },
  { zone: "Europe/Helsinki", cc: "FI", lat: 61.92, lng: 25.75 },
  { zone: "Atlantic/Reykjavik", cc: "IS", lat: 64.96, lng: -19.02 },
  { zone: "Europe/Moscow", cc: "RU", lat: 55.76, lng: 37.62 },
  { zone: "Asia/Vladivostok", cc: "RU", lat: 43.12, lng: 131.89 },
  { zone: "America/New_York", cc: "US", lat: 40.71, lng: -74.01 },
  { zone: "America/Chicago", cc: "US", lat: 41.88, lng: -87.63 },
  { zone: "America/Denver", cc: "US", lat: 39.74, lng: -104.99 },
  { zone: "America/Los_Angeles", cc: "US", lat: 34.05, lng: -118.24 },
  { zone: "America/Anchorage", cc: "US", lat: 61.22, lng: -149.9 },
  { zone: "Pacific/Honolulu", cc: "US", lat: 21.31, lng: -157.86 },
  { zone: "America/Toronto", cc: "CA", lat: 43.65, lng: -79.38 },
  { zone: "America/Vancouver", cc: "CA", lat: 49.28, lng: -123.12 },
  { zone: "America/Mexico_City", cc: "MX", lat: 23.63, lng: -102.55 },
  { zone: "America/Havana", cc: "CU", lat: 21.52, lng: -77.78 },
  { zone: "America/Lima", cc: "PE", lat: -9.19, lng: -75.02 },
  { zone: "America/Sao_Paulo", cc: "BR", lat: -23.55, lng: -46.63 },
  { zone: "America/Manaus", cc: "BR", lat: -3.12, lng: -60.02 },
  { zone: "America/Argentina/Buenos_Aires", cc: "AR", lat: -34.6, lng: -58.38 },
  { zone: "Australia/Sydney", cc: "AU", lat: -33.87, lng: 151.21 },
  { zone: "Australia/Brisbane", cc: "AU", lat: -27.47, lng: 153.03 },
  { zone: "Australia/Adelaide", cc: "AU", lat: -34.93, lng: 138.6 },
  { zone: "Australia/Perth", cc: "AU", lat: -31.95, lng: 115.86 },
  { zone: "Pacific/Auckland", cc: "NZ", lat: -40.9, lng: 174.89 },
  { zone: "Pacific/Fiji", cc: "FJ", lat: -17.71, lng: 178.07 },
  { zone: "Pacific/Guam", cc: "GU", lat: 13.44, lng: 144.79 },
  { zone: "Pacific/Saipan", cc: "MP", lat: 15.18, lng: 145.75 },
  { zone: "Pacific/Palau", cc: "PW", lat: 7.51, lng: 134.58 },
];

/** 推不出來時用台北：使用者與旅伴多半從台灣出發 */
export const FALLBACK_ZONE = "Asia/Taipei";

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface TimezoneSource {
  /** 旅途中由裝置回報的實測值，有就以它為準 */
  time_zone?: string | null;
  destinations?: { lat: number; lng: number }[] | null;
  countries?: string | null;
  country_codes?: string | null;
}

/**
 * 有座標就取最近的代表點，沒有就用國碼。
 *
 * 知道國碼時只在同一國的點位裡比 —— 純比距離的話，靠近邊界的目的地會挑到隔壁國家的時區，
 * 而那通常剛好差一小時。
 */
export function resolveTimeZone(trip: TimezoneSource): string {
  // 旅途中回報過就用那個：實測值勝過任何推算，也涵蓋沒收錄的國家與一國跨多時區
  if (trip.time_zone) return trip.time_zone;

  const codes = getCountryCodes(trip.countries ?? "", trip.country_codes ?? "");
  const first = trip.destinations?.find((d) => typeof d?.lat === "number" && typeof d?.lng === "number");

  if (first) {
    const pool = codes.length > 0 ? ZONE_POINTS.filter((z) => codes.includes(z.cc)) : ZONE_POINTS;
    const candidates = pool.length > 0 ? pool : ZONE_POINTS;
    let best = candidates[0];
    let bestDist = Infinity;
    for (const z of candidates) {
      const d = distanceKm(first, z);
      if (d < bestDist) { bestDist = d; best = z; }
    }
    return best.zone;
  }

  for (const cc of codes) {
    const hit = ZONE_POINTS.find((z) => z.cc === cc);
    if (hit) return hit.zone;
  }
  return FALLBACK_ZONE;
}

/** 某個時區的當地時間欄位。DST 交給 Intl，不自己算偏移 */
function parts(zone: string, at: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
}

/** 當地日期（YYYY-MM-DD），用來比對行程那一天 */
export function localDate(zone: string, at: Date = new Date()): string {
  const p = parts(zone, at);
  return `${p.year}-${p.month}-${p.day}`;
}

/** 當地小時（0–23） */
export function localHour(zone: string, at: Date = new Date()): number {
  // 午夜在 en-CA 的 hour12:false 會給 24，正規化回 0
  return Number(parts(zone, at).hour) % 24;
}

/** 目前的 UTC 偏移，例如 +09:00；顯示用 */
export function utcOffset(zone: string, at: Date = new Date()): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  return name.replace("GMT", "UTC");
}
