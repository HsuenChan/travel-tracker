import { createServiceClient } from "@/lib/supabase/service";
import { buildDailyBrief, buildSettlementBrief, type BriefItem } from "@/lib/lineBrief";
import { tripUrl } from "@/lib/linePush";
import { resolveTimeZone, localDate } from "@/lib/tripTimezone";
import {
  computeSettlement, fetchRates, settlementPairKey, toBaseCurrency,
  type SettlementExpense,
} from "@/lib/settlement";

/**
 * 「今天要推什麼」的查詢。
 *
 * 三個地方要同一份：排程推播、後台模擬器的預覽、群組裡的 /trip。各寫一份的話，某天改了推播的
 * 篩選條件，另外兩個看到的就不是真的會被推出去的內容。
 */

type Service = ReturnType<typeof createServiceClient>;

export interface BriefTrip {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  currency: string | null;
  people: string[] | null;
  time_zone?: string | null;
  destinations: { lat: number; lng: number }[] | null;
  countries: string | null;
  country_codes: string | null;
}

const COLUMNS = "id,name,start_date,end_date,currency,people,destinations,countries,country_codes";

/**
 * time_zone 是 25_trip_time_zone.sql 才有的欄位；還沒跑 migration 時退回不帶它的查詢。
 * 整個 select 失敗會讓每一趟都看起來像「找不到旅程」。
 */
export async function loadBriefTrips(service: Service, tripIds: string[]) {
  const scoped = await service.from("trips").select(`${COLUMNS},time_zone`).in("id", tripIds);
  const res = scoped.error ? await service.from("trips").select(COLUMNS).in("id", tripIds) : scoped;
  if (res.error) return { error: res.error.message, trips: [] as BriefTrip[] };
  return { error: null, trips: (res.data ?? []) as BriefTrip[] };
}

export async function loadBriefTrip(service: Service, tripId: string): Promise<BriefTrip | null> {
  const { trips } = await loadBriefTrips(service, [tripId]);
  return trips[0] ?? null;
}

/** 那趟當地的今天 */
export function todayFor(trip: BriefTrip): string {
  return localDate(resolveTimeZone(trip));
}

export async function dailyBriefMessages(
  service: Service,
  trip: BriefTrip,
  date: string,
): Promise<object[] | null> {
  const { data } = await service
    .from("itinerary_items")
    .select("title,category,time,end_time,location,date,end_date,status")
    .eq("trip_id", trip.id)
    .neq("status", "wishlist")
    // 跨日行程今天也算，所以不能只比對開始日
    .lte("date", date)
    .order("time", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true });

  const items = (data ?? []).filter((i) => {
    const end = (i.end_date as string | null) ?? (i.date as string);
    return (i.date as string) <= date && date <= end;
  }) as BriefItem[];

  if (items.length === 0) return null;

  const dayNumber = trip.start_date
    ? Math.round((Date.parse(date) - Date.parse(trip.start_date)) / 86_400_000) + 1
    : null;
  const totalDays = trip.start_date && trip.end_date
    ? Math.round((Date.parse(trip.end_date) - Date.parse(trip.start_date)) / 86_400_000) + 1
    : null;

  return [buildDailyBrief({
    tripName: trip.name,
    date,
    zone: resolveTimeZone(trip),
    dayNumber,
    totalDays,
    items,
    url: tripUrl(trip.id, "itinerary"),
  })];
}

export async function settlementMessages(service: Service, trip: BriefTrip): Promise<object[] | null> {
  const [{ data: expenses }, { data: paidRows }] = await Promise.all([
    service.from("expenses").select("amount,currency,paid_by,split_with").eq("trip_id", trip.id),
    service.from("settlement_paid").select("pair_key").eq("trip_id", trip.id),
  ]);
  if (!expenses?.length) return null;

  const currency = trip.currency ? trip.currency.split(",")[0] : "TWD";
  // 和費用分頁同一套換算：拿不到匯率時退回原值，寧可少換也不要給錯的數字
  const rates = await fetchRates();
  const { transactions } = computeSettlement(
    expenses as SettlementExpense[],
    trip.people ?? [],
    (amount, from) => toBaseCurrency(amount, from, currency, rates),
  );
  const paid = new Set((paidRows ?? []).map((r) => r.pair_key as string));
  const unpaid = transactions.filter((t) => !paid.has(settlementPairKey(t)));
  if (unpaid.length === 0) return null;

  return [buildSettlementBrief({
    tripName: trip.name,
    currency,
    transactions: unpaid,
    url: tripUrl(trip.id, "expenses"),
  })];
}
