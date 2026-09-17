import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { actorFrom, logChange } from "@/lib/activityLog";
import { storeImageFromUrl } from "@/lib/imageStore";

/*
  抓圖要時間，而且可能有好幾個地點要寫入。放寬上限，不要在存到一半時被砍掉。
*/
export const maxDuration = 60;

interface IncomingPlace {
  title: string;
  category?: string;
  notes?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const tripId = typeof body?.tripId === "string" ? body.tripId : null;
  const places: IncomingPlace[] = Array.isArray(body?.places) ? body.places : [];
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : null;

  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });
  const valid = places.filter((p) => typeof p?.title === "string" && p.title.trim());
  if (valid.length === 0) return NextResponse.json({ error: "at least one place required" }, { status: 400 });

  /*
    封面圖只抓一次，幾個地點共用同一個網址 —— 一則貼文本來就只有一張封面，
    而卡片上沒有圖就是一片灰，其中一筆有圖、其他沒有更奇怪。
  */
  const stored = imageUrl ? await storeImageFromUrl(imageUrl, tripId) : null;
  const images = stored ? [stored] : [];

  let saved = 0;
  for (const place of valid) {
    const { data: created, error } = await supabase
      .from("itinerary_items")
      .insert({
        trip_id: tripId,
        user_id: user.id,
        date: null,
        title: place.title.trim(),
        category: place.category ?? "other",
        notes: place.notes ?? null,
        image_urls: images,
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
