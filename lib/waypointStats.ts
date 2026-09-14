/**
 * 一段路線的里程與爬升下降。
 *
 * 從 /api/itinerary/waypoints 抽出來共用：後台還原整段途經點之後，
 * 行程卡上的距離／總上升／總下降也要跟著回到當時的值，
 * 兩邊必須用同一條公式，否則還原完數字會對不起來。
 */
export interface WaypointStatsInput {
  elevation_m: number | null;
  distance_km: number | null;
}

export interface WaypointStats {
  distance_km: number | null;
  ascent_m: number | null;
  descent_m: number | null;
}

/** 里程取最後一個累積距離；爬升／下降是相鄰海拔差的正負累加 */
export function deriveWaypointStats(rows: WaypointStatsInput[]): WaypointStats {
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
