/**
 * AI 用量記錄與成本上限。
 *
 * 專案用的是 Gemini Tier 1（付費層）。速率上限一天 10,000 次、實際尖峰 2 次，
 * 所以要防的不是撞配額而是帳單 —— 上限因此綁在「每月估計花費」，不是呼叫次數。
 *
 * 失敗的呼叫也要記。被擋下來時同樣是失敗，只記成功的話後台會顯示「用量很低」，
 * 但實際情況可能是一直在撞牆。
 */

import { createServiceClient } from "@/lib/supabase/service";

export type AiFeature = "itinerary" | "notes" | "receipt" | "flight" | "place";

export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  itinerary: "AI 排行程",
  notes: "AI 筆記",
  receipt: "收據辨識",
  flight: "機票辨識",
  place: "分享抽地點",
};

/**
 * Gemini 2.5 Flash 的文字費率，美元／每百萬 token。
 * 來源：https://ai.google.dev/gemini-api/docs/pricing（2026-09 查）。
 * 會變 —— 換模型或 Google 調價時要回來改，畫面上標的是「估計」不是帳單金額。
 */
export const PRICE_PER_MTOK = { input: 0.30, output: 2.50 };

/**
 * token 數 → 估計美元。
 *
 * 思考 token 一定要算進去：2.5 Flash 是思考模型，thoughtsTokenCount 不含在
 * candidatesTokenCount 裡，但它是按 output 費率計費的。實測一次呼叫 output 只有 394，
 * 思考卻有 2,665 —— 漏掉就會把成本低估六倍以上，而這個功能的全部意義就是不要低估成本。
 */
export function estimateCost(promptTokens: number, outputTokens: number, thinkingTokens = 0): number {
  return (promptTokens / 1_000_000) * PRICE_PER_MTOK.input
    + ((outputTokens + thinkingTokens) / 1_000_000) * PRICE_PER_MTOK.output;
}

/** 每月花費上限（美元）。設 0 或負數等於不限制 */
export function monthlyBudgetUsd(): number {
  const raw = Number(process.env.AI_MONTHLY_BUDGET_USD);
  return Number.isFinite(raw) ? raw : 5;
}

/** Gemini SDK 回應裡的 usageMetadata，欄位都可能缺 */
interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  /** 思考模型才有；不含在 candidatesTokenCount 裡，但按 output 費率計費 */
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export interface AiUsageRecord {
  feature: AiFeature;
  model: string;
  actorId?: string | null;
  actorName?: string | null;
  tripId?: string | null;
  tripName?: string | null;
  usage?: UsageMetadata | null;
  durationMs?: number | null;
  ok: boolean;
  error?: string | null;
}

export async function recordAiUsage(input: AiUsageRecord): Promise<void> {
  try {
    const u = input.usage ?? {};
    await createServiceClient().from("ai_usage").insert({
      feature: input.feature,
      model: input.model,
      actor_id: input.actorId ?? null,
      actor_name: input.actorName ?? null,
      trip_id: input.tripId ?? null,
      trip_name: input.tripName ?? null,
      prompt_tokens: u.promptTokenCount ?? null,
      output_tokens: u.candidatesTokenCount ?? null,
      total_tokens: u.totalTokenCount ?? null,
      /*
        SDK 沒回 thoughtsTokenCount 時，用 total - prompt - output 反推。
        總量是對的，差額就是思考 —— 寧可推算也不要記成 0，那等於宣告「沒花到錢」。
      */
      thinking_tokens: u.thoughtsTokenCount
        ?? (u.totalTokenCount != null
          ? Math.max(0, u.totalTokenCount - (u.promptTokenCount ?? 0) - (u.candidatesTokenCount ?? 0))
          : null),
      duration_ms: input.durationMs ?? null,
      ok: input.ok,
      // 錯誤訊息可能很長，截短；要細節的話看伺服器日誌
      error: input.error ? input.error.slice(0, 500) : null,
    });
  } catch {
    // 記錄失敗不能影響 AI 功能本身
  }
}

export interface BudgetState {
  /** 這個月已經花掉的估計金額 */
  spentUsd: number;
  budgetUsd: number;
  /** 沒設上限時永遠是 false */
  exceeded: boolean;
}

/** 當月第一天的 UTC 時間。跟帳單週期對齊，不是「最近 30 天」 */
function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * 這個月花了多少、有沒有超過上限。
 *
 * 讀取失敗時回 exceeded: false —— 監測壞掉不該讓 AI 功能整個停擺，那是把
 * 「看不到用量」升級成「功能不能用」。
 */
export async function checkAiBudget(): Promise<BudgetState> {
  const budgetUsd = monthlyBudgetUsd();
  try {
    const { data } = await createServiceClient()
      .from("ai_usage")
      .select("prompt_tokens,output_tokens,thinking_tokens")
      .gte("created_at", monthStart());

    const spentUsd = (data ?? []).reduce(
      (sum, r) => sum + estimateCost(r.prompt_tokens ?? 0, r.output_tokens ?? 0, r.thinking_tokens ?? 0),
      0
    );
    return { spentUsd, budgetUsd, exceeded: budgetUsd > 0 && spentUsd >= budgetUsd };
  } catch {
    return { spentUsd: 0, budgetUsd, exceeded: false };
  }
}

/** 超過上限時回給前端的訊息，講清楚是什麼狀況而不是「發生錯誤」 */
export function budgetExceededMessage(state: BudgetState): string {
  return `本月 AI 用量已達設定上限（估計 $${state.spentUsd.toFixed(2)} / $${state.budgetUsd.toFixed(2)}），`
    + "下個月自動恢復。要繼續使用請調整 AI_MONTHLY_BUDGET_USD。";
}

/** Gemini SDK 回應的最小形狀 —— 只在意 usageMetadata，其餘原封不動傳回去 */
interface GeminiResult {
  response?: { usageMetadata?: UsageMetadata };
}

export type TrackMeta = Pick<AiUsageRecord, "feature" | "model" | "actorId" | "actorName" | "tripId" | "tripName">;

/**
 * 包住一次 Gemini 呼叫：計時、讀 usageMetadata、寫進 ai_usage，然後把結果原樣回傳。
 *
 * 失敗時先記一筆再把錯誤丟出去 —— 呼叫端的錯誤處理完全不用改，但用量不會漏掉。
 * 這是整件事能成立的關鍵：usageMetadata 原本被整個丟掉，沒有它就只能數點擊次數，
 * 跟帳單對不起來。
 */
export async function trackGemini<R extends GeminiResult>(
  meta: TrackMeta,
  call: () => Promise<R>
): Promise<R> {
  const started = Date.now();
  try {
    const result = await call();
    await recordAiUsage({
      ...meta,
      usage: result.response?.usageMetadata ?? null,
      durationMs: Date.now() - started,
      ok: true,
    });
    return result;
  } catch (e) {
    await recordAiUsage({
      ...meta,
      durationMs: Date.now() - started,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

/** 四支 API 開頭共用：超過預算就回 429，附上講得清楚的訊息 */
export async function aiBudgetGuard(): Promise<{ error: string; status: 429 } | null> {
  const state = await checkAiBudget();
  return state.exceeded ? { error: budgetExceededMessage(state), status: 429 } : null;
}
