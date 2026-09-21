import { getCountryCodes } from "@/lib/countries";
import type { ParsedPlace } from "@/lib/placeParser";

/**
 * 幫 AI 抽出來的地點補上地址。
 *
 * 分享進來的東西最後要填進行程的「地點」欄位，而那一欄先前永遠是空的 —— 舊版只把
 * 「Rome、義大利」寫進備註，既不精確、也不在該在的位置。
 *
 * 三層來源由準到不準：貼文裡的地圖連結 > 貼文明寫的地址 > Nominatim 反查。
 * 反查那層一定要守門，查到同名的另一個城市比留空更糟。
 */

/*
  網址的尾巴只收 URL 合法字元，不能用 \S* —— 中文貼文常常「連結後面直接接字」不留空格，
  \S* 會把那串中文一起吃進來，存進地址欄就是一個打不開的連結。
*/
const MAP_URL_RE =
  /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[a-z.]+|(?:www\.)?google\.[a-z.]+\/maps)[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]*/gi;

/** Nominatim 明文限 1 req/s，多個地點只能排隊走 */
const LOOKUP_GAP_MS = 1100;

/** 反查最多做幾個。再多就會吃掉 route 的 60 秒，而使用者正盯著進度等 */
const LOOKUP_LIMIT = 6;

/** 貼文的連結尾巴常常黏著句號或全形括號，跟著存進去連結就打不開了 */
function trimTail(url: string): string {
  return url.replace(/[.,;:!?)\]}、，。；：！？）］｝】》」』]+$/, "");
}

export function mapLinksIn(text: string): string[] {
  const found = text.match(MAP_URL_RE) ?? [];
  return Array.from(new Set(found.map(trimTail)));
}

interface NominatimHit {
  display_name?: string;
  address?: { country_code?: string };
}

async function lookup(query: string): Promise<{ address: string; countryCode: string | null } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "travel-tracker/1.0 (github.com/HsuenChan/travel-tracker)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimHit[];
    const hit = Array.isArray(data) ? data[0] : null;
    const address = typeof hit?.display_name === "string" ? hit.display_name.trim() : "";
    if (!address) return null;
    return { address, countryCode: hit?.address?.country_code?.toUpperCase() ?? null };
  } catch {
    return null;
  }
}

/*
  查詢只帶名稱與城市，不帶國家 —— AI 給的國家是中文（「義大利」），混進以當地語言為主的
  查詢字串裡只會讓 Nominatim 更難命中。國家改當守門用：對不上就整筆丟掉。
*/
function queryFor(place: ParsedPlace): string {
  return [place.name, place.city].map((s) => s?.trim()).filter(Boolean).join(", ");
}

function countryAgrees(place: ParsedPlace, code: string | null): boolean {
  const wanted = getCountryCodes(place.country ?? "");
  // AI 沒說國家、或查到的那筆沒有國碼，就沒東西可比對。這種只能相信，所以 UI 要標出是查來的
  if (wanted.length === 0 || !code) return true;
  return wanted.includes(code);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 依序補上每個地點的 address 與 addressSource。補不到就維持空的 —— 那一欄寧可空著。
 */
export async function fillAddresses(places: ParsedPlace[], caption: string): Promise<ParsedPlace[]> {
  const links = mapLinksIn(caption);
  const filled: ParsedPlace[] = [];
  let lookups = 0;

  for (const place of places) {
    const fromMap =
      place.mapUrl?.startsWith("http")
        ? place.mapUrl
        // 只有一個地點、貼文也只貼了一條地圖連結時，那條就是它的 —— 不用 AI 配對也不會錯
        : places.length === 1 && links.length === 1
          ? links[0]
          : undefined;

    if (fromMap) {
      filled.push({ ...place, address: fromMap, addressSource: "map" });
      continue;
    }
    if (place.address) {
      filled.push({ ...place, addressSource: "post" });
      continue;
    }

    // 伴手禮是商品不是地點，拿「白色戀人」去查地圖只會撈到不相干的東西
    const query = place.kind === "souvenir" ? "" : queryFor(place);
    if (!query || lookups >= LOOKUP_LIMIT) {
      filled.push(place);
      continue;
    }

    if (lookups > 0) await sleep(LOOKUP_GAP_MS);
    lookups += 1;
    const hit = await lookup(query);
    if (hit && countryAgrees(place, hit.countryCode)) {
      filled.push({ ...place, address: hit.address, addressSource: "lookup" });
    } else {
      filled.push(place);
    }
  }

  return filled;
}
