/**
 * 依現有途經點重算所有戶外路段的里程／爬升／下降。
 *
 *   node scripts/recompute-outdoor-stats.ts            # 預演
 *   node scripts/recompute-outdoor-stats.ts --apply
 *
 * 匯入途經點時我是直接寫 PostgREST，繞過了 /api/itinerary/waypoints，
 * 所以 deriveWaypointStats 從來沒跑過，卡片上的三個數字全是空的。
 *
 * 溪降路線算完多半仍是空的 —— CanyonTopo 給的是落差不是累積距離，沒有距離就算不出
 * 里程，沒有海拔就算不出爬升。那是對的，不是壞掉。
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { deriveWaypointStats } from "../lib/waypointStats.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apply = process.argv.includes("--apply");

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = loadEnv();

async function db(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json", Prefer: "return=representation",
      ...init.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

interface Item {
  id: string;
  title: string;
  distance_km: number | null;
  ascent_m: number | null;
  descent_m: number | null;
  route_waypoints: { elevation_m: number | null; distance_km: number | null; order_index: number }[];
}

const fmt = (v: number | null) => (v === null ? "—" : String(v));

async function main() {
  const items = (await db(
    "itinerary_items?select=id,title,distance_km,ascent_m,descent_m,route_waypoints(elevation_m,distance_km,order_index)&category=eq.outdoor"
  )) as Item[];

  let changed = 0;
  for (const item of items.sort((a, b) => a.title.localeCompare(b.title))) {
    const rows = [...item.route_waypoints].sort((a, b) => a.order_index - b.order_index);
    const stats = deriveWaypointStats(rows);
    const same =
      stats.distance_km === item.distance_km &&
      stats.ascent_m === item.ascent_m &&
      stats.descent_m === item.descent_m;
    if (same) continue;
    changed++;
    console.log(
      `  ${item.title.padEnd(24)} ` +
      `里程 ${fmt(item.distance_km)} → ${fmt(stats.distance_km)}   ` +
      `爬升 ${fmt(item.ascent_m)} → ${fmt(stats.ascent_m)}   ` +
      `下降 ${fmt(item.descent_m)} → ${fmt(stats.descent_m)}`
    );
    if (apply) {
      await db(`itinerary_items?id=eq.${item.id}`, { method: "PATCH", body: JSON.stringify(stats) });
    }
  }
  console.log(`\n共 ${items.length} 個戶外路段，${changed} 個需要更新`);
  if (!apply) console.log("（預演，沒有寫入）");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
