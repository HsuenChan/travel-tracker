import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { actorFrom, logAuth } from "@/lib/activityLog";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const host = request.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  if (!code) {
    await logAuth({ action: "login_failed", actor: { id: null, name: null }, request });
    return NextResponse.redirect(new URL("/?auth=error", origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  // 這是全站唯一的登入入口，後台的登入紀錄整條靠這裡
  if (error || !data.user) {
    await logAuth({ action: "login_failed", actor: { id: null, name: null }, request });
    return NextResponse.redirect(new URL("/?auth=error", origin));
  }
  await logAuth({ action: "login", actor: actorFrom(data.user), request });

  return NextResponse.redirect(new URL(next, request.url));
}
