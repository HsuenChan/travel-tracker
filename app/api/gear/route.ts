import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ROLES = ["base", "worn", "consumable"] as const;

/** 只信任白名單裡的重量身份，否則 base weight 的算式會被寫壞 */
function normalizeRole(role: unknown): string {
  return ROLES.includes(role as (typeof ROLES)[number]) ? (role as string) : "base";
}

/** 重量與數量允許留空（還沒秤），但不能是負數或 NaN */
function normalizeWeight(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function normalizeQty(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export async function GET(request: NextRequest) {
  const tripId = request.nextUrl.searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "Missing tripId" }, { status: 400 });

  const supabase = await createClient();

  // 唯讀分享頁以匿名 session 讀取，這裡不強制登入（與 souvenirs 一致）
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
  const { tripId, name, notes, image_url, tags, weight_g, qty, weight_role, assigned_to } = body;
  if (!tripId || !name?.trim()) return NextResponse.json({ error: "Missing tripId or name" }, { status: 400 });

  const { data, error } = await supabase
    .from("gear_items")
    .insert({
      trip_id: tripId,
      name,
      notes,
      image_url,
      tags,
      weight_g: normalizeWeight(weight_g),
      qty: normalizeQty(qty),
      weight_role: normalizeRole(weight_role),
      assigned_to: assigned_to || null,
      is_checked: false,
      order_index: 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { id, is_checked, name, notes, image_url, tags, weight_g, qty, weight_role, assigned_to, order_index } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // 打勾只送 is_checked，其他欄位不該被覆寫成 undefined
  const patch: Record<string, unknown> = {};
  if (is_checked !== undefined) patch.is_checked = is_checked;
  if (name !== undefined) patch.name = name;
  if (notes !== undefined) patch.notes = notes;
  if (image_url !== undefined) patch.image_url = image_url;
  if (tags !== undefined) patch.tags = tags;
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
