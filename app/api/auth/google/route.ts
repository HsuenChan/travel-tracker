import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";
  const supabase = await createClient();
  // 使用更精確的方式獲取當前站點網址
  const host = request.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // 這裡強制指定完整的 Callback URL
      redirectTo: `${origin}/api/auth/google/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) {
    return NextResponse.redirect(new URL("/?auth=error", origin));
  }
  return NextResponse.redirect(data.url);
}
