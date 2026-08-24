import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const tripId = formData.get("tripId") as string | null;
  if (!file || !tripId) return NextResponse.json({ error: "file and tripId required" }, { status: 400 });

  const input = Buffer.from(await file.arrayBuffer());
  let webp: Buffer;
  try {
    webp = await sharp(input)
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Unsupported image format" }, { status: 400 });
  }

  const service = createServiceClient();
  const path = `${tripId}/${crypto.randomUUID()}.webp`;
  const { error } = await service.storage
    .from("itinerary-images")
    .upload(path, webp, { contentType: "image/webp" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = service.storage.from("itinerary-images").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
