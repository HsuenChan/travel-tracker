/**
 * 從一則 Threads 貼文取回內文。
 *
 * 這條不走 Apify：Threads 的貼文頁對 crawler 的 UA 會 server-side 吐出完整的 og 標籤，
 * og:description 就是整篇內文，不是截斷的摘要 —— 一次 fetch、一秒多就拿得到。
 * 關鍵在 UA：用一般瀏覽器的 UA 拿回來的跟 IG 一樣是個 JS 空殼，連 <title> 都只有 "Threads"。
 */

import { cleanShareUrl } from "@/lib/sharedLink";
import type { ScrapedPost, ScrapeFailure } from "@/lib/instagramScrape";

/** Meta 自家的連結預覽 crawler。og 標籤本來就是為它準備的，所以就報它的名字 */
const CRAWLER_UA = "facebookexternalhit/1.1";

/** 實測 1～2 秒。這條路快，拖到十秒就是真的不對勁了，不需要像 Apify 那樣給 45 秒 */
const TIMEOUT_MS = 10_000;

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // &amp; 一定要放最後：先解的話 &amp;lt; 會被解成 <
    .replace(/&amp;/g, "&");
}

function ogContent(html: string, property: string): string | null {
  const match =
    html.match(new RegExp(`<meta[^>]+property="${property}"[^>]*content="([^"]*)"`, "i")) ??
    html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]*property="${property}"`, "i"));
  const value = match ? decodeEntities(match[1]).trim() : "";
  return value || null;
}

/** og:title 長這樣：「日本自助旅遊中毒者 林氏璧 (@linshibi) on Threads」 */
function ownerFrom(title: string | null): string | null {
  return title?.match(/\(@([A-Za-z0-9._]+)\)/)?.[1] ?? null;
}

function hashtagsFrom(caption: string): string[] {
  return [...caption.matchAll(/#([^\s#]+)/g)].map((m) => m[1]);
}

export async function scrapeThreads(
  url: string
): Promise<{ post: ScrapedPost } | { failure: ScrapeFailure; detail?: string }> {
  const clean = cleanShareUrl(url);

  let res: Response;
  try {
    res = await fetch(clean, {
      headers: { "User-Agent": CRAWLER_UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return { failure: timedOut ? "timeout" : "error", detail: String(err).slice(0, 200) };
  }

  if (!res.ok) return { failure: res.status === 404 ? "not_found" : "error", detail: `${res.status}` };

  const html = await res.text();
  const caption = ogContent(html, "og:description");
  // 貼文被刪、設為私人，或 Meta 那端沒認這個 UA 時，回來的是一個沒有 og 標籤的空殼
  if (!caption) return { failure: "not_found" };

  return {
    post: {
      url: clean,
      caption,
      hashtags: hashtagsFrom(caption),
      // Threads 沒有地點標籤這個東西，地點只能從內文讀出來
      locationName: null,
      ownerUsername: ownerFrom(ogContent(html, "og:title")),
      /*
        不給圖：Threads 的 og:image 是系統生成的貼文截圖卡 —— 上面是帳號、內文文字和
        threads 標誌，不是貼文裡的照片。那張圖當旅程卡片封面，存下來的就是一張截圖。
      */
      imageUrl: null,
    },
  };
}
