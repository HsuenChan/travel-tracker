import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 旅途中回報裝置時區。
 *
 * 只在今天落在這趟的起訖日之間才寫 —— 提前訂票時人還在出發地，那時候的裝置時區
 * 不是目的地的時區，寫進來會把每日推播的時間帶偏。
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { timeZone } = await request.json();
  // Intl 認得的才收，避免把亂字串寫進去讓 cron 每天噴錯
  if (typeof timeZone !== "string" || !timeZone) {
    return NextResponse.json({ error: "timeZone required" }, { status: 400 });
  }
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
  } catch {
    return NextResponse.json({ error: "Unknown time zone" }, { status: 400 });
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("start_date, end_date, time_zone")
    .eq("id", id)
    .maybeSingle();
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (trip.time_zone === timeZone) return NextResponse.json({ success: true, unchanged: true });

  /*
    用回報者當地的今天來判斷「是否在旅途中」。
    用伺服器的 UTC 今天會讓亞洲的清晨與美洲的傍晚各差一天，剛好在出發日與結束日翻車。
  */
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  const onTrip = !!trip.start_date && !!trip.end_date
    && trip.start_date <= today && today <= trip.end_date;
  if (!onTrip) return NextResponse.json({ success: true, skipped: "not_on_trip" });

  const { error } = await supabase.from("trips").update({ time_zone: timeZone }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, timeZone });
}
