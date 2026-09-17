"use client";

import { useCallback, useEffect, useState } from "react";
import { relativeTime } from "@/app/components/admin/parts";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { AI_FEATURE_LABELS } from "@/lib/aiUsage";
import type { ApifyUsage } from "@/lib/apifyUsage";
import { SparkleIcon } from "@/app/components/Icons";

interface AiCall {
  id: string;
  feature: string;
  model: string;
  actor_name: string | null;
  trip_name: string | null;
  prompt_tokens: number | null;
  output_tokens: number | null;
  thinking_tokens: number | null;
  duration_ms: number | null;
  ok: boolean;
  error: string | null;
  created_at: string;
}

interface Summary {
  budgetUsd: number;
  monthCalls: number;
  monthFailed: number;
  todayCalls: number;
  monthTokens: number;
  monthCostUsd: number;
  byFeature: { key: string; label: string; calls: number; failed: number; tokens: number; costUsd: number }[];
  byActor: { name: string; calls: number; tokens: number; costUsd: number }[];
}

/** 小額要多給幾位小數：toFixed(2) 會把 $0.008 寫成「$0.01」甚至「$0.00」 */
const usd = (n: number) => (n > 0 && n < 1 ? n.toFixed(3) : n.toFixed(2));
const kTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

export default function AiUsageConsole() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [apify, setApify] = useState<ApifyUsage | null>(null);
  const [calls, setCalls] = useState<AiCall[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/ai");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSummary(data.summary);
      setApify(data.apify ?? null);
      setCalls(data.calls);
      setNextOffset(data.nextOffset);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (nextOffset === null) return;
    setLoadingMore(true);
    try {
      const res = await fetchWithAuth(`/api/admin/ai?offset=${nextOffset}`);
      const data = await res.json();
      setCalls((c) => [...c, ...data.calls]);
      setNextOffset(data.nextOffset);
    } catch {
      // 載更多失敗不用清掉已經讀到的，下次再按就好
    } finally {
      setLoadingMore(false);
    }
  };

  const overBudget = !!summary && summary.budgetUsd > 0 && summary.monthCostUsd >= summary.budgetUsd;

  return (
    <div className="pt-6">
      <h1 className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-500">AI 用量</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
        每一次 Gemini 呼叫的 token 與估計花費，含失敗的呼叫。金額是依公告費率換算的估計值，不是帳單金額。
      </p>


      {loading ? (
        <ul aria-hidden className="mt-5 space-y-3">
          {[0, 1, 2].map((i) => <li key={i} className="admin-pulse h-14 rounded-xl bg-white/[0.03]" />)}
        </ul>
      ) : error ? (
        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-5 text-[14px] text-rose-200">
          讀不到 AI 用量，請重新整理再試一次。
        </div>
      ) : !summary ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] px-5 py-10 text-center">
          <p className="text-[15px] font-semibold text-zinc-300">還沒建立 AI 用量資料表</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
            請先執行 supabase/20_ai_usage.sql 與 21_ai_thinking_tokens.sql。
          </p>
        </div>
      ) : (
        <>
          <section className="mt-5">
            <p className="flex flex-wrap items-center gap-2 text-[19px] font-bold text-zinc-100">
              <SparkleIcon size={16} className={overBudget ? "text-amber-300" : "text-violet-300"} />
              本月估計 <span className="admin-nums">${usd(summary.monthCostUsd)}</span>
              {summary.budgetUsd > 0 && (
                <span className="text-[13px] font-medium text-zinc-500">
                  / 上限 <span className="admin-nums">${usd(summary.budgetUsd)}</span>
                </span>
              )}
            </p>

            {summary.budgetUsd > 0 && (
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={`h-full rounded-full ${overBudget ? "bg-amber-400" : "bg-violet-400/70"}`}
                  style={{ width: `${Math.min(100, (summary.monthCostUsd / summary.budgetUsd) * 100)}%` }}
                />
              </div>
            )}

            <p className="mt-2.5 text-[13px] text-zinc-500">
              本月 <span className="admin-nums text-zinc-300">{summary.monthCalls}</span> 次
              <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
              今日 <span className="admin-nums text-zinc-300">{summary.todayCalls}</span> 次
              <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
              <span className="admin-nums text-zinc-300">{kTokens(summary.monthTokens)}</span> tokens
              {summary.monthFailed > 0 && (
                <>
                  <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
                  <span className="font-semibold text-amber-300">
                    <span className="admin-nums">{summary.monthFailed}</span> 次失敗
                  </span>
                </>
              )}
            </p>

            <ConsoleLink href="https://aistudio.google.com/usage">Gemini 用量後台</ConsoleLink>
          </section>

          {apify && <ApifyBlock usage={apify} />}

          {/* 依功能與依帳號並排：兩份都是短清單，電腦版分兩欄就不用捲 */}
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-2 lg:gap-x-10">
            <Breakdown
              title="依功能"
              rows={summary.byFeature.map((f) => ({
                key: f.key, name: f.label, calls: f.calls, tokens: f.tokens, costUsd: f.costUsd, failed: f.failed,
              }))}
            />
            <Breakdown
              title="依帳號"
              rows={summary.byActor.map((a) => ({
                key: a.name, name: a.name, calls: a.calls, tokens: a.tokens, costUsd: a.costUsd, failed: 0,
              }))}
            />
          </div>

          <section className="mt-7">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-500">呼叫明細</h2>
            {calls.length === 0 ? (
              <p className="mt-2 text-[13px] text-zinc-500">還沒有任何 AI 呼叫。</p>
            ) : (
              <>
                {/* 手機：一列一張卡；電腦：表格 */}
                <ul className="mt-2 sm:hidden">
                  {calls.map((c) => <CallCard key={c.id} call={c} />)}
                </ul>
                <div className="mt-2 hidden overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] sm:block">
                  <table className="w-full table-fixed text-left">
                    <colgroup>
                      {["7rem", "7rem", "auto", "5rem", "5rem", "5rem", "4.5rem", "6rem"].map((w, i) => (
                        <col key={i} style={{ width: w === "auto" ? undefined : w }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr className="border-b border-white/[0.08]">
                        {["時間", "功能", "帳號", "輸入", "輸出", "思考", "耗時", "估計"].map((h, i) => (
                          <th
                            key={h}
                            scope="col"
                            className={`px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-600 ${i >= 3 ? "text-right" : ""}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {calls.map((c) => (
                        <tr key={c.id} className="border-b border-white/[0.05] last:border-b-0">
                          <td className="px-3 py-2.5 text-[13px] text-zinc-400">{relativeTime(c.created_at)}</td>
                          <td className="px-3 py-2.5 text-[13px] text-zinc-200">
                            {AI_FEATURE_LABELS[c.feature as keyof typeof AI_FEATURE_LABELS] ?? c.feature}
                            {!c.ok && (
                              <span className="ml-1.5 rounded-full bg-rose-400/15 px-1.5 py-px text-[10px] font-bold text-rose-300">
                                失敗
                              </span>
                            )}
                          </td>
                          <td className="truncate px-3 py-2.5 text-[13px] text-zinc-400" title={c.actor_name ?? undefined}>
                            {c.actor_name ?? "—"}
                          </td>
                          <Num>{c.prompt_tokens}</Num>
                          <Num>{c.output_tokens}</Num>
                          <Num>{c.thinking_tokens}</Num>
                          <td className="admin-nums px-3 py-2.5 text-right text-[13px] text-zinc-500">
                            {c.duration_ms != null ? `${(c.duration_ms / 1000).toFixed(1)}s` : "—"}
                          </td>
                          <td className="admin-nums px-3 py-2.5 text-right text-[13px] text-zinc-200">
                            ${usd(cost(c))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {nextOffset !== null && (
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="admin-focus mt-5 w-full rounded-full border border-white/[0.08] py-2.5 text-[13px] font-semibold text-zinc-400 transition-colors hover:border-white/[0.16] hover:text-zinc-200 disabled:opacity-50"
                  >
                    {loadingMore ? "載入中" : "載入更早的"}
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** 費率跟 lib/aiUsage.ts 同一份；這裡是畫面端，只為了逐列顯示 */
function cost(c: AiCall): number {
  return ((c.prompt_tokens ?? 0) / 1_000_000) * 0.30
    + (((c.output_tokens ?? 0) + (c.thinking_tokens ?? 0)) / 1_000_000) * 2.50;
}

function Num({ children }: { children: number | null }) {
  return (
    <td className="admin-nums px-3 py-2.5 text-right text-[13px] text-zinc-400">
      {children == null ? "—" : children.toLocaleString()}
    </td>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; name: string; calls: number; tokens: number; costUsd: number; failed: number }[];
}) {
  return (
    <section>
      <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-500">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-zinc-500">本月還沒有資料。</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-baseline gap-2 text-[13px]">
              <span className="min-w-0 truncate text-zinc-400" title={r.name}>{r.name}</span>
              <span aria-hidden className="flex-1 border-b border-dashed border-white/[0.08]" />
              <span className="admin-nums shrink-0 text-zinc-500">{r.calls} 次</span>
              {r.failed > 0 && <span className="admin-nums shrink-0 text-amber-300/80">{r.failed} 失敗</span>}
              <span className="admin-nums shrink-0 text-zinc-500">{kTokens(r.tokens)}</span>
              <span className="admin-nums w-16 shrink-0 text-right text-zinc-300">${usd(r.costUsd)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CallCard({ call }: { call: AiCall }) {
  return (
    <li className="border-b border-white/[0.05] py-3 last:border-b-0">
      <div className="flex items-baseline gap-2">
        <span className="text-[14px] font-semibold text-zinc-100">
          {AI_FEATURE_LABELS[call.feature as keyof typeof AI_FEATURE_LABELS] ?? call.feature}
        </span>
        {!call.ok && (
          <span className="rounded-full bg-rose-400/15 px-1.5 py-px text-[10px] font-bold text-rose-300">失敗</span>
        )}
        <span aria-hidden className="flex-1" />
        <span className="admin-nums text-[13px] text-zinc-200">${usd(cost(call))}</span>
      </div>
      <p className="mt-1 truncate text-[12px] text-zinc-500" title={call.actor_name ?? undefined}>
        {call.actor_name ?? "—"}
      </p>
      <p className="mt-1 text-[12px] text-zinc-600">
        <span className="admin-nums">{(call.prompt_tokens ?? 0).toLocaleString()}</span> 入
        <span aria-hidden className="mx-1 text-zinc-700">·</span>
        <span className="admin-nums">{(call.output_tokens ?? 0).toLocaleString()}</span> 出
        <span aria-hidden className="mx-1 text-zinc-700">·</span>
        <span className="admin-nums">{(call.thinking_tokens ?? 0).toLocaleString()}</span> 思考
        <span aria-hidden className="mx-1 text-zinc-700">·</span>
        {relativeTime(call.created_at)}
      </p>
      {call.error && <p className="mt-1 text-[12px] leading-relaxed text-rose-300/80">{call.error}</p>}
    </li>
  );
}

/** 各自的官方後台。放在自己那張卡後面，才知道點下去看到的是哪一份帳 */
function ConsoleLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="admin-focus mt-2.5 inline-block text-[12px] !text-zinc-500 underline decoration-white/15 underline-offset-2 transition-colors hover:!text-zinc-300"
    >
      {children} ↗
    </a>
  );
}

/**
 * Apify 的額度。
 *
 * 免費方案用完是直接停止服務、不會超收 —— 但停掉的時候分享頁只會說「讀取失敗」，
 * 沒有人會聯想到是額度，所以這個數字要看得到。週期從帳號開通日起算，不是日曆月。
 */
function ApifyBlock({ usage }: { usage: ApifyUsage }) {
  const pct = usage.maxUsd > 0 ? Math.min(100, (usage.usedUsd / usage.maxUsd) * 100) : 0;
  const tight = pct >= 80;
  const until = usage.cycleEnd
    ? new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit" })
        .format(new Date(usage.cycleEnd))
    : null;

  return (
    <section className="mt-6 border-t border-white/[0.05] pt-5">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        Apify（分享抓取）
      </h2>
      <p className="mt-2 flex flex-wrap items-baseline gap-2 text-[17px] font-bold text-zinc-100">
        <span className="admin-nums">${usage.usedUsd.toFixed(3)}</span>
        <span className="text-[13px] font-medium text-zinc-500">
          / 額度 <span className="admin-nums">${usage.maxUsd.toFixed(2)}</span>
        </span>
      </p>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full ${tight ? "bg-amber-400" : "bg-violet-400/70"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2.5 text-[13px] text-zinc-500">
        已用 <span className="admin-nums text-zinc-300">{pct.toFixed(1)}%</span>
        {until && (
          <>
            <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
            本週期到 <span className="admin-nums text-zinc-300">{until}</span>
          </>
        )}
        <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
        用完會停止服務，不會超收
      </p>

      <ConsoleLink href="https://console.apify.com/billing">Apify 用量後台</ConsoleLink>
    </section>
  );
}
