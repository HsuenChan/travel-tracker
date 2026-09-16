import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildSheets,
  spreadsheetCreateBody,
  spreadsheetTitle,
  valuesUpdateBody,
  type ExportItem,
  type ExportWaypoint,
  type ExportSegment,
  type ExportExpense,
  type ExportSouvenir,
  type ExportGear,
} from "@/lib/itineraryExport";
import { TRIP_TAB_KEYS } from "@/lib/tripTabs";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * Google 的授權問題一律回 403 而不是 401：前端的 fetchWithAuth 把 401 當成「本站登入過期」
 * 直接送去登出，用 401 會讓過期的 Google token 把使用者踢出旅程。
 */
function googleAuthRequired() {
  return NextResponse.json(
    { error: "Google authorization required", code: "google_auth_required" },
    { status: 403 }
  );
}

/**
 * 把行程匯出成使用者自己 Google 帳號裡的一份試算表。
 *
 * accessToken 由前端用 Google Identity Services 當場要來（scope 只有 drive.file，也就是
 * 只能碰這個 App 自己建的檔案），所以這裡不存任何 Google 憑證。
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { tripId, accessToken, tabs } = await request.json();
  if (!tripId || !accessToken) {
    return NextResponse.json({ error: "tripId and accessToken required" }, { status: 400 });
  }
  // 沒指定就照這趟啟用的分頁全部匯出，維持舊行為
  const wanted: string[] = Array.isArray(tabs) && tabs.length > 0 ? tabs : [];

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("name,start_date,end_date,enabled_tabs,ai_notes")
    .eq("id", tripId)
    .single();
  if (tripError || !trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const tabOrder: string[] = trip.enabled_tabs ?? TRIP_TAB_KEYS;
  // 照旅程分頁的順序排，工作表的順序就和 App 裡看到的一樣
  const selected = tabOrder.filter((t) => (wanted.length === 0 ? true : wanted.includes(t)));

  const want = (tab: string) => selected.includes(tab);

  // 排序與 /api/itinerary 一致，匯出的順序就是時間軸上看到的順序
  const itemsRes = want("itinerary")
    ? await supabase
        .from("itinerary_items")
        .select("id,date,title,category,time,end_date,end_time,location,notes,distance_km,ascent_m,descent_m,status")
        .eq("trip_id", tripId)
        .order("date", { ascending: true })
        .order("time", { ascending: true, nullsFirst: true })
        .order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (itemsRes.error) return NextResponse.json({ error: itemsRes.error.message }, { status: 500 });
  const items = (itemsRes.data ?? []) as ExportItem[];

  const outdoorIds = items.filter((i) => i.category === "outdoor").map((i) => i.id);
  let waypoints: ExportWaypoint[] = [];
  if (outdoorIds.length > 0) {
    const { data, error } = await supabase
      .from("route_waypoints")
      .select("itinerary_item_id,order_index,name,elevation_m,distance_km,drop_m,duration_min,day_offset,type,notes")
      .in("itinerary_item_id", outdoorIds)
      .order("itinerary_item_id", { ascending: true })
      .order("order_index", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    waypoints = (data ?? []) as ExportWaypoint[];
  }

  const [segRes, expRes, souRes, gearRes] = await Promise.all([
    want("transport")
      ? supabase.from("segments").select('"order",type,date,time,arrival_date,arrival_time,from_city,from_iata,to_city,to_iata,flight_no,aircraft').eq("trip_id", tripId).order("order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    want("expenses")
      ? supabase.from("expenses").select("date,description,category,amount,currency,paid_by,split_with,notes").eq("trip_id", tripId).order("date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    want("souvenirs")
      ? supabase.from("souvenirs").select("name,is_checked,tags,notes").eq("trip_id", tripId).order("order_index", { ascending: true }).order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    want("gear")
      ? supabase.from("gear_items").select("name,category,scope,weight_role,weight_g,qty,assigned_to,is_checked,notes").eq("trip_id", tripId).order("order_index", { ascending: true }).order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const sheets = buildSheets(selected, {
    items,
    waypoints,
    segments: (segRes.data ?? []) as ExportSegment[],
    expenses: (expRes.data ?? []) as ExportExpense[],
    souvenirs: (souRes.data ?? []) as ExportSouvenir[],
    gear: (gearRes.data ?? []) as ExportGear[],
    notes: want("notes") ? ((trip.ai_notes as { content?: string } | null)?.content ?? null) : null,
  });

  if (sheets.length === 0) {
    return NextResponse.json({ error: "Nothing to export", code: "empty" }, { status: 400 });
  }
  const title = spreadsheetTitle(trip);
  const auth = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  const createRes = await fetch(SHEETS_API, {
    method: "POST",
    headers: auth,
    body: JSON.stringify(spreadsheetCreateBody(title, sheets)),
  });

  if (!createRes.ok) {
    const detail = await createRes.text();
    if (createRes.status === 401) return googleAuthRequired();
    if (createRes.status === 403) {
      // API 沒開跟授權不足都是 403，但要使用者做的事完全不同
      if (/SERVICE_DISABLED|has not been used in project/i.test(detail)) {
        return NextResponse.json(
          { error: "Google Sheets API is not enabled for this OAuth client", code: "sheets_api_disabled" },
          { status: 403 }
        );
      }
      return googleAuthRequired();
    }
    console.error("Sheets create failed", createRes.status, detail);
    return NextResponse.json({ error: "Google Sheets API error" }, { status: 502 });
  }

  const created = await createRes.json();
  const valuesRes = await fetch(
    `${SHEETS_API}/${created.spreadsheetId}/values:batchUpdate`,
    { method: "POST", headers: auth, body: JSON.stringify(valuesUpdateBody(sheets)) }
  );

  if (!valuesRes.ok) {
    // 試算表已經建好但只有標題列，回錯誤時附上連結，使用者才知道雲端硬碟裡那份是什麼
    console.error("Sheets values update failed", valuesRes.status, await valuesRes.text());
    return NextResponse.json(
      { error: "Google Sheets API error", url: created.spreadsheetUrl },
      { status: 502 }
    );
  }

  return NextResponse.json({
    url: created.spreadsheetUrl,
    title,
    itemCount: items.length,
    waypointCount: waypoints.length,
  });
}
