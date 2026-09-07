import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildSheets,
  spreadsheetCreateBody,
  spreadsheetTitle,
  valuesUpdateBody,
  type ExportItem,
  type ExportWaypoint,
} from "@/lib/itineraryExport";

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

  const { tripId, accessToken } = await request.json();
  if (!tripId || !accessToken) {
    return NextResponse.json({ error: "tripId and accessToken required" }, { status: 400 });
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("name,start_date,end_date")
    .eq("id", tripId)
    .single();
  if (tripError || !trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  // 排序與 /api/itinerary 一致，匯出的順序就是時間軸上看到的順序
  const { data: itemRows, error: itemsError } = await supabase
    .from("itinerary_items")
    .select("id,date,title,category,time,end_date,end_time,location,notes,distance_km,ascent_m,descent_m")
    .eq("trip_id", tripId)
    .order("date", { ascending: true })
    .order("time", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true });
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  const items = (itemRows ?? []) as ExportItem[];
  if (items.length === 0) {
    return NextResponse.json({ error: "Nothing to export", code: "empty" }, { status: 400 });
  }

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

  const sheets = buildSheets(items, waypoints);
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
