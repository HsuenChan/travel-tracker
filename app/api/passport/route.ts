import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildPassport, type ItineraryRow, type SegmentRow, type TripRow } from "@/lib/passport";

const TRIP_COLUMNS =
  "id, name, start_date, end_date, countries, country_codes, photo_album_id";

/**
 * 旅遊護照的資料來源：跨旅程聚合，一次回完。
 *
 * 前端不自己拉全部旅程再算 —— 護照上的數字（趟數、國家、天數）必須和首頁「旅遊足跡」一致，
 * 兩邊各算一次就是遲早會對不起來。聚合邏輯統一在 lib/passport.ts。
 *
 * 範圍包含**自己建立的**與**被邀請加入的**旅程。trips 的 RLS 只放行 owner，所以光用使用者的
 * client 查會漏掉後者 —— 而那些是真的去過的旅程，少算就會出現「去過日本一次」這種錯的護照。
 * 因此先用使用者的 client 查出自己的成員資格（trip_members 的 RLS 放行自己那幾列），再用
 * service client 只針對這份已授權的 id 清單取資料。
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const meta = user.user_metadata ?? {};
  const holder = {
    name: (meta.full_name as string) || (meta.name as string) || user.email?.split("@")[0] || "TRAVELLER",
    avatarUrl: (meta.avatar_url as string) || (meta.picture as string) || null,
  };

  const { data: memberRows } = await supabase
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", user.id);
  const joinedIds = [...new Set((memberRows ?? []).map((r) => r.trip_id as string))];

  const service = createServiceClient();
  const [ownedRes, joinedRes] = await Promise.all([
    service.from("trips").select(TRIP_COLUMNS).eq("user_id", user.id),
    joinedIds.length
      ? service.from("trips").select(TRIP_COLUMNS).in("id", joinedIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (ownedRes.error) {
    return NextResponse.json({ error: ownedRes.error.message }, { status: 500 });
  }

  // 自己開的旅程也會在 trip_members 裡，所以要去重
  const byId = new Map<string, TripRow>();
  for (const row of [...(ownedRes.data ?? []), ...(joinedRes.data ?? [])]) {
    byId.set((row as TripRow).id, row as TripRow);
  }
  const list = [...byId.values()];

  if (list.length === 0) {
    return NextResponse.json({ passport: buildPassport(holder, [], [], []) });
  }

  const tripIds = list.map((t) => t.id);

  const [segRes, itemRes] = await Promise.all([
    service.from("segments").select("trip_id, from_iata, to_iata").in("trip_id", tripIds),
    service
      .from("itinerary_items")
      .select("trip_id, date, image_urls")
      .in("trip_id", tripIds)
      // 代表照片取「第一張」，所以順序必須固定，不能靠資料庫回傳的自然順序
      .order("date", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  const passport = buildPassport(
    holder,
    list,
    (segRes.data ?? []) as SegmentRow[],
    (itemRes.data ?? []) as ItineraryRow[]
  );

  return NextResponse.json({ passport });
}
