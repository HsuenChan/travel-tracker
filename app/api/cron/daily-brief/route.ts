import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveTimeZone, localDate, localHour } from "@/lib/tripTimezone";
import { pushMessage } from "@/lib/linePush";
import { dailyBriefMessages, loadBriefTrips, settlementMessages } from "@/lib/briefData";

/** 當地幾點發 */
const SEND_HOUR = 8;

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
  // 沒帶或帶錯一律 404 而不是 401：401 等於告訴對方「這裡有東西，只是你進不去」
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
  const loaded = await loadBriefTrips(service, tripIds);
  if (loaded.error) return NextResponse.json({ error: loaded.error }, { status: 500 });
  const trips = new Map(loaded.trips.map((t) => [t.id, t]));

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

    const release = () => service.from("line_push_log").delete()
      .eq("group_id", m.group_id).eq("trip_id", trip.id)
      .eq("kind", kind).eq("dedupe_key", dedupeKey);

    const messages = ongoing
      ? await dailyBriefMessages(service, trip, today)
      : await settlementMessages(service, trip);

    if (!messages) {
      // 沒東西可推就把卡位收回來，明天同一時間還會再試
      await release();
      bump("nothing_to_say");
      continue;
    }

    const res = await pushMessage(m.group_id, messages);
    if (res.ok) {
      sent += 1;
    } else {
      // 推失敗也要收回卡位，否則這一天就永遠不會再試
      await release();
      bump(`push_failed_${res.status}`);
    }
  }

  return NextResponse.json({ sent, skipped });
}
