import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveSharedTabs } from "@/lib/tripTabs";
import { actorFrom, logChange } from "@/lib/activityLog";

/**
 * 把一條唯讀分享連結上的行程，複製成看的人自己的一趟旅程。
 *
 * 帶的是行程本身 —— 日期、時間、地點、備註、行程照片、戶外路段與途經點。刻意不帶的東西：
 *   費用、成員與分帳名單、Google 相簿連結、筆記分頁、交通段落、裝備與伴手禮，
 *   以及分享 / 邀請 / LINE token。
 * 判準是「這是不是那趟旅程的安排本身」：安排可以被照著走，別人的帳、別人的相簿、
 * 別人訂的那班飛機不行。
 *
 * 行程照片只複製 URL，不另外複製一份檔案：itinerary-images 是 public bucket，複製字串成本
 * 是零，真的複製檔案的話一趟幾十張照片就會把免費額度吃掉（PRODUCT.md 的免費維運是硬約束）。
 * 代價是原旅程被刪掉時複製出來的圖會斷 —— 那是壞掉一張圖，不是掉資料，比撞爆儲存空間好。
 */

/** 只用 UTC 日數做位移：夏令時間會讓本地午夜之間的間隔不是整天，diff 截斷後整段行程會偏一天 */
function toDayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

function shiftDate(date: string, days: number): string {
  return new Date((toDayNumber(date) + days) * 86_400_000).toISOString().slice(0, 10);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // 看的人不是這趟的成員，RLS 讀不到來源旅程，所以來源一律走 service client
  const service = createServiceClient();
  const COLUMNS =
    "id, user_id, name, start_date, end_date, countries, country_codes, notes, currency, destinations, enabled_tabs, shared_tabs";

  // share_allow_copy 是 23_share_fork.sql 才有的欄位；還沒跑 migration 時當作開放，
  // 與 shared_tabs 同樣的退路，不要讓功能在 migration 之前整個壞掉
  const scoped = await service
    .from("trips")
    .select(`${COLUMNS}, share_allow_copy`)
    .eq("share_token", token)
    .maybeSingle();
  const source = (scoped.error
    ? (await service.from("trips").select(COLUMNS).eq("share_token", token).maybeSingle()).data
    : scoped.data) as (Record<string, unknown> & { id: string; user_id: string }) | null;

  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (source.share_allow_copy === false) {
    return NextResponse.json({ error: "這條分享連結沒有開放複製" }, { status: 403 });
  }

  // 沒分享行程分頁的連結，對方本來就看不到行程，更不該從這裡拿走
  const tabs = resolveSharedTabs(
    source.shared_tabs as string[] | null,
    source.enabled_tabs as string[] | null
  );
  if (!tabs.includes("itinerary")) {
    return NextResponse.json({ error: "這條分享連結沒有分享行程" }, { status: 400 });
  }

  const { data: items } = await service
    .from("itinerary_items")
    .select("*")
    .eq("trip_id", source.id)
    .order("date", { ascending: true })
    .order("time", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true });

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "這趟旅程還沒有行程可以複製" }, { status: 400 });
  }

  /*
    基準日取行程的第一天，不是 trip.start_date —— 複製走的是行程，使用者選的「出發日」
    對應的就該是第一筆行程那天。兩者不一致時（出發日比第一筆行程早），用 start_date
    會讓整份行程整體往後長一段空白。
  */
  const body = await request.json().catch(() => ({}));
  const requestedStart = typeof body?.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate)
    ? body.startDate
    : null;

  /*
    基準日只能從有日期的那些算。口袋名單（status = wishlist）沒有日期，被當成基準的話
    整份行程會位移到 NaN 去。它們照樣複製，只是不套位移 —— 對方拿到的一樣是「還沒決定哪天」。
  */
  const dated = items.filter((i) => i.date);
  if (dated.length === 0) {
    return NextResponse.json({ error: "這趟旅程還沒有排定日期的行程可以複製" }, { status: 400 });
  }
  const baseDate = dated[0].date as string;
  const shift = requestedStart ? toDayNumber(requestedStart) - toDayNumber(baseDate) : 0;

  const sourceStart = (source.start_date as string | null) ?? baseDate;
  const sourceEnd = (source.end_date as string | null) ?? null;

  // 新旅程用使用者自己的 client 建，插得進去的前提就是 user_id 是他自己（RLS）
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      name: source.name,
      start_date: shiftDate(sourceStart, shift),
      end_date: sourceEnd ? shiftDate(sourceEnd, shift) : null,
      countries: source.countries ?? null,
      country_codes: source.country_codes ?? null,
      notes: source.notes ?? null,
      currency: source.currency || "TWD",
      destinations: source.destinations ?? [],
      enabled_tabs: source.enabled_tabs ?? ["transport", "itinerary", "expenses", "photos", "notes"],
      // 以下刻意留空：分帳名單、相簿都屬於原本那一趟，不屬於這份行程安排
      people: [],
      photo_album_id: null,
    })
    .select()
    .single();

  if (tripError || !trip) {
    return NextResponse.json({ error: tripError?.message ?? "Copy failed" }, { status: 500 });
  }

  const rows = items.map((item) => {
    // 明確丟掉的欄位列在這裡，其餘一律帶過去 —— 之後行程多一個欄位時不用回來補
    const { id, trip_id, created_at, date, end_date, ...rest } = item;
    void id; void trip_id; void created_at;
    return {
      ...rest,
      trip_id: trip.id,
      date: date ? shiftDate(date as string, shift) : null,
      end_date: end_date ? shiftDate(end_date as string, shift) : null,
    };
  });

  const { data: createdItems, error: itemsError } = await supabase
    .from("itinerary_items")
    .insert(rows)
    .select("id");

  if (itemsError || !createdItems) {
    // 只建了一個空殼旅程沒有意義，收掉再回報，不要在使用者的清單上留一筆空旅程
    await supabase.from("trips").delete().eq("id", trip.id);
    return NextResponse.json({ error: itemsError?.message ?? "Copy failed" }, { status: 500 });
  }

  // insert ... returning 的順序就是送進去的順序，所以用索引對回原本的行程
  const idMap = new Map<string, string>();
  items.forEach((item, i) => {
    const created = createdItems[i];
    if (created) idMap.set(item.id as string, created.id as string);
  });

  // 途經點是行程項目的一部分（分享頁上本來就讀得到），戶外路段少了它就只剩一個名字
  let waypointCount = 0;
  const { data: waypoints } = await service
    .from("route_waypoints")
    .select("*")
    .in("itinerary_item_id", [...idMap.keys()])
    .order("order_index", { ascending: true });

  if (waypoints && waypoints.length > 0) {
    const wpRows = waypoints
      .map((wp) => {
        const { id, itinerary_item_id, created_at, ...rest } = wp;
        void id; void created_at;
        const target = idMap.get(itinerary_item_id as string);
        return target ? { ...rest, itinerary_item_id: target } : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (wpRows.length > 0) {
      const { error: wpError } = await supabase.from("route_waypoints").insert(wpRows);
      // 途經點沒進去不該讓整趟複製失敗：行程已經在了，缺的是高度圖
      if (!wpError) waypointCount = wpRows.length;
    }
  }

  await logChange({
    action: "create",
    table: "trips",
    actor: actorFrom(user),
    tripId: trip.id,
    tripName: trip.name,
    entityId: trip.id,
    after: trip,
    note: `從分享連結複製（${rows.length} 筆行程${waypointCount > 0 ? `、${waypointCount} 個途經點` : ""}）`,
    request,
  });

  return NextResponse.json({
    tripId: trip.id,
    tripName: trip.name,
    itemCount: rows.length,
    waypointCount,
  });
}
