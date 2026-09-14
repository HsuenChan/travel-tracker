import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminUser } from "@/lib/adminAuth";
import { deviceKey } from "@/lib/userAgent";

/**
 * /admin 首屏要的東西，一次給完：登入狀態摘要 + 最新幾筆異動。
 * 兩支分開打的話首屏會有兩段各自 loading 的空白。
 */
export async function GET() {
  if (!(await getAdminUser())) return new NextResponse(null, { status: 404 });

  const service = createServiceClient();
  const since30d = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

  const [logins, recent] = await Promise.all([
    service
      .from("activity_log")
      .select("action, ip, user_agent, actor_name, created_at")
      .eq("kind", "auth")
      .gte("created_at", since30d)
      .order("created_at", { ascending: false }),
    service
      .from("activity_log")
      .select("*")
      .eq("kind", "change")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (logins.error) return NextResponse.json({ error: logins.error.message }, { status: 500 });
  if (recent.error) return NextResponse.json({ error: recent.error.message }, { status: 500 });

  const rows = logins.data ?? [];
  const succeeded = rows.filter((r) => r.action === "login");
  const devices = new Set(succeeded.map((r) => deviceKey(r.user_agent)));

  return NextResponse.json({
    logins: {
      last: succeeded[0] ?? null,
      count30d: succeeded.length,
      deviceCount: devices.size,
      failed30d: rows.filter((r) => r.action === "login_failed").length,
    },
    recentChanges: recent.data ?? [],
  });
}
