/**
 * 從一個 IG 連結取回內文與地點標籤。
 *
 * IG 的貼文頁對未登入的請求只回一個 JS 空殼，連 og: 標籤都沒有，官方 oEmbed 又要 Meta 開發者
 * 審核。所以這裡走第三方抓取服務 —— 市面上把 reel 存成地圖的 App 用的都是同一條路。
 */

import { cleanShareUrl } from "@/lib/sharedLink";

const ENDPOINT =
  "https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items";

/**
 * 實測 11～17 秒，變異幅度不小。抓得太緊會把正常的請求砍掉（一開始設 12 秒就是這樣）。
 * 45 秒留在 route 的 maxDuration=60 之內，超過就真的是卡住了，退回手動輸入比較快。
 */
const TIMEOUT_MS = 45_000;

export interface ScrapedPost {
  url: string;
  caption: string;
  hashtags: string[];
  /** IG 的地點標籤。有標的話這是最可信的一欄，比從內文猜準得多 */
  locationName: string | null;
  ownerUsername: string | null;
}

export type ScrapeFailure = "no_token" | "timeout" | "not_found" | "error";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export async function scrapeInstagram(
  url: string
): Promise<{ post: ScrapedPost } | { failure: ScrapeFailure; detail?: string }> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { failure: "no_token" };

  const clean = cleanShareUrl(url);

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resultsType: "posts",
        directUrls: [clean],
        resultsLimit: 1,
        addParentData: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return { failure: timedOut ? "timeout" : "error", detail: String(err).slice(0, 200) };
  }

  if (!res.ok) return { failure: "error", detail: `${res.status} ${(await res.text()).slice(0, 200)}` };

  const items = (await res.json().catch(() => null)) as Record<string, unknown>[] | null;
  const first = Array.isArray(items) ? items[0] : null;
  if (!first) return { failure: "not_found" };

  // 貼文被刪、設為私人或網址打錯時，actor 會回一筆帶 error 的資料而不是空陣列
  if (typeof first.error === "string") return { failure: "not_found", detail: first.error.slice(0, 200) };

  const caption = typeof first.caption === "string" ? first.caption : "";
  const locationName = typeof first.locationName === "string" && first.locationName.trim()
    ? first.locationName.trim()
    : null;

  return {
    post: {
      url: clean,
      caption,
      hashtags: asStringArray(first.hashtags),
      locationName,
      ownerUsername: typeof first.ownerUsername === "string" ? first.ownerUsername : null,
    },
  };
}
