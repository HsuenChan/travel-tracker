/** 一趟旅程的戶外路段總計。多段路段互不相連，所以是逐段相加而不是首尾相減。 */
export interface OutdoorTotals {
  legs: number;
  distance: number;
  ascent: number;
  descent: number;
}

interface LegLike {
  category?: string | null;
  distance_km?: number | null;
  ascent_m?: number | null;
  descent_m?: number | null;
}

export function computeOutdoorTotals(items: LegLike[]): OutdoorTotals | null {
  const legs = items.filter((i) => i.category === "outdoor");
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
