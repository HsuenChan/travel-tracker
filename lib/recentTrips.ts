/**
 * 最近開過哪幾趟旅程。
 *
 * 只存在這台裝置上（與 travel_trips 等快取同一套做法），不進資料庫：它的用途是決定開 App 時
 * 落在哪裡，換裝置重新累積就好，不值得為它多一張表與一條同步路徑。
 */

const KEY = "travel_recent_trips";
const MAX = 12;

export interface RecentTrip {
  tripId: string;
  lastOpenedAt: number;
}

export function readRecentTrips(): RecentTrip[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (r): r is RecentTrip => typeof r?.tripId === "string" && typeof r?.lastOpenedAt === "number"
    );
  } catch {
    // 無痕視窗、封鎖站台資料都會走到這裡，當作沒有紀錄
    return [];
  }
}

export function recordTripOpen(tripId: string): void {
  try {
    const list = readRecentTrips().filter((r) => r.tripId !== tripId);
    list.unshift({ tripId, lastOpenedAt: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // 記不起來只影響落點，不影響任何操作
  }
}

/** 這幾天之內有沒有開過任何一趟 */
export function openedWithinDays(days: number): boolean {
  const cutoff = Date.now() - days * 86_400_000;
  return readRecentTrips().some((r) => r.lastOpenedAt >= cutoff);
}

/** 最近開過的那幾趟，越前面越近期 */
export function recentTripIds(): string[] {
  return readRecentTrips().map((r) => r.tripId);
}
