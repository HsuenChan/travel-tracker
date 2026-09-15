/**
 * 把塞進 anchor_note 的長說明拆到 notes。
 *
 *   node scripts/split-anchor-notes.ts            # 預演
 *   node scripts/split-anchor-notes.ts --apply
 *
 * 縱剖面圖上，錨點註記是畫在標籤正下方那一行小字，只放得下官方 topo 的短代號
 * （`TR X X`）。轉寫時我把「首位使用浮動固定點避開 pour over」這種整句說明也寫了進去，
 * 結果相鄰標籤互相疊住，整段變成看不懂的一團。
 *
 * 說明本身有價值，所以不是刪掉而是搬到 notes —— 那會顯示在途經點清單裡，有空間讀。
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

/** 圖上放得下的長度，與 RouteTopoProfile 的 MAX_ANCHOR_NOTE 同一個數字 */
const MAX = 18;

/**
 * 「TL X · 首位使用浮動固定點…」→ 代號 'TL X' ＋ 說明其餘。
 * 沒有分隔點、整串又過長的，代表它根本不是代號，全部搬去 notes。
 */
function split(note: string): { anchor: string | null; moved: string | null } {
  const t = note.trim();
  if ([...t].length <= MAX) return { anchor: t, moved: null };
  const parts = t.split("·").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1 && [...parts[0]].length <= MAX) {
    return { anchor: parts[0], moved: parts.slice(1).join(" · ") };
  }
  return { anchor: null, moved: t };
}

interface Row { id: string; name: string; anchor_note: string | null; notes: string | null }

async function main() {
  const items = (await db(`itinerary_items?select=id&trip_id=eq.958c13ca-d77a-430f-b6c0-4ebe014f77c9&category=eq.outdoor`)) as { id: string }[];
  const ids = items.map((i) => i.id).join(",");
  const rows = (await db(`route_waypoints?select=id,name,anchor_note,notes&itinerary_item_id=in.(${ids})&anchor_note=not.is.null`)) as Row[];

  let changed = 0;
  for (const row of rows) {
    const { anchor, moved } = split(row.anchor_note ?? "");
    if (!moved) continue;
    changed++;
    const notes = [row.notes?.trim(), moved].filter(Boolean).join("\n");
    console.log(`  ${row.name}`);
    console.log(`     錨點 → ${anchor ?? "（清空）"}`);
    console.log(`     搬到備註 → ${moved.slice(0, 60)}${moved.length > 60 ? "…" : ""}`);
    if (apply) {
      await db(`route_waypoints?id=eq.${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ anchor_note: anchor, notes }),
      });
    }
  }
  console.log(`\n共 ${rows.length} 筆有錨點註記，其中 ${changed} 筆過長需要拆開`);
  if (!apply) console.log("（預演，沒有寫入）");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
