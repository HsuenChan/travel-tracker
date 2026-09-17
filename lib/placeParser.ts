import { GoogleGenerativeAI } from "@google/generative-ai";
import { retryTransient, trackGemini, type TrackMeta } from "@/lib/aiUsage";
import type { ScrapedPost } from "@/lib/instagramScrape";

/**
 * 從社群貼文裡抽出「可以存進口袋名單的地點」。
 *
 * 只靠 IG 的地點標籤不夠：它常常只到城市（「Florence, Italy」），而真正想存的那個點
 * 寫在內文裡（「Piazza del Duomo」）。所以標籤當背景、內文當來源，兩個一起給。
 */

const PROMPT = `You extract travel places from a social media post so they can be saved to a trip wishlist.

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "places": [
    {
      "name": "Specific place name as a traveller would search for it. Keep the local-language name and add a Chinese name when there is a well-known one, e.g. 'Piazza del Duomo 主教堂廣場'",
      "city": "City or area, empty string if unknown",
      "country": "Country in Chinese, empty string if unknown",
      "category": "food | attraction | shopping | hotel | activity | outdoor | other",
      "note": "What the post actually tells you about this place, in Chinese. Keep the practical detail: where to buy tickets, when to go, prices, queues, how to get there, what to order, what to watch out for. Keep numbers, site names and times exactly as given. Several lines when the post gives several — separate them with \\n. Empty string only when the post says nothing beyond naming the place."
    }
  ]
}

Rules:
- Only places a traveller could go to. Skip countries and regions that are just context.
- The location tag is usually the city, not the place. Prefer a specific venue named in the caption; fall back to the tag only when the caption names nothing.
- Several places is normal for a list-style post. Keep the order they appear in.
- No place at all is a valid answer: return {"places": []}. Do not invent one to be helpful.
- Do not copy hashtags in as places.
- note is what the post claims, not your own description. Do not summarise a how-to into a slogan: a post explaining how to get tickets should come out with the steps, not the words "buy early".
- Leave out the poster's self-promotion, follow-me lines and hashtags.
- Write every Chinese string in Traditional Chinese as used in Taiwan. Say 貼文 not 帖子, 影片 not 视频, 餐廳 not 饭店.`;

export interface ParsedPlace {
  name: string;
  city?: string;
  country?: string;
  category?: string;
  note?: string;
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

export async function parsePlaces(
  post: ScrapedPost,
  meta: Omit<TrackMeta, "model">
): Promise<ParsedPlace[] | null> {
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
    const parsed = JSON.parse(raw) as { places?: ParsedPlace[] };
    const places = Array.isArray(parsed.places) ? parsed.places : [];
    return places.filter((p) => typeof p?.name === "string" && p.name.trim().length > 0);
  } catch {
    return null;
  }
}
