import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 把一張圖收進自己的 Storage。
 *
 * 從上傳端點抽出來，因為分享進來的 IG 封面也要走同一套 —— IG 的 CDN 網址是簽名過的，
 * 大約四天就過期，直接存網址等於存一張過幾天會破的圖。
 */

const BUCKET = "itinerary-images";

export async function storeImage(input: Buffer, tripId: string): Promise<string | null> {
  let webp: Buffer;
  try {
    webp = await sharp(input)
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return null;
  }

  const service = createServiceClient();
  const path = `${tripId}/${crypto.randomUUID()}.webp`;
  const { error } = await service.storage.from(BUCKET).upload(path, webp, { contentType: "image/webp" });
  if (error) return null;

  return service.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** 從網址抓一張圖收進來。抓不到就回 null —— 少一張封面不該讓存入整個失敗 */
export async function storeImageFromUrl(url: string, tripId: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return await storeImage(Buffer.from(await res.arrayBuffer()), tripId);
  } catch {
    return null;
  }
}
