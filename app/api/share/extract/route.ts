import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiBudgetGuard } from "@/lib/aiUsage";
import { scrapeInstagram } from "@/lib/instagramScrape";
import { cleanShareUrl } from "@/lib/sharedLink";
import { parsePlaces } from "@/lib/placeParser";

/*
  抓取那一段實測 11～17 秒，AI 再 6 秒。平台預設的函式上限不夠，所以放寬到 60 秒 ——
  這條路本來就是使用者盯著進度等的，慢比失敗好。
*/
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const scraped = await scrapeInstagram(url);
  if ("failure" in scraped) {
    return NextResponse.json({ reason: scraped.failure, link: cleanShareUrl(url) }, { status: 200 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ reason: "no_ai", post: scraped.post, link: scraped.post.url });
  }
  if (await aiBudgetGuard()) {
    return NextResponse.json({ reason: "over_budget", post: scraped.post, link: scraped.post.url });
  }

  const places = await parsePlaces(scraped.post, {
    feature: "place",
    actorId: user.id,
    actorName: user.email ?? null,
  });

  return NextResponse.json({
    link: scraped.post.url,
    post: scraped.post,
    // null 是 AI 回了不是 JSON 的東西，[] 是它看過但認為沒有地點 —— 兩者要分開講
    places: places ?? [],
    reason: places === null ? "unparsable" : places.length === 0 ? "no_place" : null,
  });
}
