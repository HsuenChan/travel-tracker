/**
 * 從系統分享收到的東西。
 *
 * Android 的分享是一坨自由文字：有些 App 只給網址，有些把說明和網址放在同一個 text 裡，
 * 有些填 url 欄位、有些不填。所以這裡不預設哪個欄位有值，三個欄位一起找。
 */

export type ShareSource = "instagram" | "threads" | "googlemaps" | "other";

export interface SharePayload {
  title: string | null;
  text: string | null;
  url: string | null;
}

export interface ParsedShare {
  source: ShareSource;
  /** 抽出來的第一個網址 */
  link: string | null;
  /** 去掉網址之後剩下的文字，之後要拿來猜地點名稱 */
  note: string;
}

const URL_RE = /https?:\/\/[^\s]+/;

/**
 * 去掉分享網址上的追蹤參數。
 *
 * IG 分享會帶 ?stkn=、?igsh= 之類，那些對誰都沒用而且每次分享都不一樣 —— 不清掉的話，
 * 同一則貼文分享兩次會被當成兩個不同的連結。
 */
export function cleanShareUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    return `${u.origin}${u.pathname}`.replace(/\/+$/, "");
  } catch {
    return raw.trim();
  }
}

export function sourceOf(link: string | null): ShareSource {
  if (!link) return "other";
  if (/(^|\.)instagram\.com/i.test(link)) return "instagram";
  if (/(^|\.)threads\.(net|com)/i.test(link)) return "threads";
  if (/(^|\.)(google\.[a-z.]+\/maps|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl)/i.test(link)) {
    return "googlemaps";
  }
  return "other";
}

export function parseShare(payload: SharePayload): ParsedShare {
  const fields = [payload.url, payload.text, payload.title];
  const found = fields.map((f) => f?.match(URL_RE)?.[0] ?? null).find(Boolean) ?? null;
  const link = found ? cleanShareUrl(found) : null;

  // 網址之外的文字才可能有地點名稱；標題與內文都留著，之後由使用者或 AI 挑
  const note = [payload.title, payload.text]
    .filter(Boolean)
    .map((f) => (f as string).replace(URL_RE, "").trim())
    .filter(Boolean)
    .join("\n");

  return { source: sourceOf(link), link, note };
}

export const SOURCE_LABEL: Record<ShareSource, string> = {
  instagram: "Instagram",
  threads: "Threads",
  googlemaps: "Google 地圖",
  other: "其他",
};
