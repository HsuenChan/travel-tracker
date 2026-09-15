/** 一趟旅程的戶外路段總計。多段路段互不相連，所以是逐段相加而不是首尾相減。 */
export interface OutdoorTotals {
  legs: number;
  distance: number;
  ascent: number;
  descent: number;
}

interface LegLike {
  category?: string | null;
  status?: string | null;
  distance_km?: number | null;
  ascent_m?: number | null;
  descent_m?: number | null;
}

export function computeOutdoorTotals(items: LegLike[]): OutdoorTotals | null {
  /*
    備案與想去清單不算。

    一段可能不會走的溪降，它的里程與爬升不該進這趟的總計 —— 那個數字是拿來決定「這趟要練到
    什麼程度、背包揹不揹得動」的，把還沒決定的事算進去，準備的基準就是錯的。
  */
  const legs = items.filter(
    (i) => i.category === "outdoor" && (i.status ?? "planned") === "planned"
  );
  if (legs.length === 0) return null;
  const sum = (pick: (i: LegLike) => number | null | undefined) =>
    legs.reduce((acc, i) => acc + (Number(pick(i)) || 0), 0);
  return {
    legs: legs.length,
    distance: sum((i) => i.distance_km),
    ascent: sum((i) => i.ascent_m),
    descent: sum((i) => i.descent_m),
  };
}
