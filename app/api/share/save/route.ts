import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { actorFrom, logChange } from "@/lib/activityLog";
import { storeImageFromUrl } from "@/lib/imageStore";

/*
  抓圖要時間，而且可能有好幾個地點要寫入。放寬上限，不要在存到一半時被砍掉。
*/
export const maxDuration = 60;

/** 分享進來的東西可以落在三個地方，各自的欄位差很多，所以格式化留在 server 做 */
type Target = "wishlist" | "souvenir" | "note";

interface IncomingPlace {
  name: string;
  city?: string;
  country?: string;
  category?: string;
  note?: string;
  address?: string;
}

interface IncomingDigest {
  heading?: string;
  lines?: string[];
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 連結文字去掉 https://www. —— 備註那一行不需要被一長串網址佔滿 */
function shortLink(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "");
}

function noteLines(note: string | undefined): string[] {
  return (note ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
}

function linkPara(link: string | null): string | null {
  return link ? `<p><a href="${escapeHtml(link)}">${escapeHtml(shortLink(link))}</a></p>` : null;
}

/*
  備註是 HTML（行程頁用 dangerouslySetInnerHTML 渲染），純文字換行不會斷行、網址也不會變成
  連結 —— processLinks 只幫既有的 <a> 補 target，不會自己 linkify。
*/
function itineraryNotes(place: IncomingPlace, link: string | null): string {
  const where = [place.city, place.country].filter(Boolean).join("、");
  return [
    // 地址進了自己的欄位就不必在備註再寫一次；只有補不到地址時才留這一行當線索
    !place.address && where ? `<p>${escapeHtml(where)}</p>` : null,
    // 貼文給了好幾條（買票、時段、價格）時 note 會是多行，一行一段才讀得下去
    ...noteLines(place.note).map((l) => `<p>${escapeHtml(l)}</p>`),
    linkPara(link),
  ].filter(Boolean).join("");
}

/** 伴手禮的備註是純文字渲染，卡片上還會 line-clamp 到兩行，所以要短 */
function souvenirNotes(place: IncomingPlace, link: string | null): string {
  return [
    ...noteLines(place.note),
    place.address ? `哪裡買：${place.address}` : null,
    link ? shortLink(link) : null,
  ].filter(Boolean).join("\n");
}

/** 沿用 NotesTab 的規則：先吃掉結尾的 Quill 空段落，接完再補一個回去 */
function appendToContent(prev: string, html: string): string {
  const cleaned = prev.replace(/(<p><br><\/p>)+\s*$/, "").trim();
  return cleaned + html + "<p><br></p>";
}

function digestHtml(digest: IncomingDigest, link: string | null): string {
  const lines = (digest.lines ?? []).map((l) => l.trim()).filter(Boolean);
  return [
    `<h2>${escapeHtml(digest.heading?.trim() || "貼文重點")}</h2>`,
    lines.length ? `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>` : "",
    linkPara(link) ?? "",
  ].join("");
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const tripId = typeof body?.tripId === "string" ? body.tripId : null;
  const target: Target =
    body?.target === "souvenir" || body?.target === "note" ? body.target : "wishlist";
  const link = typeof body?.link === "string" && body.link.trim() ? body.link.trim() : null;
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : null;
  const incoming: IncomingPlace[] = Array.isArray(body?.places) ? body.places : [];
  const digest: IncomingDigest | null =
    body?.digest && typeof body.digest === "object" ? body.digest : null;

  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  if (target === "note") {
    if (!digest || !(digest.lines ?? []).some((l) => typeof l === "string" && l.trim())) {
      return NextResponse.json({ error: "digest required" }, { status: 400 });
    }
    // 讀的是使用者自己的 client（RLS 擋掉不是他的旅程），寫的才換 service —— 與 notes 那支一致，
    // 讓不是 owner 的成員也存得進去
    const { data: trip } = await supabase.from("trips").select("ai_notes").eq("id", tripId).single();
    if (!trip) return NextResponse.json({ error: "Not found or no access" }, { status: 404 });

    const current = (trip.ai_notes as { content?: string } | null)?.content ?? "";
    const content = appendToContent(current, digestHtml(digest, link));

    const { error } = await createServiceClient()
      .from("trips")
      .update({ ai_notes: { content } })
      .eq("id", tripId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ saved: 1, image: null });
  }

  const valid = incoming.filter((p) => typeof p?.name === "string" && p.name.trim());
  if (valid.length === 0) return NextResponse.json({ error: "at least one place required" }, { status: 400 });

  /*
    封面圖只抓一次，幾個地點共用同一個網址 —— 一則貼文本來就只有一張封面，
    而卡片上沒有圖就是一片灰，其中一筆有圖、其他沒有更奇怪。
  */
  const stored = imageUrl ? await storeImageFromUrl(imageUrl, tripId) : null;

  let saved = 0;
  for (const place of valid) {
    const name = place.name.trim();

    if (target === "souvenir") {
      const tag = place.city?.trim() || place.country?.trim();
      const { data: created, error } = await supabase
        .from("souvenirs")
        .insert({
          trip_id: tripId,
          name,
          notes: souvenirNotes(place, link) || null,
          image_url: stored,
          tags: tag ? [tag] : null,
          is_checked: false,
          order_index: 0,
        })
        .select()
        .single();
      if (error) continue;
      saved += 1;
      await logChange({ action: "create", table: "souvenirs", actor: actorFrom(user), after: created, request });
      continue;
    }

    const { data: created, error } = await supabase
      .from("itinerary_items")
      .insert({
        trip_id: tripId,
        user_id: user.id,
        date: null,
        title: name,
        category: place.category ?? "other",
        location: place.address?.trim() || null,
        notes: itineraryNotes(place, link) || null,
        image_urls: stored ? [stored] : [],
        status: "wishlist",
      })
      .select()
      .single();
    if (error) continue;
    saved += 1;
    await logChange({ action: "create", table: "itinerary_items", actor: actorFrom(user), after: created, request });
  }

  if (saved === 0) return NextResponse.json({ error: "nothing saved" }, { status: 500 });
  return NextResponse.json({ saved, image: stored });
}
