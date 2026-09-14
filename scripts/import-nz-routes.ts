/**
 * 把 PocketBase 上的紐西蘭溪降路線匯入成某趟旅程的戶外行程。
 *
 * 一次性工具，不會被 app 打包 —— 直接跑：
 *   node scripts/import-nz-routes.ts            # 預演，只印出會做什麼
 *   node scripts/import-nz-routes.ts --apply    # 真的寫進資料庫
 *
 * 需要先跑過 supabase/17_route_profile.sql，否則 route_profile 欄位不存在。
 *
 * 同名的既有行程一律「合併」而不是新增：既有的標題、備註、手工填的途經點都保留，
 * 只補上 route_profile。這條溪的 30 個途經點是人一個一個敲的，不能被匯入洗掉。
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Bilingual, RouteProfile, RouteSection, RouteStep, RouteTopoPage, RouteUpdate, RouteVideo } from "../lib/routeProfile.ts";
import { parseGrading } from "../lib/routeProfile.ts";

const ROUTES_API = "https://raych-pocketbase.fly.dev/api/collections/nz_routes/records?page=1&perPage=1000&skipTotal=1&sort=name";
const TRIP_NAME = "紐西蘭溪降小隊";
/** 全部先放同一天，日期由使用者自己在畫面上調整 */
const TARGET_DATE = "2026-09-14";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apply = process.argv.includes("--apply");

// ---------------------------------------------------------------- env

/** .env.local 只有這支腳本要讀，為了它拉一個 dotenv 進來不划算 */
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local");

async function db(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------- normalise

/** PocketBase 的一筆路線紀錄。欄位幾乎都可能是空字串而不是 null */
interface SourceRecord {
  [key: string]: unknown;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

/** zh / en 成對的兩個欄位收成一個 Bilingual */
function pair(r: SourceRecord, zhKey: string, enKey: string): Bilingual {
  return { zh: str(r[zhKey]), en: str(r[enKey]) };
}

function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
}

function normalize(r: SourceRecord): RouteProfile {
  const details = (r.details && typeof r.details === "object" ? r.details : {}) as SourceRecord;

  const approach_steps: RouteStep[] = arr(r.approach_steps)
    .map((s) => ({ zh: str(s.zh), en: str(s.en) }))
    .filter((s) => s.zh || s.en);

  const route_sections: RouteSection[] = arr(r.route_sections)
    .map((s) => ({ name: str(s.name), zh: str(s.zh), detail: str(s.detail), time: str(s.time) }))
    .filter((s) => s.name || s.zh || s.detail || s.time);

  const videos: RouteVideo[] = arr(r.videos)
    .map((v) => ({ provider: str(v.provider), title: str(v.title), url: str(v.url) ?? "" }))
    .filter((v) => v.url);

  const topo_pages: RouteTopoPage[] = arr(r.topo_pages)
    .map((p) => ({ page: num(p.page), zh: str(p.zh), en: str(p.en), asset: str(p.asset) }))
    .filter((p) => p.asset || p.zh || p.en);

  const recent_updates: RouteUpdate[] = arr(r.recent_updates)
    .map((u) => ({ date: str(u.date), author: str(u.author), zh: str(u.zh), en: str(u.en) }))
    .filter((u) => u.zh || u.en);

  const photos = Array.isArray(r.photos)
    ? r.photos.map(str).filter((p): p is string => p !== null)
    : [];

  return {
    source: "kiwicanyons",
    name_en: str(r.name_en) ?? str(r.name),
    subtitle: pair(r, "subtitle_zh", "subtitle"),
    region: pair(r, "region", "region_en"),
    location: pair(r, "location_zh", "location"),
    grading: parseGrading(str(r.grading)),
    character: pair(r, "character_zh", "character"),
    gear: pair(r, "gear_zh", "gear"),
    hazards: pair(r, "hazards_zh", "hazards"),
    first_descent: str(r.first_descent),
    gps: str(r.gps),
    elevation_m: num(r.elevation),
    details: {
      rock: pair(details, "rock_zh", "rock"),
      catchment: pair(details, "catchment_zh", "catchment"),
      anchors: pair(details, "anchors_zh", "anchors"),
      water: pair(details, "water_zh", "water"),
      flood: pair(details, "flood_zh", "flood"),
      map_sheet: str(details.map_sheet),
    },
    times: {
      approach: str(r.approach_time),
      descent: str(r.descent_time),
      back: str(r.return_time),
      total: str(r.total_time),
      ab_shuttle: str(r.ab_shuttle),
      max_drop: str(r.max_drop),
    },
    approach: pair(r, "approach_zh", "approach"),
    approach_steps,
    route_sections,
    photos,
    videos,
    topo_url: str(r.topo_url),
    topo_pages,
    source_url: str(r.source_url),
    note: str(r.note),
    recent_updates,
    imported_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------- matching

/**
 * 比對用的名字。
 *
 * 既有行程的標題把分級黏在後面（「Cross Creek v3a2II」），而來源只有「Cross Creek」——
 * 不剝掉的話這三筆會被當成新路線再建一次，於是同一條溪出現兩張卡。
 */
function baseName(title: string): string {
  return title
    .replace(/\s*v\d+\s*a\d+\s*[IVX]+\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** gpx 點位的名字→途經點類型。認不出來就留空，總比猜錯好 */
function waypointType(name: string): string | null {
  if (/停車|park/i.test(name)) return "trailhead";
  if (/入溪/.test(name)) return "put_in";
  if (/出溪/.test(name)) return "take_out";
  if (/hut|山屋/i.test(name)) return "hut";
  if (/營地|camp/i.test(name)) return "camp";
  if (/橫渡|渡溪|橋|岔|轉折/.test(name)) return "junction";
  return null;
}

// ---------------------------------------------------------------- main

interface ItineraryRow {
  id: string;
  title: string;
  category: string | null;
  date: string;
  sort_order: number | null;
}

async function main() {
  console.log(`來源：${ROUTES_API}`);
  const payload = (await (await fetch(ROUTES_API)).json()) as { items: SourceRecord[] };
  const records = payload.items ?? [];
  console.log(`取得 ${records.length} 條路線\n`);
  if (records.length === 0) throw new Error("API returned no routes");

  const trips = (await db(`trips?select=id,user_id,name&name=eq.${encodeURIComponent(TRIP_NAME)}`)) as { id: string; user_id: string }[];
  if (trips.length === 0) throw new Error(`trip not found: ${TRIP_NAME}`);
  const trip = trips[0];
  console.log(`目標旅程：${TRIP_NAME} (${trip.id})\n`);

  const existing = (await db(`itinerary_items?select=id,title,category,date,sort_order&trip_id=eq.${trip.id}`)) as ItineraryRow[];
  const byName = new Map(existing.map((i) => [baseName(i.title), i]));

  // 已經有途經點的行程不補 gpx 點位 —— 手工填的那份比來源的兩三個點完整得多
  const withWaypoints = new Set<string>();
  if (existing.length > 0) {
    const ids = existing.map((i) => i.id).join(",");
    const rows = (await db(`route_waypoints?select=itinerary_item_id&itinerary_item_id=in.(${ids})`)) as { itinerary_item_id: string }[];
    for (const r of rows) withWaypoints.add(r.itinerary_item_id);
  }

  const maxSort = Math.max(0, ...existing.map((i) => i.sort_order ?? 0));
  let created = 0, merged = 0, waypointsAdded = 0, sort = maxSort;

  for (const record of records) {
    const name = str(record.name);
    if (!name) continue;
    const profile = normalize(record);
    const match = byName.get(baseName(name));
    const location = profile.location.zh ?? profile.location.en;

    if (match) {
      merged++;
      console.log(`合併  ${name}`);
      if (match.title !== name) console.log(`        標題 "${match.title}" → "${name}"`);
      if (match.category !== "outdoor") console.log(`        類型 ${match.category} → outdoor`);
      if (apply) {
        await db(`itinerary_items?id=eq.${match.id}`, {
          method: "PATCH",
          // notes 與日期刻意不動：既有的備註是人寫的，日期是人排的
          body: JSON.stringify({ title: name, category: "outdoor", location, route_profile: profile }),
        });
      }
    } else {
      created++;
      sort++;
      console.log(`新增  ${name}  (${profile.grading?.raw ?? "無分級"})`);
      if (apply) {
        const inserted = (await db("itinerary_items", {
          method: "POST",
          body: JSON.stringify({
            trip_id: trip.id,
            user_id: trip.user_id,
            date: TARGET_DATE,
            sort_order: sort,
            title: name,
            category: "outdoor",
            location,
            route_profile: profile,
          }),
        })) as ItineraryRow[];
        byName.set(baseName(name), inserted[0]);
      }
    }

    // 途經點：只在這條路線還沒有任何點位時才補
    const target = byName.get(baseName(name));
    const gpx = arr(record.gpx_waypoints);
    if (gpx.length === 0) continue;
    if (target && withWaypoints.has(target.id)) {
      console.log(`        已有途經點，跳過 ${gpx.length} 個 gpx 點位`);
      continue;
    }
    const rows = gpx
      .map((w, i) => ({
        order_index: (num(w.seq) ?? i + 1) - 1,
        name: str(w.name) ?? `點位 ${i + 1}`,
        notes: str(w.detail),
        lat: num(w.lat),
        lng: num(w.lon),
        type: waypointType(str(w.name) ?? ""),
      }))
      .sort((a, b) => a.order_index - b.order_index);
    waypointsAdded += rows.length;
    console.log(`        + ${rows.length} 個途經點`);
    if (apply && target) {
      await db("route_waypoints", {
        method: "POST",
        body: JSON.stringify(rows.map((r) => ({ ...r, itinerary_item_id: target.id }))),
      });
    }
  }

  console.log(`\n新增 ${created} 筆、合併 ${merged} 筆、途經點 ${waypointsAdded} 個`);
  if (!apply) console.log("（預演，沒有寫入。加上 --apply 才會真的寫）");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
