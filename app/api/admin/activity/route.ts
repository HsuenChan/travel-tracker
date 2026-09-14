import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminUser } from "@/lib/adminAuth";
import { parseActivityQuery } from "@/lib/activityQuery";

const PAGE_SIZE = 40;

/** PostgREST 的 or() 用逗號與括號當語法，使用者打的字要先拆掉這些符號 */
function sanitise(text: string): string {
  return text.replace(/[,()"*\\]/g, " ").trim();
}

export async function GET(request: NextRequest) {
  // 不是管理員就當這支 API 不存在
  if (!(await getAdminUser())) return new NextResponse(null, { status: 404 });

  const sp = request.nextUrl.searchParams;
  const parsed = parseActivityQuery(sp.get("q") ?? "");
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0);
  const kind = sp.get("kind");

  let query = createServiceClient()
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (kind === "change" || kind === "auth") query = query.eq("kind", kind);
  if (parsed.tabs.length) query = query.in("tab", parsed.tabs);
  if (parsed.actions.length) query = query.in("action", parsed.actions);
  if (parsed.trip) query = query.ilike("trip_name", `%${sanitise(parsed.trip)}%`);
  if (parsed.sinceHours) {
    query = query.gte("created_at", new Date(Date.now() - parsed.sinceHours * 3600_000).toISOString());
  } else if (!sp.get("q")) {
    // 空查詢預設看最近 24 小時，進來就有東西可讀，不會是一片空白
    query = query.gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  }

  const text = sanitise(parsed.text);
  if (text) {
    query = query.or(
      `entity_label.ilike.%${text}%,note.ilike.%${text}%,trip_name.ilike.%${text}%,actor_name.ilike.%${text}%`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    events: data ?? [],
    nextOffset: (data?.length ?? 0) === PAGE_SIZE ? offset + PAGE_SIZE : null,
    parsed,
    defaultWindow: !sp.get("q") && !parsed.sinceHours,
  });
}
