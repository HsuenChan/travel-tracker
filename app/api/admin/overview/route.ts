import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminUser } from "@/lib/adminAuth";
import { deviceKey } from "@/lib/userAgent";
import { estimateCost, monthlyBudgetUsd, AI_FEATURE_LABELS, type AiFeature } from "@/lib/aiUsage";

/**
 * /admin 首屏要的東西，一次給完：登入狀態摘要 + 最新幾筆異動。
 * 兩支分開打的話首屏會有兩段各自 loading 的空白。
 */
export async function GET() {
  if (!(await getAdminUser())) return new NextResponse(null, { status: 404 });

  const service = createServiceClient();
  const since30d = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

  // AI 用量的統計視窗跟帳單對齊（當月），跟登入那段的「最近 30 天」是不同的東西
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();

  const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [logins, recent, ai, errors] = await Promise.all([
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
    service
      .from("ai_usage")
      .select("feature, actor_id, actor_name, prompt_tokens, output_tokens, thinking_tokens, ok, created_at")
      .gte("created_at", monthStart),
    service
      .from("api_errors")
      .select("message, route_path, created_at")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false }),
  ]);

  if (logins.error) return NextResponse.json({ error: logins.error.message }, { status: 500 });
  if (recent.error) return NextResponse.json({ error: recent.error.message }, { status: 500 });

  /*
    AI 用量。ai_usage 是 20_ai_usage.sql 才有的表，還沒跑 migration 時整段回 null，
    後台其餘部分照常顯示 —— 不要讓一個新區塊把整個首屏變成錯誤頁。
  */
  const aiRows = ai.error ? null : (ai.data ?? []);
  const todayStart = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();
  const aiSummary = aiRows && {
    budgetUsd: monthlyBudgetUsd(),
    monthCalls: aiRows.length,
    monthFailed: aiRows.filter((r) => !r.ok).length,
    todayCalls: aiRows.filter((r) => r.created_at >= todayStart).length,
    monthTokens: aiRows.reduce((n, r) => n + (r.prompt_tokens ?? 0) + (r.output_tokens ?? 0) + (r.thinking_tokens ?? 0), 0),
    monthCostUsd: aiRows.reduce((n, r) => n + estimateCost(r.prompt_tokens ?? 0, r.output_tokens ?? 0, r.thinking_tokens ?? 0), 0),
    byFeature: (Object.keys(AI_FEATURE_LABELS) as AiFeature[])
      .map((key) => {
        const rows = aiRows.filter((r) => r.feature === key);
        return {
          key,
          label: AI_FEATURE_LABELS[key],
          calls: rows.length,
          failed: rows.filter((r) => !r.ok).length,
          costUsd: rows.reduce((n, r) => n + estimateCost(r.prompt_tokens ?? 0, r.output_tokens ?? 0, r.thinking_tokens ?? 0), 0),
        };
      })
      .filter((f) => f.calls > 0),
    /*
      依帳號。actor_name 存的是 email，後台只有管理員看得到。
      名字用 Map 收斂而不是直接 group by actor_id —— 匿名或記錄失敗的列 actor_id 是 null，
      用 id 當 key 會把它們全部併成同一個「使用者」。
    */
    byActor: Object.values(
      aiRows.reduce((acc: Record<string, { name: string; calls: number; tokens: number; costUsd: number }>, r) => {
        const key = r.actor_id ?? r.actor_name ?? "unknown";
        const entry = acc[key] ?? { name: r.actor_name ?? "（未知帳號）", calls: 0, tokens: 0, costUsd: 0 };
        entry.calls += 1;
        entry.tokens += (r.prompt_tokens ?? 0) + (r.output_tokens ?? 0) + (r.thinking_tokens ?? 0);
        entry.costUsd += estimateCost(r.prompt_tokens ?? 0, r.output_tokens ?? 0, r.thinking_tokens ?? 0);
        acc[key] = entry;
        return acc;
      }, {})
    ).sort((a, b) => b.costUsd - a.costUsd),
  };

  const rows = logins.data ?? [];
  const succeeded = rows.filter((r) => r.action === "login");
  const devices = new Set(succeeded.map((r) => deviceKey(r.user_agent)));

  /*
    伺服器異常。api_errors 是 22_api_errors.sql 才有的表，還沒跑 migration 時回 null，
    總覽其餘照常 —— 一張新卡片不該把整個首屏變成錯誤頁。
  */
  const errorRows = errors.error ? null : (errors.data ?? []);
  const errorSummary = errorRows && {
    last: errorRows[0] ?? null,
    count24h: errorRows.filter((r) => r.created_at >= since24h).length,
    count7d: errorRows.length,
  };

  return NextResponse.json({
    errors: errorSummary,
    logins: {
      last: succeeded[0] ?? null,
      count30d: succeeded.length,
      deviceCount: devices.size,
      failed30d: rows.filter((r) => r.action === "login_failed").length,
    },
    ai: aiSummary,
    recentChanges: recent.data ?? [],
  });
}
