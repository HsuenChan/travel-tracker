import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminUser } from "@/lib/adminAuth";
import { estimateCost, monthlyBudgetUsd, AI_FEATURE_LABELS, type AiFeature } from "@/lib/aiUsage";

const PAGE_SIZE = 50;

interface TokenRow {
  prompt_tokens: number | null;
  output_tokens: number | null;
  thinking_tokens: number | null;
}

const costOf = (r: TokenRow) => estimateCost(r.prompt_tokens ?? 0, r.output_tokens ?? 0, r.thinking_tokens ?? 0);
const tokensOf = (r: TokenRow) => (r.prompt_tokens ?? 0) + (r.output_tokens ?? 0) + (r.thinking_tokens ?? 0);

/**
 * AI 用量頁的資料來源。
 *
 * 摘要與明細一次給完，兩支分開打的話這一頁會有兩段各自 loading 的空白。
 * 摘要看當月（跟帳單週期對齊），明細不限時間往回翻。
 */
export async function GET(request: NextRequest) {
  if (!(await getAdminUser())) return new NextResponse(null, { status: 404 });

  const offset = Math.max(0, Number(request.nextUrl.searchParams.get("offset") ?? 0) || 0);
  const service = createServiceClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [month, page] = await Promise.all([
    service
      .from("ai_usage")
      .select("feature, actor_id, actor_name, prompt_tokens, output_tokens, thinking_tokens, ok, created_at")
      .gte("created_at", monthStart),
    service
      .from("ai_usage")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
  ]);

  // 表或欄位還沒建好時回 null，讓畫面說「先跑 migration」而不是變成錯誤頁
  if (month.error || page.error) {
    return NextResponse.json({ summary: null, calls: [], nextOffset: null });
  }

  const rows = month.data ?? [];
  const todayStart = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();

  return NextResponse.json({
    summary: {
      budgetUsd: monthlyBudgetUsd(),
      monthCalls: rows.length,
      monthFailed: rows.filter((r) => !r.ok).length,
      todayCalls: rows.filter((r) => r.created_at >= todayStart).length,
      monthTokens: rows.reduce((n, r) => n + tokensOf(r), 0),
      monthCostUsd: rows.reduce((n, r) => n + costOf(r), 0),
      byFeature: (Object.keys(AI_FEATURE_LABELS) as AiFeature[])
        .map((key) => {
          const f = rows.filter((r) => r.feature === key);
          return {
            key,
            label: AI_FEATURE_LABELS[key],
            calls: f.length,
            failed: f.filter((r) => !r.ok).length,
            tokens: f.reduce((n, r) => n + tokensOf(r), 0),
            costUsd: f.reduce((n, r) => n + costOf(r), 0),
          };
        })
        .filter((f) => f.calls > 0),
      /*
        依帳號。key 用 actor_id ?? actor_name —— 記錄失敗或匿名的列 actor_id 是 null，
        只用 id 會把它們全部併成同一個「使用者」。
      */
      byActor: Object.values(
        rows.reduce((acc: Record<string, { name: string; calls: number; tokens: number; costUsd: number }>, r) => {
          const key = r.actor_id ?? r.actor_name ?? "unknown";
          const e = acc[key] ?? { name: r.actor_name ?? "（未知帳號）", calls: 0, tokens: 0, costUsd: 0 };
          e.calls += 1;
          e.tokens += tokensOf(r);
          e.costUsd += costOf(r);
          acc[key] = e;
          return acc;
        }, {})
      ).sort((a, b) => b.costUsd - a.costUsd),
    },
    calls: page.data ?? [],
    nextOffset: (page.data?.length ?? 0) === PAGE_SIZE ? offset + PAGE_SIZE : null,
  });
}
