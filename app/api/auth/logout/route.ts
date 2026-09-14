import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { actorFrom, logAuth } from "@/lib/activityLog";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  // 要在 signOut 之前拿，之後 session 就沒了
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (user) await logAuth({ action: "logout", actor: actorFrom(user), request });
  return NextResponse.redirect(new URL("/", request.url));
}
