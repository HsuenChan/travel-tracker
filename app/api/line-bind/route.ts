import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Generate a random 6-digit code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();

  // Check if already bound
  const { data: existing } = await service
    .from("line_user_mappings")
    .select("line_user_id")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ bound: true });
  }

  // Invalidate old unused codes
  await service
    .from("line_binding_codes")
    .update({ used: true })
    .eq("user_id", user.id)
    .eq("used", false);

  // Create new code
  let code = generateCode();
  // Retry on collision (extremely unlikely)
  for (let i = 0; i < 5; i++) {
    const { error } = await service.from("line_binding_codes").insert({ code, user_id: user.id });
    if (!error) break;
    code = generateCode();
  }

  return NextResponse.json({ code, expiresIn: 600 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();
  await service.from("line_user_mappings").delete().eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
