import { createServiceClient } from "@/lib/supabase/service";

/**
 * 後台操作紀錄的唯一寫入點。
 *
 * 設計上的兩條硬規則：
 * 1. 這裡的任何失敗都不准往外丟 —— 記錄壞掉不能害使用者的操作跟著失敗。
 * 2. 每一筆都自己帶足夠的快照（trip_name、entity_label、snapshot），
 *    來源資料被刪掉之後這筆紀錄仍然讀得懂，不依賴 join。
 */

export type ChangeAction = "create" | "update" | "delete" | "restore";
export type AuthAction = "login" | "logout" | "login_failed";
export type ActorSource = "web" | "line" | "ai" | "import" | "system";

export interface FieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

export type Row = Record<string, unknown>;

interface EntitySpec {
  /** lib/tripTabs.ts 的 key，決定這筆事件掛在後台哪個 tab 篩選下 */
  tab: string;
  noun: string;
  /** 找標題時依序試這些欄位，第一個有值的當 entity_label */
  titleFields: string[];
  fields: Record<string, string>;
}

/**
 * 哪些表要記、每個欄位在後台顯示成什麼。
 *
 * 沒列在 fields 裡的欄位不會進 diff（但仍會進 snapshot，所以還原不受影響）。
 */
export const ENTITY_SPECS: Record<string, EntitySpec> = {
  itinerary_items: {
    tab: "itinerary",
    noun: "行程",
    titleFields: ["title"],
    fields: {
      title: "標題",
      date: "日期",
      end_date: "結束日期",
      time: "時間",
      end_time: "結束時間",
      category: "類型",
      location: "地點",
      notes: "備註",
      image_urls: "圖片",
      distance_km: "距離",
      ascent_m: "總上升",
      descent_m: "總下降",
      show_elevation: "高度圖顯示",
      sort_order: "排序",
    },
  },
  route_waypoints: {
    tab: "itinerary",
    noun: "途經點",
    titleFields: ["name"],
    fields: {
      name: "名稱",
      type: "類型",
      order_index: "順序",
      elevation_m: "海拔",
      distance_km: "累計距離",
      day_offset: "第幾天",
      duration_min: "行進時間",
      drop_m: "落差",
      lat: "緯度",
      lng: "經度",
      notes: "備註",
    },
  },
  expenses: {
    tab: "expenses",
    noun: "費用",
    titleFields: ["description"],
    fields: {
      description: "項目",
      amount: "金額",
      end_date: "結束日期",
      currency: "幣別",
      category: "分類",
      date: "日期",
      paid_by: "付款人",
      split_with: "分攤對象",
      notes: "備註",
      itinerary_item_id: "關聯行程",
    },
  },
  settlement_paid: {
    tab: "expenses",
    noun: "結算",
    titleFields: ["pair_key"],
    fields: { pair_key: "結算對象" },
  },
  segments: {
    tab: "transport",
    noun: "路線",
    titleFields: ["flight_no", "to_city"],
    fields: {
      from_city: "出發地",
      from_iata: "出發代碼",
      to_city: "抵達地",
      to_iata: "抵達代碼",
      type: "交通方式",
      date: "出發日期",
      time: "出發時間",
      arrival_date: "抵達日期",
      arrival_time: "抵達時間",
      flight_no: "班次",
      aircraft: "機型",
      order: "順序",
    },
  },
  souvenirs: {
    tab: "souvenirs",
    noun: "伴手禮",
    titleFields: ["name"],
    fields: {
      name: "名稱",
      is_checked: "已購買",
      image_url: "圖片",
      tags: "標籤",
      notes: "備註",
      order_index: "順序",
    },
  },
  gear_items: {
    tab: "gear",
    noun: "裝備",
    titleFields: ["name"],
    fields: {
      name: "名稱",
      category: "分類",
      scope: "personal / group",
      weight_g: "單件重量",
      qty: "數量",
      weight_role: "重量歸類",
      assigned_to: "誰帶",
      image_url: "圖片",
      is_checked: "已打包",
      order_index: "順序",
      notes: "備註",
    },
  },
  gear_closet: {
    tab: "gear",
    noun: "裝備櫃",
    titleFields: ["name"],
    fields: {
      name: "名稱",
      category: "分類",
      weight_g: "單件重量",
      qty: "數量",
      weight_role: "重量歸類",
      image_url: "圖片",
      notes: "備註",
    },
  },
  trips: {
    tab: "trip",
    noun: "旅程",
    titleFields: ["name"],
    fields: {
      name: "名稱",
      start_date: "開始日期",
      end_date: "結束日期",
      countries: "國家",
      currency: "主幣別",
      people: "成員",
      enabled_tabs: "啟用分頁",
      shared_tabs: "分享分頁",
      photo_album_id: "相簿連結",
      notes: "備註",
      destinations: "目的地",
    },
  },
};

export function entitySpec(table: string): EntitySpec | null {
  return ENTITY_SPECS[table] ?? null;
}

export function entityLabel(table: string, ...rows: (Row | null | undefined)[]): string {
  const spec = entitySpec(table);
  const titleFields = spec?.titleFields ?? ["name", "title"];
  for (const row of rows) {
    if (!row) continue;
    for (const f of titleFields) {
      const v = row[f];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
  }
  return spec?.noun ?? table;
}

/** 空字串與 null 視為同一件事，避免表單送空值時製造假異動 */
function normalise(value: unknown): unknown {
  if (value === undefined || value === "") return null;
  return value;
}

function sameValue(a: unknown, b: unknown): boolean {
  const x = normalise(a);
  const y = normalise(b);
  if (x === y) return true;
  if (x === null || y === null) return false;
  if (typeof x === "object" || typeof y === "object") {
    return JSON.stringify(x) === JSON.stringify(y);
  }
  // 資料庫的 numeric 讀回來是字串，"12" 與 12 不該算成一次異動
  if (typeof x === "number" || typeof y === "number") return String(x) === String(y);
  return false;
}

export function diffFields(table: string, before: Row | null, after: Row | null): FieldChange[] {
  const spec = entitySpec(table);
  if (!spec || !before || !after) return [];
  const changes: FieldChange[] = [];
  for (const [field, label] of Object.entries(spec.fields)) {
    if (!(field in after)) continue;
    if (sameValue(before[field], after[field])) continue;
    changes.push({
      field,
      label,
      before: normalise(before[field]) ?? null,
      after: normalise(after[field]) ?? null,
    });
  }
  return changes;
}

export interface Actor {
  id: string | null;
  name: string | null;
}

/** Supabase user 轉成紀錄用的操作者，名稱取法跟 /api/me 一致 */
export function actorFrom(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null): Actor {
  if (!user) return { id: null, name: null };
  const meta = user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === "string" ? meta.full_name : null) ??
    user.email?.split("@")[0] ??
    null;
  return { id: user.id, name };
}

export function requestMeta(request: { headers: Headers } | null | undefined): {
  ip: string | null;
  userAgent: string | null;
} {
  if (!request) return { ip: null, userAgent: null };
  const fwd = request.headers.get("x-forwarded-for");
  return {
    ip: fwd?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent"),
  };
}

async function resolveTripName(tripId: string | null): Promise<string | null> {
  if (!tripId) return null;
  try {
    const { data } = await createServiceClient()
      .from("trips")
      .select("name")
      .eq("id", tripId)
      .maybeSingle();
    return (data?.name as string) ?? null;
  } catch {
    return null;
  }
}

export interface LogChangeInput {
  action: ChangeAction;
  table: string;
  actor: Actor;
  /** 沒帶就從 before / after 的 trip_id 推 */
  tripId?: string | null;
  /** 批次寫入時先查好一次傳進來，避免每列都去 resolve 一次旅程名稱 */
  tripName?: string | null;
  entityId?: string | null;
  before?: Row | null;
  after?: Row | null;
  /** 覆寫自動推導的標題，例如 settlement_paid 這種沒有標題欄位的表 */
  label?: string | null;
  /** 批次操作沒有單列的 before/after，改成直接描述改了什麼 */
  changes?: FieldChange[];
  /** 批次操作的一句話說明 */
  note?: string | null;
  source?: ActorSource;
  request?: { headers: Headers } | null;
  restoredFrom?: string | null;
}

export async function logChange(input: LogChangeInput): Promise<void> {
  try {
    const { action, table, actor, before = null, after = null } = input;
    const spec = entitySpec(table);
    const tripId =
      input.tripId ??
      ((after?.trip_id as string) || (before?.trip_id as string) || null);

    const entityId =
      input.entityId ?? ((after?.id as string) || (before?.id as string) || null);

    const { ip, userAgent } = requestMeta(input.request);

    await createServiceClient().from("activity_log").insert({
      kind: "change",
      action,
      actor_id: actor.id,
      actor_name: actor.name,
      actor_source: input.source ?? "web",
      trip_id: tripId,
      trip_name: input.tripName !== undefined ? input.tripName : await resolveTripName(tripId),
      tab: spec?.tab ?? null,
      entity_table: table,
      entity_id: entityId,
      entity_label: input.label ?? entityLabel(table, after, before),
      note: input.note ?? null,
      changes:
        input.changes ??
        (action === "update" || action === "restore" ? diffFields(table, before, after) : null),
      snapshot: before,
      restored_from: input.restoredFrom ?? null,
      ip,
      user_agent: userAgent,
    });
  } catch {
    // 有意吞掉：紀錄寫不進去也不能影響使用者原本的操作
  }
}

export interface LogAuthInput {
  action: AuthAction;
  actor: Actor;
  request?: { headers: Headers } | null;
}

export async function logAuth(input: LogAuthInput): Promise<void> {
  try {
    const { ip, userAgent } = requestMeta(input.request);
    await createServiceClient().from("activity_log").insert({
      kind: "auth",
      action: input.action,
      actor_id: input.actor.id,
      actor_name: input.actor.name,
      actor_source: "web",
      ip,
      user_agent: userAgent,
    });
  } catch {
    // 同上
  }
}

/** 同一條連結、同一個來源 IP，這段時間內只記一筆 */
const SHARE_VIEW_DEDUPE_MS = 30 * 60_000;

export interface LogShareViewInput {
  tripId: string;
  tripName: string | null;
  request?: { headers: Headers } | null;
}

/**
 * 分享連結被打開。
 *
 * 看的人沒有帳號，所以 actor_id 是 null、actor_name 記成「分享連結訪客」——
 * 能辨識的只有 IP 與裝置字串，跟登入失敗記的東西同一個層級，不會多記什麼。
 *
 * 去重是必要的而不是優化：分享頁一重整就是一次瀏覽，手機上讀個行程可以按十幾次，
 * 不擋的話「存取」頁會被同一個人洗成幾十列，真正想看的「有沒有人來看過」反而讀不出來。
 */
export async function logShareView(input: LogShareViewInput): Promise<void> {
  try {
    const { ip, userAgent } = requestMeta(input.request);
    const supabase = createServiceClient();

    const since = new Date(Date.now() - SHARE_VIEW_DEDUPE_MS).toISOString();
    let recent = supabase
      .from("activity_log")
      .select("id")
      .eq("kind", "view")
      .eq("trip_id", input.tripId)
      .gte("created_at", since)
      .limit(1);
    // IP 取不到時（本機、某些代理）就不靠 IP 分辨，改成整條連結在這段時間內只記一筆，
    // 寧可少記也不要把同一個人記成好幾個訪客
    recent = ip ? recent.eq("ip", ip) : recent.is("ip", null);

    const { data: existing } = await recent;
    if (existing && existing.length > 0) return;

    await supabase.from("activity_log").insert({
      kind: "view",
      action: "share_view",
      actor_id: null,
      actor_name: "分享連結訪客",
      actor_source: "web",
      trip_id: input.tripId,
      trip_name: input.tripName,
      ip,
      user_agent: userAgent,
    });
  } catch {
    // 記錄失敗不能影響看行程這件事本身
  }
}
