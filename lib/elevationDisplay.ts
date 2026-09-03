/**
 * Whether a leg's elevation profile is worth drawing.
 *
 * Shared by the route modal's chart and the itinerary card's sparkline so the two can never
 * disagree — they answer the same question about the same data.
 */

export interface ElevationDisplayInput {
  elevation_m?: number | null;
}

/** 至少要這麼多個點有海拔，否則畫出來只是一段沒有意義的小折線 */
export const MIN_ELEVATION_POINTS = 4;

/**
 * 有海拔的點要佔這個比例以上。
 * 低於此值時剖面會把沒有資料的路段連成直線 —— 例如 Wilson Creek 的 30 個點只有接近段的
 * 6 個有海拔，圖會把 9 段垂降、4 段下攀畫成一條平滑斜線，比不畫更誤導。
 */
export const MIN_ELEVATION_COVERAGE = 0.6;

export interface ElevationDecision {
  show: boolean;
  /** 一行就講完的原因，直接顯示在畫面上 */
  reason: string | null;
  /** 為什麼這樣判斷；放進 tooltip，不佔版面 */
  detail: string | null;
  withElevation: number;
  total: number;
  /** true 表示這次結果來自使用者的明確設定，而不是自動判斷 */
  overridden: boolean;
}

export function decideElevationDisplay(
  waypoints: ElevationDisplayInput[] | undefined,
  showElevation: boolean | null | undefined,
): ElevationDecision {
  const total = waypoints?.length ?? 0;
  const withElevation = waypoints?.filter(w => w.elevation_m != null).length ?? 0;

  if (showElevation === true) {
    return { show: true, reason: null, detail: null, withElevation, total, overridden: true };
  }
  if (showElevation === false) {
    return { show: false, reason: "已設為不顯示", detail: null, withElevation, total, overridden: true };
  }

  if (total === 0) {
    return { show: false, reason: "還沒有途經點", detail: null, withElevation, total, overridden: false };
  }

  const short = `海拔資料不足（${withElevation} / ${total} 點）`;

  if (withElevation < MIN_ELEVATION_POINTS) {
    return {
      show: false, overridden: false, withElevation, total, reason: short,
      detail: `至少要 ${MIN_ELEVATION_POINTS} 個點填了海拔才畫得出剖面。`,
    };
  }

  if (withElevation / total < MIN_ELEVATION_COVERAGE) {
    return {
      show: false, overridden: false, withElevation, total, reason: short,
      detail: "剖面會把沒有資料的路段連成直線，讀起來像平緩地形，"
        + "而那裡其實可能是連續垂降。所以海拔占比不到六成時預設不畫。",
    };
  }

  return { show: true, reason: null, detail: null, withElevation, total, overridden: false };
}
