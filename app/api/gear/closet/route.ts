import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeQty, normalizeRole, normalizeWeight } from "@/lib/gear";

/** The closet is user-owned, so RLS (08_gear_closet.sql) also enforces the user_id here. */
function toInsertRow(userId: string, raw: Record<string, unknown>) {
  return {
    user_id: userId,
    name: String(raw.name ?? "").trim(),
    notes: (raw.notes as string) ?? null,
    image_url: (raw.image_url as string) ?? null,
    category: (raw.category as string) || null,
    weight_g: normalizeWeight(raw.weight_g),
    qty: normalizeQty(raw.qty),
    weight_role: normalizeRole(raw.weight_role),
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("gear_closet")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const raws: Record<string, unknown>[] = Array.isArray(body.items) ? body.items : [body];
  const rows = raws.map((r) => toInsertRow(user.id, r)).filter((r) => r.name !== "");
  if (rows.length === 0) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  // 同名同重量的裝備已經在櫃子裡就不再重複存，避免每趟旅程都堆一份
  const { data: existing } = await supabase
    .from("gear_closet")
    .select("name, weight_g")
    .eq("user_id", user.id);
  const seen = new Set((existing || []).map((e) => `${e.name}|${e.weight_g ?? ""}`));
  const fresh = rows.filter((r) => !seen.has(`${r.name}|${r.weight_g ?? ""}`));

  if (fresh.length === 0) return NextResponse.json({ items: [], inserted: 0, duplicates: rows.length });

  const { data, error } = await supabase
    .from("gear_closet")
    .insert(fresh)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data, inserted: data?.length ?? 0, duplicates: rows.length - fresh.length });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase
    .from("gear_closet")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
