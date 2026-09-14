import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminUser } from "@/lib/adminAuth";
import { actorFrom, logChange, entityLabel, type Row } from "@/lib/activityLog";
import { deriveWaypointStats } from "@/lib/waypointStats";

/**
 * 把一筆異動還原回去。
 *
 * 三條規則：
 * - 「新增」不提供還原。撤銷新增就是刪除，那件事在 app 裡做，後台不該開第二條刪除路徑。
 * - 沒有 snapshot 的事件（批次分類操作那種）不能還原，因為當時就沒留下單列的樣子。
 * - 還原本身也是一次異動，會再寫一筆 restore 紀錄指回原事件。
 */

/** 這些外鍵斷掉時可以清成 null 再救回來，其他的斷了就是真的救不回來 */
const OPTIONAL_FKS: Record<string, string[]> = {
  expenses: ["itinerary_item_id", "user_id"],
  itinerary_items: ["user_id"],
  segments: ["user_id"],
  gear_items: ["owner_user_id"],
  souvenirs: [],
};

interface DbError { code?: string; message: string }

function brokenColumn(error: DbError, candidates: string[]): string | null {
  if (error.code !== "23503") return null;
  return candidates.find((c) => error.message.includes(c)) ?? null;
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return new NextResponse(null, { status: 404 });

  const { eventId } = await request.json();
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  const service = createServiceClient();
  const { data: event } = await service.from("activity_log").select("*").eq("id", eventId).maybeSingle();
  if (!event) return NextResponse.json({ error: "找不到這筆紀錄" }, { status: 404 });

  if (event.kind !== "change") {
    return NextResponse.json({ error: "登入紀錄沒有東西可以還原" }, { status: 400 });
  }
  if (event.action === "create") {
    return NextResponse.json({ error: "新增不提供還原，要移除請直接在旅程裡刪除" }, { status: 400 });
  }
  if (event.action === "restore") {
    return NextResponse.json({ error: "這筆本身就是一次還原" }, { status: 400 });
  }
  if (!event.snapshot) {
    return NextResponse.json({ error: "這筆異動沒有留下可還原的快照" }, { status: 400 });
  }

  const table = event.entity_table as string;
  const snapshot = event.snapshot as Row;
  const cleared: string[] = [];

  // --- 整段途經點：snapshot 存的是整串，不是單列 ---
  if (table === "route_waypoints") {
    const itemId = event.entity_id as string;
    const waypoints = (snapshot.waypoints as Row[]) ?? [];

    const { data: item } = await service.from("itinerary_items").select("id").eq("id", itemId).maybeSingle();
    if (!item) return NextResponse.json({ error: "這段行程已經被刪除，途經點無法還原" }, { status: 409 });

    const { data: current } = await service.from("route_waypoints").select("*").eq("itinerary_item_id", itemId);
    await service.from("route_waypoints").delete().eq("itinerary_item_id", itemId);

    if (waypoints.length > 0) {
      const { error } = await service.from("route_waypoints").insert(waypoints);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 行程卡上的距離與爬升要跟著回到當時的值
    const stats = deriveWaypointStats(
      waypoints.map((w) => ({
        elevation_m: (w.elevation_m as number) ?? null,
        distance_km: (w.distance_km as number) ?? null,
      }))
    );
    await service.from("itinerary_items").update(stats).eq("id", itemId);

    await logChange({
      action: "restore",
      table,
      actor: actorFrom(admin),
      tripId: event.trip_id,
      tripName: event.trip_name,
      entityId: itemId,
      label: event.entity_label,
      changes: [{
        field: "waypoints",
        label: "途經點",
        before: `${current?.length ?? 0} 個`,
        after: `${waypoints.length} 個`,
      }],
      note: "從後台還原整段途經點",
      restoredFrom: eventId,
      request,
    });
    return NextResponse.json({ success: true, restored: waypoints.length });
  }

  // --- 一般單列 ---
  const optional = OPTIONAL_FKS[table] ?? [];
  // restore 紀錄的 diff 是「還原前的現況 → 還原後」，所以要留下動手之前的樣子。
  // 刪除還原沒有現況（東西本來就不在了），維持 null。
  let beforeRestore: Row | null = null;

  if (event.action === "delete") {
    // settlement_paid 是複合主鍵，upsert 才不會撞已存在的那筆
    const isComposite = table === "settlement_paid";
    let payload: Row = { ...snapshot };

    for (let attempt = 0; attempt < optional.length + 1; attempt++) {
      const { error } = isComposite
        ? await service.from(table).upsert(payload)
        : await service.from(table).insert(payload);
      if (!error) break;

      if (error.code === "23505") {
        return NextResponse.json({ error: "這筆資料已經存在，可能先前已經還原過了" }, { status: 409 });
      }
      const col = brokenColumn(error, optional);
      if (!col) {
        if (error.code === "23503") {
          return NextResponse.json(
            { error: "它所屬的旅程或上層資料已經被刪除，這筆救不回來了" },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      // 關聯對象不在了就把那個欄位清掉再試一次，總比整筆救不回來好
      payload = { ...payload, [col]: null };
      cleared.push(col);
    }
  } else {
    // update：把 snapshot 的欄位寫回去
    const { data: current } = await service.from(table).select("*").eq("id", event.entity_id).maybeSingle();
    if (!current) {
      return NextResponse.json({ error: "這筆資料已經被刪除，請改還原那次刪除" }, { status: 409 });
    }
    beforeRestore = current as Row;

    const { id, created_at, ...fields } = snapshot as Row & { id?: string; created_at?: string };
    void id; void created_at;
    let payload: Row = fields;

    for (let attempt = 0; attempt < optional.length + 1; attempt++) {
      const { error } = await service.from(table).update(payload).eq("id", event.entity_id);
      if (!error) break;
      const col = brokenColumn(error, optional);
      if (!col) return NextResponse.json({ error: error.message }, { status: 500 });
      payload = { ...payload, [col]: null };
      cleared.push(col);
    }
  }

  // 還原後的樣子，寫進 restore 紀錄的 diff
  const { data: after } = event.entity_id
    ? await service.from(table).select("*").eq("id", event.entity_id).maybeSingle()
    : { data: null };

  await logChange({
    action: "restore",
    table,
    actor: actorFrom(admin),
    tripId: event.trip_id,
    tripName: event.trip_name,
    entityId: event.entity_id,
    label: event.entity_label ?? entityLabel(table, snapshot),
    before: beforeRestore,
    after: after ?? snapshot,
    note: cleared.length
      ? `從後台還原，已失效的關聯欄位已清空：${cleared.join("、")}`
      : "從後台還原",
    restoredFrom: eventId,
    request,
  });

  return NextResponse.json({ success: true, cleared });
}
