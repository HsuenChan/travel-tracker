import type { Metadata } from "next";
import { Suspense } from "react";
import dayjs from "dayjs";
import { createServiceClient } from "@/lib/supabase/service";
import { parseCoverPos } from "@/lib/coverPos";
import SharePageClient from "./SharePageClient";

const BASE_URL = "https://travel-tracker-nine-delta.vercel.app";
const FALLBACK_IMAGE = `${BASE_URL}/icon-512.png`;

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params;

  try {
    const supabase = createServiceClient();
    const { data: trip } = await supabase
      .from("trips")
      .select("id, name, start_date, end_date, countries")
      .eq("share_token", token)
      .single();

    if (!trip) return {};

    // 與分享頁 hero 同一條規則：第一張有圖的行程照片
    const { data: items } = await supabase
      .from("itinerary_items")
      .select("image_urls")
      .eq("trip_id", trip.id)
      .order("date", { ascending: true })
      .order("time", { ascending: true, nullsFirst: true });

    const firstImage = items?.find(
      (i: { image_urls: string[] | null }) => i.image_urls && i.image_urls.length > 0
    )?.image_urls?.[0];
    const image = firstImage ? parseCoverPos(firstImage).clean : FALLBACK_IMAGE;

    const title = `${trip.name} - Travel Tracker`;
    const dateRange = trip.start_date
      ? `${dayjs(trip.start_date).format("YYYY/MM/DD")}${trip.end_date ? ` – ${dayjs(trip.end_date).format("YYYY/MM/DD")}` : ""}`
      : "";
    const description = [trip.countries, dateRange].filter(Boolean).join(" · ")
      || "記錄你走過的每一段旅程";

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${BASE_URL}/share/${token}`,
        siteName: "Travel Tracker",
        images: [{ url: image, alt: trip.name }],
        type: "website",
      },
      twitter: {
        card: firstImage ? "summary_large_image" : "summary",
        title,
        description,
        images: [image],
      },
    };
  } catch {
    // 撈不到就沿用全站預設 metadata，不要讓分享頁掛掉
    return {};
  }
}

export default function SharePage() {
  // SharePageClient 用到 useSearchParams（?tab=），production build 需要 Suspense 邊界
  return (
    <Suspense fallback={null}>
      <SharePageClient />
    </Suspense>
  );
}
