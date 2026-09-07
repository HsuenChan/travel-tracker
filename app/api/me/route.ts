import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  return NextResponse.json({
    name: (user.user_metadata?.full_name as string) ?? user.email?.split("@")[0] ?? "",
    // 匯出 Google Sheet 時當作授權彈窗的帳號提示，讓它預選同一個 Google 帳號
    email: user.email ?? null,
    avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
  });
}
