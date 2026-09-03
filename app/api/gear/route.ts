import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeQty, normalizeRole, normalizeScope, normalizeWeight } from "@/lib/gear";

/**
 * Row shape accepted from the client for both single and bulk inserts.
 *
 * owner_user_id is taken from the session, never from the request: the RLS policy for personal
 * gear checks owner_user_id = auth.uid(), so letting the client name an owner would just make
 * the insert fail — and trusting it would be the wrong shape of trust anyway.
 */
function toInsertRow(tripId: string, userId: string, raw: Record<string, unknown>) {
  const scope = normalizeScope(raw.scope);
  return {
    trip_id: tripId,
    name: String(raw.name ?? "").trim(),
    notes: (raw.notes as string) ?? null,
    image_url: (raw.image_url as string) ?? null,
    category: (raw.category as string) || null,
    scope,
    owner_user_id: scope === "personal" ? userId : null,
    weight_g: normalizeWeight(raw.weight_g),
    qty: normalizeQty(raw.qty),
    weight_role: normalizeRole(raw.weight_role),
    // 個人裝備不該有攜帶者；即使前端送了也在這裡歸零
    assigned_to: scope === "group" ? ((raw.assigned_to as string) || null) : null,
    is_checked: false,
    order_index: 0,
  };
}

export async function GET(request: NextRequest) {
  const tripId = request.nextUrl.searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "Missing tripId" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // RLS 只放行旅程成員，匿名讀取會靜靜回空陣列而不是報錯；明確擋掉比較好debug。
  // 唯讀分享頁不走這裡，資料由 /api/share/[token] 以 service client 提供。
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("gear_items")
    .select("*")
    .eq("trip_id", tripId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { tripId } = body;
  if (!tripId) return NextResponse.json({ error: "Missing tripId" }, { status: 400 });

  // 裝備櫃套用與 CSV 匯入走 items 陣列，手動新增走單筆
  const raws: Record<string, unknown>[] = Array.isArray(body.items) ? body.items : [body];
  const rows = raws.map((r) => toInsertRow(tripId, user.id, r)).filter((r) => r.name !== "");
  if (rows.length === 0) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const { data, error } = await supabase
    .from("gear_items")
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(Array.isArray(body.items) ? { items: data, inserted: data?.length ?? 0 } : data?.[0]);
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { id, is_checked, name, notes, image_url, category, scope, weight_g, qty, weight_role, assigned_to, order_index } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // 打勾只送 is_checked，其他欄位不該被覆寫成 undefined
  const patch: Record<string, unknown> = {};
  if (is_checked !== undefined) patch.is_checked = is_checked;
  if (name !== undefined) patch.name = name;
  if (notes !== undefined) patch.notes = notes;
  if (image_url !== undefined) patch.image_url = image_url;
  if (category !== undefined) patch.category = category || null;
  if (scope !== undefined) {
    const next = normalizeScope(scope);
    patch.scope = next;
    // 切成個人時要把 owner 補上，否則 RLS 會讓它對所有人隱形（含自己）
    patch.owner_user_id = next === "personal" ? user.id : null;
  }
  if (weight_g !== undefined) patch.weight_g = normalizeWeight(weight_g);
  if (qty !== undefined) patch.qty = normalizeQty(qty);
  if (weight_role !== undefined) patch.weight_role = normalizeRole(weight_role);
  if (assigned_to !== undefined) patch.assigned_to = assigned_to || null;
  if (order_index !== undefined) patch.order_index = order_index;

  const { data, error } = await supabase
    .from("gear_items")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase
    .from("gear_items")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
