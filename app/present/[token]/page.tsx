import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import PresentClient from "./PresentClient";

export const metadata: Metadata = { robots: "noindex" };

export default async function PresentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, name, start_date, end_date, countries, photo_album_id, people")
    .eq("share_token", token)
    .single();

  if (error || !trip) notFound();

  const { data: itinerary } = await supabase
    .from("itinerary_items")
    .select("id, date, time, title, category, location")
    .eq("trip_id", trip.id)
    .order("date", { ascending: true })
    .order("time", { ascending: true, nullsFirst: true });

  return <PresentClient trip={trip} itinerary={itinerary ?? []} />;
}
