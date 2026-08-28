import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ExpenseRow = Record<string, unknown> & {
  itinerary_items?: { id: string; title: string; date: string } | null;
};

/** 把 join 出來的行程攤平成 itinerary_title / itinerary_date，前端不用再處理巢狀 */
function flattenItinerary(rows: ExpenseRow[]) {
  return rows.map(({ itinerary_items, ...rest }) => ({
    ...rest,
    itinerary_title: itinerary_items?.title ?? null,
    itinerary_date: itinerary_items?.date ?? null,
  }));
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const tripId = request.nextUrl.searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const { data: expenses, error } = await supabase
    .from("expenses")
    .select("*, itinerary_items(id, title, date)")
    .eq("trip_id", tripId)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  // 06_expense_itinerary_link.sql 尚未執行時，join 會失敗 → 退回不帶關聯的查詢
  if (error) {
    const fallback = await supabase
      .from("expenses")
      .select("*")
      .eq("trip_id", tripId)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    return NextResponse.json({ expenses: fallback.data ?? [] });
  }

  return NextResponse.json({ expenses: flattenItinerary((expenses ?? []) as ExpenseRow[]) });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { tripId, date, end_date, category, description, amount, currency, paid_by, split_with, notes } = body;

  const base = {
    trip_id: tripId,
    user_id: user.id,
    date: date || null,
    end_date: end_date || null,
    category: category || null,
    description,
    amount,
    currency,
    paid_by: paid_by || null,
    split_with: split_with ?? [],
    notes: notes || null,
  };

  let { error } = await supabase
    .from("expenses")
    .insert({ ...base, itinerary_item_id: body.itinerary_item_id || null });

  // 06_expense_itinerary_link.sql 尚未執行時，欄位不存在 → 退回不帶關聯的寫入
  if (error && error.message.includes("itinerary_item_id")) {
    ({ error } = await supabase.from("expenses").insert(base));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { id, date, end_date, category, description, amount, currency, paid_by, split_with, notes } = body;

  const base = {
    date: date || null,
    end_date: end_date || null,
    category: category || null,
    description,
    amount,
    currency,
    paid_by: paid_by || null,
    split_with: split_with ?? [],
    notes: notes || null,
  };

  let { error } = await supabase
    .from("expenses")
    .update({ ...base, itinerary_item_id: body.itinerary_item_id || null })
    .eq("id", id);

  if (error && error.message.includes("itinerary_item_id")) {
    ({ error } = await supabase.from("expenses").update(base).eq("id", id));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await request.json();

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
