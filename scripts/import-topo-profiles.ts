/**
 * 把人工從官方 CanyonTopo 抄錄的障礙序列匯入 route_waypoints，讓縱剖面圖畫得出來。
 *
 *   node scripts/import-topo-profiles.ts            # 預演
 *   node scripts/import-topo-profiles.ts --apply
 *
 * 需要先跑過 supabase/18_waypoint_topo.sql。
 *
 * 兩種處理方式：
 *   append   這條路線資料庫裡只有進場的 GPS 點，障礙序列整段接在後面
 *   backfill 這條路線已經有完整的障礙序列（人工填過，比抄錄版更詳細），
 *            只補上落水潭與錨點註記，絕不覆蓋既有的名稱與備註
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
const SUPABASE_URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function db(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json", Prefer: "return=representation",
      ...init.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

/* ------------------------------------------------------------ 抄錄資料的形狀 */

/** demo 的障礙種類 → 本專案的途經點類型 */
const KIND_TO_TYPE: Record<string, string | null> = {
  R: "rappel", J: "jump", S: "slide", DC: "downclimb", UC: "upclimb", HL: "anchor", N: null,
};
const POOL_MAP: Record<string, string> = { u: "unknown", s: "shallow", d: "deep", h: "hydraulic" };

interface Feature { k: string; l: string; d?: number; pool?: string; an?: string }
interface Section { nm: string; f: Feature[] }

/** 沒有類型的註記再依文字分類，危險與脫逃是現場最該看到的兩種 */
function noteType(label: string): string | null {
  if (/逃生|脫逃|escape/i.test(label)) return "exit";
  if (/注意|危險|undercut|sieve|!/.test(label)) return "hazard";
  if (/pool|潭/i.test(label)) return "pool";
  return null;
}

function toRows(sections: Section[], itemId: string, startIndex: number) {
  const rows: Record<string, unknown>[] = [];
  let i = startIndex;
  for (const sec of sections) {
    for (const f of sec.f) {
      const type = f.k === "N" ? noteType(f.l) : KIND_TO_TYPE[f.k] ?? null;
      rows.push({
        itinerary_item_id: itemId,
        order_index: i++,
        name: f.l,
        drop_m: f.d && f.d > 0 ? f.d : null,
        type,
        pool_type: f.pool ? POOL_MAP[f.pool] ?? "unknown" : null,
        anchor_note: f.an ?? null,
        section: sec.nm,
        day_offset: 0,
      });
    }
  }
  return rows;
}

/* ------------------------------------------------------------ Wilson 的回填對照 */

/**
 * 資料庫裡的 Wilson 是人工填的完整版（含進場，30 筆），比抄錄版更詳細，所以只補欄位。
 * 用明確對照而不是模糊比對 —— 兩份抄錄的命名不同（'R7 10m（或跳水）' vs 'R7 或 J 10m'），
 * 交給字串相似度去猜，猜錯就是把「危險迴流」標到別的潭上。
 */
const WILSON_BACKFILL: Record<string, { pool?: string; anchor?: string; section: string }> = {
  "入溪點":                              { section: "入溪 → A" },
  "R1 8m":                               { pool: "deep", anchor: "TR X X", section: "入溪 → A" },
  "DC 3m":                               { pool: "hydraulic", section: "入溪 → A" },
  "R2 17m":                              { pool: "deep", anchor: "TL X X", section: "入溪 → A" },
  "DC 1m":                               { pool: "shallow", section: "入溪 → A" },
  "HL 8m（極高水位替代路線）":            { anchor: "TR X X · X · X X", section: "入溪 → A" },
  "R3 10m（可跳 3m）":                   { pool: "hydraulic", section: "入溪 → A" },
  "The Julie Pool":                      { pool: "hydraulic", section: "A → B" },
  "The rock fall（避洪處 · 唯一可能脫逃點）": { section: "A → B" },
  "R4 12m":                              { pool: "deep", anchor: "TR X X", section: "A → B" },
  "J 5m":                                { anchor: "替代路線", section: "A → B" },
  "R5 6m":                               { pool: "hydraulic", anchor: "TR XX", section: "A → B" },
  "The Boil":                            { pool: "hydraulic", section: "A → B" },
  "Star Wars Alley":                     { section: "A → B" },
  "R6 9m":                               { pool: "shallow", anchor: "TR X X", section: "A → B" },
  "The Zig Zag":                         { section: "A → B" },
  "R7 10m（或跳水）":                    { pool: "deep", anchor: "TR XX", section: "B → 出溪" },
  "The Blue Pot":                        { section: "B → 出溪" },
  "DC 2m":                               { pool: "shallow", section: "B → 出溪" },
  "J 3m":                                { pool: "deep", section: "B → 出溪" },
  "R8 4m":                               { anchor: "TL X X", section: "B → 出溪" },
  "R9 12m":                              { anchor: "TL X X", section: "B → 出溪" },
  "DC 6m":                               { pool: "deep", section: "B → 出溪" },
  "出溪點 · 回到橋":                      { section: "B → 出溪" },
};

/* ------------------------------------------------------------ main */

interface Item { id: string; title: string }

async function main() {
  const demo = JSON.parse(readFileSync(join(root, "scripts/data/nz-topo-profiles.json"), "utf8")) as Record<string, Section[]>;

  const append: [string, string][] = [
    ["Mather Creek", "MATHER_TOPO"],
    ["Cross Creek", "CROSS_TOPO"],
    ["Whio Creek", "WHIO_TOPO"],
    ["Major Mayhem Canyon", "MAYHEM_TOPO"],
  ];

  // 逐條讀官方 topo 轉寫的那份，key 直接就是行程標題
  const transcribed = JSON.parse(readFileSync(join(root, "scripts/data/nz-topo-transcribed.json"), "utf8")) as Record<string, { sections?: Section[] }>;
  for (const [title, entry] of Object.entries(transcribed)) {
    // 底線開頭的是說明用的欄位，不是路線
    if (title.startsWith("_") || !entry.sections) continue;
    const key = `transcribed:${title}`;
    demo[key] = entry.sections;
    append.push([title, key]);
  }

  for (const [title, key] of append) {
    const items = (await db(`itinerary_items?select=id,title&title=eq.${encodeURIComponent(title)}`)) as Item[];
    if (items.length === 0) { console.log(`略過  ${title}（找不到行程）`); continue; }
    const item = items[0];
    const existing = (await db(`route_waypoints?select=order_index,name,drop_m&itinerary_item_id=eq.${item.id}&order=order_index`)) as { order_index: number; name: string; drop_m: number | null }[];
    // 已經有落差資料就代表障礙序列填過了，再接一份會變成整條溪走兩遍
    if (existing.some((w) => w.drop_m != null)) {
      console.log(`略過  ${title}（已有障礙序列 ${existing.length} 筆）`);
      continue;
    }
    const start = existing.length === 0 ? 0 : Math.max(...existing.map((w) => w.order_index)) + 1;
    const rows = toRows(demo[key], item.id, start);
    console.log(`接上  ${title}：既有 ${existing.length} 個進場點 → 追加 ${rows.length} 個障礙`);
    if (apply) await db("route_waypoints", { method: "POST", body: JSON.stringify(rows) });
  }

  // Wilson：只補欄位
  const wilson = (await db(`itinerary_items?select=id,title&title=eq.Wilson%20Creek`)) as Item[];
  if (wilson.length > 0) {
    const rows = (await db(`route_waypoints?select=id,name,pool_type,anchor_note,section&itinerary_item_id=eq.${wilson[0].id}&order=order_index`)) as
      { id: string; name: string; pool_type: string | null; anchor_note: string | null; section: string | null }[];
    let touched = 0, unmatched: string[] = [];
    for (const row of rows) {
      const fill = WILSON_BACKFILL[row.name];
      if (!fill) { unmatched.push(row.name); continue; }
      const patch: Record<string, unknown> = {};
      if (fill.pool && !row.pool_type) patch.pool_type = fill.pool;
      if (fill.anchor && !row.anchor_note) patch.anchor_note = fill.anchor;
      if (!row.section) patch.section = fill.section;
      if (Object.keys(patch).length === 0) continue;
      touched++;
      if (apply) await db(`route_waypoints?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    }
    console.log(`回填  Wilson Creek：${touched} 筆補上落水潭／錨點／分段`);
    if (unmatched.length) console.log(`        未對照（維持原樣，多為進場點）：${unmatched.join("、")}`);
  }

  if (!apply) console.log("\n（預演，沒有寫入。加上 --apply 才會真的寫）");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
