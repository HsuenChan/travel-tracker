import { GoogleGenerativeAI } from "@google/generative-ai";
import { retryTransient, trackGemini, type TrackMeta } from "@/lib/aiUsage";
import type { ScrapedPost } from "@/lib/instagramScrape";

/**
 * 從社群貼文裡抽出「可以存進旅程的東西」。
 *
 * 只靠 IG 的地點標籤不夠：它常常只到城市（「Florence, Italy」），而真正想存的那個點
 * 寫在內文裡（「Piazza del Duomo」）。所以標籤當背景、內文當來源，兩個一起給。
 *
 * 地點之外還要 digest：交通、購票這種攻略型貼文根本沒有地點可抽，只回空陣列的話
 * 這則貼文就沒有出路了 —— digest 讓它至少能進旅遊筆記。
 */

const PROMPT = `You extract travel information from a social media post so it can be saved into a trip planner.

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "places": [
    {
      "name": "Specific place name as a traveller would search for it. Keep the local-language name and add a Chinese name when there is a well-known one, e.g. 'Piazza del Duomo 主教堂廣場'",
      "city": "City or area, empty string if unknown",
      "country": "Country in Chinese, empty string if unknown",
      "address": "The street address exactly as the post writes it, in its original language and script",
      "mapUrl": "A map link from the post that belongs to this place, empty string if none",
      "kind": "place | souvenir",
      "category": "food | attraction | shopping | hotel | activity | outdoor | other",
      "note": "What the post actually tells you about this place, in Chinese. Keep the practical detail: where to buy tickets, when to go, prices, queues, how to get there, what to order, what to watch out for. Keep numbers, site names and times exactly as given. Several lines when the post gives several — separate them with \\n. Empty string only when the post says nothing beyond naming the place."
    }
  ],
  "digest": {
    "heading": "A short Chinese title for this post, as it would read as a heading in a travel notebook, e.g. '東京地鐵購票攻略'",
    "lines": ["One practical point per line, in Chinese"]
  }
}

Rules for places:
- Only places a traveller could go to. Skip countries and regions that are just context.
- The location tag is usually the city, not the place. Prefer a specific venue named in the caption; fall back to the tag only when the caption names nothing.
- Several places is normal for a list-style post. Keep the order they appear in.
- No place at all is a valid answer: return "places": []. Do not invent one to be helpful.
- Do not copy hashtags in as places.
- note is what the post claims, not your own description. Do not summarise a how-to into a slogan: a post explaining how to get tickets should come out with the steps, not the words "buy early".
- Leave out the poster's self-promotion, follow-me lines and hashtags.

Rules for address — read these twice, a wrong address is worse than no address:
- address is a transcription, not a lookup. Copy it only when the post literally spells one out.
- Never build an address from the place name. Never guess a street or a number. Never put a bare city, region or country in address — those belong in city and country.
- Keep it in the language and script the post used. Do not translate or reorder it.
- Empty string whenever the post does not write one out. An empty address is the correct answer most of the time.
- mapUrl is a link that is actually present in the post. Empty string when the post has no link, and also when the post has one link but several places and you cannot tell which place it points at.

Rules for kind:
- "souvenir" is a thing you buy and carry home: a snack, a bottle, a cosmetic, a piece of merchandise.
- "place" is somewhere you go — including the shop or market that sells the souvenir.
- When a post names both the shop and what to buy there, the shop is a place and each product is a souvenir.
- When in doubt, "place".

Rules for digest:
- Write it for every post, even one that is full of places: it is what gets saved into the trip's notebook.
- lines carry the post's practical content — routes, tickets, opening hours, prices, warnings, what to book ahead. Keep numbers, station names, prices and times exactly as given.
- Do not pad it with the poster's opinions or feelings, and do not repeat the same point twice.
- "lines": [] only when the post says nothing practical at all.

Write every Chinese string in Traditional Chinese as used in Taiwan. Say 貼文 not 帖子, 影片 not 视频, 餐廳 not 饭店.`;

export interface ParsedPlace {
  name: string;
  city?: string;
  country?: string;
  category?: string;
  note?: string;
  /** 貼文裡明寫的地址。AI 抄不到就是空的 —— 讓它自己生一個只會得到似是而非的門牌 */
  address?: string;
  /** 貼文裡出現、對得上這個地點的地圖連結 */
  mapUrl?: string;
  kind?: "place" | "souvenir";
  /** 地址從哪來，UI 要標給使用者看。不是 AI 給的，是 lib/placeAddress.ts 補的，manual 是使用者當場改的 */
  addressSource?: "post" | "map" | "lookup" | "manual";
}

export interface PostDigest {
  heading: string;
  lines: string[];
}

export interface ParsedPost {
  places: ParsedPlace[];
  digest: PostDigest | null;
}

function sourceText(post: ScrapedPost): string {
  return [
    post.locationName ? `Location tag: ${post.locationName}` : null,
    post.ownerUsername ? `Posted by: @${post.ownerUsername}` : null,
    post.hashtags.length ? `Hashtags: ${post.hashtags.join(", ")}` : null,
    "",
    "Caption:",
    post.caption || "(empty)",
  ].filter((l) => l !== null).join("\n");
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toDigest(value: unknown): PostDigest | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { heading?: unknown; lines?: unknown };
  const lines = Array.isArray(raw.lines) ? raw.lines.map(str).filter(Boolean) : [];
  if (lines.length === 0) return null;
  return { heading: str(raw.heading) || "貼文重點", lines };
}

export async function parsePost(
  post: ScrapedPost,
  meta: Omit<TrackMeta, "model">
): Promise<ParsedPost | null> {
  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: modelName });

  const result = await retryTransient(() =>
    trackGemini({ ...meta, model: modelName }, () =>
      model.generateContent([PROMPT, sourceText(post)])
    )
  );
  const raw = result.response.text().trim()
    .replace(/^```json\s*/i, "").replace(/```\s*$/, "");

  try {
    const parsed = JSON.parse(raw) as { places?: ParsedPlace[]; digest?: unknown };
    const places = Array.isArray(parsed.places) ? parsed.places : [];
    return {
      places: places
        .filter((p) => str(p?.name).length > 0)
        .map((p) => ({
          ...p,
          name: str(p.name),
          address: str(p.address) || undefined,
          mapUrl: str(p.mapUrl) || undefined,
          kind: p.kind === "souvenir" ? "souvenir" : "place",
        })),
      digest: toDigest(parsed.digest),
    };
  } catch {
    return null;
  }
}
