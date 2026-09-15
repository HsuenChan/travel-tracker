import { getCountryCodes } from "@/lib/countries";
import { AIRPORT_COORDS } from "@/lib/airports";
import { parseCoverPos } from "@/lib/coverPos";

/**
 * 旅遊護照的跨旅程聚合。
 *
 * 純函式，資料由 /api/passport 查好後傳進來 —— 這樣「護照上那個數字怎麼來的」只有一個地方
 * 要讀，而不是散在 route handler 的查詢之間。
 */

export interface PassportHolder {
  name: string;
  avatarUrl: string | null;
}

export interface PassportSummary {
  tripCount: number;
  countryCount: number;
  /** 與首頁「旅遊足跡」同一套算法，兩邊顯示的數字必須一致 */
  dayCount: number;
  firstYear: number | null;
  lastYear: number | null;
}

/** 一趟一國一枚。同一國去三次就是三枚，日期不同 */
export interface PassportStamp {
  code: string;
  tripId: string;
  tripName: string;
  date: string;
}

export interface PassportMileage {
  /** 只加總兩端機場都查得到座標的航段，所以是「已記錄航段」而不是總里程 */
  flightKm: number;
  knownSegments: number;
  totalSegments: number;
  /** 單獨最長的一段航段 —— 總和是數字，這個才有畫面 */
  longestFlight: { from: string; to: string; fromCity: string; toCity: string; km: number } | null;
  longestTrip: { name: string; days: number } | null;
  /** 去最多次的國家（同一國去三次就是三次），次數相同時取先去過的 */
  topCountry: { code: string; count: number } | null;
}

export interface PassportYear {
  year: number;
  tripCount: number;
  dayCount: number;
  countryCodes: string[];
  longestTrip: string | null;
  /** 那一年第一個有連結相簿的旅程；年度回顧的照片從這裡拿 */
  albumUrl: string | null;
  /** 沒有相簿、或相簿讀不到時退回這張行程照片 */
  photo: string | null;
}

export interface PassportData {
  holder: PassportHolder;
  summary: PassportSummary;
  stamps: PassportStamp[];
  mileage: PassportMileage;
  years: PassportYear[];
}

export interface TripRow {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  countries: string | null;
  country_codes: string | null;
  photo_album_id: string | null;
}

export interface SegmentRow {
  trip_id: string;
  from_iata: string | null;
  to_iata: string | null;
}

export interface ItineraryRow {
  trip_id: string;
  date: string | null;
  image_urls: string[] | null;
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 大圓距離；航段里程只能這樣估，實際航路會更長 */
export function greatCircleKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 一趟旅程的天數。
 *
 * 用的是首頁「旅遊足跡」那條算法（結束減開始，不加一），因為護照是同一批數字的正式版 ——
 * 兩個畫面對同一批旅程講出不同的天數，比這個數字本身偏一天更糟。
 */
function tripDays(trip: TripRow): number {
  if (!trip.start_date || !trip.end_date) return 0;
  const diff =
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86_400_000;
  return Math.max(0, Math.round(diff));
}

function yearOf(date: string | null): number | null {
  return date ? Number(date.slice(0, 4)) : null;
}

export function buildPassport(
  holder: PassportHolder,
  trips: TripRow[],
  segments: SegmentRow[],
  items: ItineraryRow[]
): PassportData {
  const dated = trips.filter((t) => t.start_date);
  const ordered = [...dated].sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1));

  const codesOf = (t: TripRow) => getCountryCodes(t.countries ?? "", t.country_codes ?? "");

  // ── 摘要 ──────────────────────────────────────────────
  const allCodes = new Set(trips.flatMap(codesOf));
  const years = trips
    .flatMap((t) => [yearOf(t.start_date), yearOf(t.end_date)])
    .filter((y): y is number => y !== null);

  const summary: PassportSummary = {
    tripCount: trips.length,
    countryCount: allCodes.size,
    dayCount: trips.reduce((sum, t) => sum + tripDays(t), 0),
    firstYear: years.length ? Math.min(...years) : null,
    lastYear: years.length ? Math.max(...years) : null,
  };

  // ── 入境章：一趟一國一枚，按時間排 ──────────────────────
  const stamps: PassportStamp[] = ordered.flatMap((t) =>
    codesOf(t).map((code) => ({
      code,
      tripId: t.id,
      tripName: t.name,
      date: t.start_date!,
    }))
  );

  // ── 旅行紀錄 ──────────────────────────────────────────
  let flightKm = 0;
  let knownSegments = 0;
  let longestFlight: PassportMileage["longestFlight"] = null;

  for (const seg of segments) {
    const fromCode = seg.from_iata?.toUpperCase();
    const toCode = seg.to_iata?.toUpperCase();
    const from = fromCode ? AIRPORT_COORDS[fromCode] : null;
    const to = toCode ? AIRPORT_COORDS[toCode] : null;
    if (!from || !to || !fromCode || !toCode) continue;

    const km = greatCircleKm(from, to);
    flightKm += km;
    knownSegments += 1;
    if (!longestFlight || km > longestFlight.km) {
      longestFlight = {
        from: fromCode,
        to: toCode,
        fromCity: from.city,
        toCity: to.city,
        km: Math.round(km),
      };
    }
  }

  const longestTrip = trips.reduce<PassportMileage["longestTrip"]>((best, t) => {
    const days = tripDays(t);
    return !best || days > best.days ? { name: t.name, days } : best;
  }, null);

  // 入境章已經是「一趟一國一枚」，直接數就是去過幾次
  const visitCount = new Map<string, number>();
  for (const stamp of stamps) {
    visitCount.set(stamp.code, (visitCount.get(stamp.code) ?? 0) + 1);
  }
  let topCountry: PassportMileage["topCountry"] = null;
  for (const [code, count] of visitCount) {
    // 只在嚴格大於時換人，所以次數相同會留下先去過的那個（stamps 已按時間排序）
    if (!topCountry || count > topCountry.count) topCountry = { code, count };
  }
  /*
    每個國家都只去過一次的時候，「去最多次的國家」是沒有意義的 —— 它只是挑了名單上的第一個，
    還在旁邊標「1 次」。這一格就整個不要出現，和其他紀錄一樣「沒有東西可講就跳過」。
  */
  if (topCountry && topCountry.count < 2) topCountry = null;

  const mileage: PassportMileage = {
    flightKm: Math.round(flightKm),
    knownSegments,
    totalSegments: segments.length,
    longestFlight,
    longestTrip: longestTrip && longestTrip.days > 0 ? longestTrip : null,
    topCountry,
  };

  // ── 年度 ──────────────────────────────────────────────
  // 代表照片取那趟第一張行程照片；#pos= 是封面位置後綴，當 src 用之前要拆掉
  const photoOfTrip = new Map<string, string>();
  for (const item of items) {
    const url = item.image_urls?.[0];
    if (url && !photoOfTrip.has(item.trip_id)) {
      photoOfTrip.set(item.trip_id, parseCoverPos(url).clean);
    }
  }

  const byYear = new Map<number, TripRow[]>();
  for (const t of ordered) {
    const y = yearOf(t.start_date)!;
    const list = byYear.get(y);
    if (list) list.push(t);
    else byYear.set(y, [t]);
  }

  const yearPages: PassportYear[] = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, list]) => {
      const longest = list.reduce<TripRow | null>(
        (best, t) => (!best || tripDays(t) > tripDays(best) ? t : best),
        null
      );
      return {
        year,
        tripCount: list.length,
        dayCount: list.reduce((sum, t) => sum + tripDays(t), 0),
        countryCodes: [...new Set(list.flatMap(codesOf))],
        longestTrip: longest?.name ?? null,
        // 相簿優先：年度回顧要的是那一年的照片，不是行程卡片上的縮圖
        albumUrl: list.map((t) => t.photo_album_id).find((a) => !!a?.trim()) ?? null,
        photo: list.map((t) => photoOfTrip.get(t.id)).find(Boolean) ?? null,
      };
    });

  return { holder, summary, stamps, mileage, years: yearPages };
}
