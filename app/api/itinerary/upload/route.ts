import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storeImage } from "@/lib/imageStore";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const tripId = formData.get("tripId") as string | null;
  if (!file || !tripId) return NextResponse.json({ error: "file and tripId required" }, { status: 400 });

  const url = await storeImage(Buffer.from(await file.arrayBuffer()), tripId);
  if (!url) return NextResponse.json({ error: "Unsupported image format" }, { status: 400 });

  return NextResponse.json({ url });
}
