import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiBudgetGuard } from "@/lib/aiUsage";
import { scrapeInstagram } from "@/lib/instagramScrape";
import { scrapeThreads } from "@/lib/threadsScrape";
import { cleanShareUrl, sourceOf } from "@/lib/sharedLink";
import { parsePost } from "@/lib/placeParser";
import { fillAddresses } from "@/lib/placeAddress";

/*
  抓取那一段實測 11～17 秒，AI 再 6 秒，補地址的反查最多再 7 秒。平台預設的函式上限不夠，
  所以放寬到 60 秒 —— 這條路本來就是使用者盯著進度等的，慢比失敗好。
*/
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  /*
    Threads 不走 Apify —— 那顆 actor 只吃 instagram.com 的網址，餵 Threads 連結進去
    什麼都拿不到。Threads 自己的貼文頁就有完整的 og 標籤，直接讀比較快也不用錢。
  */
  const scraped = sourceOf(url) === "threads" ? await scrapeThreads(url) : await scrapeInstagram(url);
  if ("failure" in scraped) {
    return NextResponse.json({ reason: scraped.failure, link: cleanShareUrl(url) }, { status: 200 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ reason: "no_ai", post: scraped.post, link: scraped.post.url });
  }
  if (await aiBudgetGuard()) {
    return NextResponse.json({ reason: "over_budget", post: scraped.post, link: scraped.post.url });
  }

  /*
    AI 掛掉不該讓整支 route 500 —— 抓回來的貼文還在，使用者仍然可以自己打名稱把連結存下來。
    先前這裡沒有接住例外，Gemini 回 503 時畫面就變成一個沒有出路的錯誤。
  */
  let parsed: Awaited<ReturnType<typeof parsePost>>;
  try {
    parsed = await parsePost(scraped.post, {
      feature: "place",
      actorId: user.id,
      actorName: user.email ?? null,
    });
  } catch {
    return NextResponse.json({
      link: scraped.post.url,
      post: scraped.post,
      places: [],
      digest: null,
      reason: "ai_error",
    });
  }

  const places = parsed ? await fillAddresses(parsed.places, scraped.post.caption) : [];

  return NextResponse.json({
    link: scraped.post.url,
    post: scraped.post,
    places,
    // 沒抽到地點時 digest 就是這則貼文唯一的出路，所以一定要跟著回去
    digest: parsed?.digest ?? null,
    // null 是 AI 回了不是 JSON 的東西，[] 是它看過但認為沒有地點 —— 兩者要分開講
    reason: parsed === null ? "unparsable" : places.length === 0 ? "no_place" : null,
  });
}
