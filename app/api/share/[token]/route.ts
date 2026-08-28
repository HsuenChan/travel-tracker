import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: tripRow, error } = await supabase
    .from("trips")
    .select("id, name, start_date, end_date, countries, notes, photo_album_id, people, currency, ai_notes")
    .eq("share_token", token)
    .single();

  if (error || !tripRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ai_notes 是「筆記」分頁的內容（{ content }），與 trips.notes（旅程簡介）不同
  const { ai_notes: note, ...trip } = tripRow;

  const { data: segments } = await supabase
    .from("segments")
    .select("*")
    .eq("trip_id", trip.id)
    .order("order", { ascending: true });

  const { data: itinerary } = await supabase
    .from("itinerary_items")
    .select("*")
    .eq("trip_id", trip.id)
    .order("date", { ascending: true })
    .order("time", { ascending: true, nullsFirst: true });

  // 帶出關聯行程；06_expense_itinerary_link.sql 未執行時退回不帶關聯的查詢
  const linked = await supabase
    .from("expenses")
    .select("*, itinerary_items(id, title, date)")
    .eq("trip_id", trip.id)
    .order("date", { ascending: true });
  const plain = linked.error
    ? await supabase.from("expenses").select("*").eq("trip_id", trip.id).order("date", { ascending: true })
    : null;
  const expenses = (linked.data ?? plain?.data ?? []).map((row) => {
    const { itinerary_items, ...rest } = row as Record<string, unknown> & {
      itinerary_items?: { id: string; title: string; date: string } | null;
    };
    return { ...rest, itinerary_title: itinerary_items?.title ?? null };
  });

  return NextResponse.json({
    trip,
    segments: segments ?? [],
    itinerary: itinerary ?? [],
    expenses,
    note: note ?? null,
  });
}
