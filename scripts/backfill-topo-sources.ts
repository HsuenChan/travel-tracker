/**
 * 把翻出來的官方 topo 來源寫回 route_profile。
 *
 *   node scripts/backfill-topo-sources.ts            # 預演
 *   node scripts/backfill-topo-sources.ts --apply
 *
 * 這三條的 topo 不在 PocketBase 的 topo_url 欄位裡（Wesley、Barrack 根本是空的），
 * 是從 kiwicanyons 路線頁與 Box 分享連結翻出來的。不寫回去的話，畫面上只有我
 * 重繪的縱剖面，讀圖的人沒辦法回頭核對官方原圖 —— 而落差數字是我讀圖得到的，
 * 能回溯原圖這件事本身就是資料的一部分。
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

interface TopoPage { page: number | null; zh: string | null; en: string | null; asset: string | null }

/** 只有絕對網址畫面才載得到，相對路徑會被濾掉（見 lib/routeProfile.ts） */
const SOURCES: Record<string, { topo_url?: string; pages?: TopoPage[] }> = {
  "Wesley Creek": {
    pages: [{ page: 2, zh: "路線圖（手繪）", en: "Topo", asset: "https://www.kiwicanyons.org/wp-content/uploads/2020/04/image-2.png" }],
  },
  "Barrack Creek": {
    // Box 的分享頁，人點得開；直接下載網址帶 file_id，不適合放在畫面上
    topo_url: "https://app.box.com/s/g2dsbavcrdpz026zxq2vlt1flscx0im0",
  },
  "Edwards River": {
    // topo_pages 的 asset 本來就是絕對網址，這裡只補上原圖頁連結
    topo_url: "https://www.kiwicanyons.org/wp-content/uploads/2020/04/Edwards-Jan-2026-scaled.jpg",
  },
};

interface Item { id: string; title: string; route_profile: Record<string, unknown> | null }

async function main() {
  for (const [title, src] of Object.entries(SOURCES)) {
    const items = (await db(`itinerary_items?select=id,title,route_profile&title=eq.${encodeURIComponent(title)}`)) as Item[];
    if (items.length === 0) { console.log(`略過  ${title}（找不到行程）`); continue; }
    const item = items[0];
    const profile = { ...(item.route_profile ?? {}) } as Record<string, unknown>;

    const before = { topo_url: profile.topo_url, pages: (profile.topo_pages as TopoPage[] | undefined)?.length ?? 0 };
    if (src.topo_url && !profile.topo_url) profile.topo_url = src.topo_url;
    if (src.pages) {
      const existing = (profile.topo_pages as TopoPage[] | undefined) ?? [];
      // 同一張圖已經在就不重複加
      const have = new Set(existing.map((p) => p.asset));
      profile.topo_pages = [...existing, ...src.pages.filter((p) => !have.has(p.asset))];
    }
    const after = { topo_url: profile.topo_url, pages: (profile.topo_pages as TopoPage[]).length };
    if (before.topo_url === after.topo_url && before.pages === after.pages) {
      console.log(`略過  ${title}（已經有了）`);
      continue;
    }
    console.log(`更新  ${title}`);
    if (before.topo_url !== after.topo_url) console.log(`        topo_url → ${after.topo_url}`);
    if (before.pages !== after.pages) console.log(`        topo_pages ${before.pages} → ${after.pages} 頁`);
    if (apply) {
      await db(`itinerary_items?id=eq.${item.id}`, { method: "PATCH", body: JSON.stringify({ route_profile: profile }) });
    }
  }
  if (!apply) console.log("\n（預演，沒有寫入）");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
