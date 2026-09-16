import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveTimeZone, localDate, localHour } from "@/lib/tripTimezone";
import { pushMessage, tripUrl } from "@/lib/linePush";
import { buildDailyBrief, buildSettlementBrief, type BriefItem } from "@/lib/lineBrief";
import {
  computeSettlement, fetchRates, settlementPairKey, toBaseCurrency,
  type SettlementExpense,
} from "@/lib/settlement";

/** 當地幾點發 */
const SEND_HOUR = 8;

interface TripRow {
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

/**
 * 每日行程推播與結算摘要。
 *
 * 由外部排程每小時打一次 —— 「當地早上八點」在不同時區是不同的 UTC 時刻，一天只跑一次
 * 就只服務得到一個時區。每次只挑出當地正好八點的旅程，其餘直接跳過。
 *
 * 推過的事情記在 line_push_log：同一個群組一天會被掃到 24 次，而時區推算是會變的
 * （旅途中裝置回報會蓋掉推算值），沒有去重就可能同一天推兩次。
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  // Vercel Cron 帶的是 Bearer CRON_SECRET；外部排程也用同一個格式
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 404 });
  }

  const service = createServiceClient();
  const now = new Date();

  const { data: mappings, error } = await service
    .from("line_group_mappings")
    .select("group_id, default_trip_id")
    .not("default_trip_id", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!mappings?.length) return NextResponse.json({ sent: 0, reason: "no_groups" });

  const tripIds = [...new Set(mappings.map((m) => m.default_trip_id as string))];

  // time_zone 是 25_trip_time_zone.sql 才有的欄位；還沒跑 migration 時退回不帶它的查詢，
  // 時區改由座標推算。整個 select 失敗會讓每一趟都看起來像「找不到旅程」
  const COLUMNS = "id,name,start_date,end_date,currency,people,destinations,countries,country_codes";
  const scoped = await service.from("trips").select(`${COLUMNS},time_zone`).in("id", tripIds);
  const tripsRes = scoped.error
    ? await service.from("trips").select(COLUMNS).in("id", tripIds)
    : scoped;
  if (tripsRes.error) {
    return NextResponse.json({ error: tripsRes.error.message }, { status: 500 });
  }
  const trips = new Map((tripsRes.data ?? []).map((t) => [t.id, t as TripRow]));

  let sent = 0;
  const skipped: Record<string, number> = {};
  const bump = (why: string) => { skipped[why] = (skipped[why] ?? 0) + 1; };

  for (const m of mappings) {
    const trip = trips.get(m.default_trip_id as string);
    if (!trip) { bump("trip_missing"); continue; }

    const zone = resolveTimeZone(trip);
    if (localHour(zone, now) !== SEND_HOUR) { bump("not_send_hour"); continue; }

    const today = localDate(zone, now);
    const ongoing = !!trip.start_date && !!trip.end_date
      && trip.start_date <= today && today <= trip.end_date;
    // 結算摘要在結束的隔天推，所以要算出「昨天」是不是最後一天
    const yesterday = localDate(zone, new Date(now.getTime() - 86_400_000));
    const justEnded = !!trip.end_date && trip.end_date === yesterday;

    if (!ongoing && !justEnded) { bump("not_travelling"); continue; }

    const kind = ongoing ? "daily_brief" : "settlement";
    const dedupeKey = ongoing ? today : "final";

    // 先卡去重再送：unique 撞到就代表這次已經有人送過了
    const claim = await service
      .from("line_push_log")
      .insert({ group_id: m.group_id, trip_id: trip.id, kind, dedupe_key: dedupeKey });
    if (claim.error) { bump("already_sent"); continue; }

    const messages = ongoing
      ? await dailyBriefMessages(service, trip, today, zone)
      : await settlementMessages(service, trip);

    if (!messages) {
      // 沒東西可推就把卡位收回來，明天同一時間還會再試
      await service.from("line_push_log").delete()
        .eq("group_id", m.group_id).eq("trip_id", trip.id)
        .eq("kind", kind).eq("dedupe_key", dedupeKey);
      bump("nothing_to_say");
      continue;
    }

    const res = await pushMessage(m.group_id, messages);
    if (res.ok) {
      sent += 1;
    } else {
      // 推失敗也要收回卡位，否則這一天就永遠不會再試
      await service.from("line_push_log").delete()
        .eq("group_id", m.group_id).eq("trip_id", trip.id)
        .eq("kind", kind).eq("dedupe_key", dedupeKey);
      bump(`push_failed_${res.status}`);
    }
  }

  return NextResponse.json({ sent, skipped });
}

async function dailyBriefMessages(
  service: ReturnType<typeof createServiceClient>,
  trip: TripRow,
  today: string,
  zone: string,
): Promise<object[] | null> {
  const { data } = await service
    .from("itinerary_items")
    .select("title,category,time,end_time,location,date,end_date,status")
    .eq("trip_id", trip.id)
    .neq("status", "wishlist")
    // 跨日行程今天也算，所以不能只比對開始日
    .lte("date", today)
    .order("time", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true });

  const items = (data ?? []).filter((i) => {
    const end = (i.end_date as string | null) ?? (i.date as string);
    return (i.date as string) <= today && today <= end;
  }) as BriefItem[];

  if (items.length === 0) return null;

  const dayNumber = trip.start_date
    ? Math.round((Date.parse(today) - Date.parse(trip.start_date)) / 86_400_000) + 1
    : null;
  const totalDays = trip.start_date && trip.end_date
    ? Math.round((Date.parse(trip.end_date) - Date.parse(trip.start_date)) / 86_400_000) + 1
    : null;

  return [buildDailyBrief({
    tripName: trip.name,
    date: today,
    zone,
    dayNumber,
    totalDays,
    items,
    url: tripUrl(trip.id, "itinerary"),
  })];
}

async function settlementMessages(
  service: ReturnType<typeof createServiceClient>,
  trip: TripRow,
): Promise<object[] | null> {
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
