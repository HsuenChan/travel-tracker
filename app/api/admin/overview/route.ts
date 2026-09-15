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

  const [logins, recent, ai] = await Promise.all([
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
      .select("feature, prompt_tokens, output_tokens, ok, created_at")
      .gte("created_at", monthStart),
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
    monthTokens: aiRows.reduce((n, r) => n + (r.prompt_tokens ?? 0) + (r.output_tokens ?? 0), 0),
    monthCostUsd: aiRows.reduce((n, r) => n + estimateCost(r.prompt_tokens ?? 0, r.output_tokens ?? 0), 0),
    byFeature: (Object.keys(AI_FEATURE_LABELS) as AiFeature[])
      .map((key) => {
        const rows = aiRows.filter((r) => r.feature === key);
        return {
          key,
          label: AI_FEATURE_LABELS[key],
          calls: rows.length,
          failed: rows.filter((r) => !r.ok).length,
          costUsd: rows.reduce((n, r) => n + estimateCost(r.prompt_tokens ?? 0, r.output_tokens ?? 0), 0),
        };
      })
      .filter((f) => f.calls > 0),
  };

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
    ai: aiSummary,
    recentChanges: recent.data ?? [],
  });
}
