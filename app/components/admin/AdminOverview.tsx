"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { describeDevice } from "@/lib/userAgent";
import { relativeTime } from "@/app/components/admin/parts";
import EventRow, { type ActivityEvent } from "@/app/components/admin/EventRow";
import { useRestoreEvent } from "@/app/components/admin/useRestoreEvent";
import { ShieldIcon, LaptopIcon, ArrowRightIcon, SparkleIcon } from "@/app/components/Icons";

interface Overview {
  logins: {
    last: { action: string; ip: string | null; user_agent: string | null; actor_name: string | null; created_at: string } | null;
    count30d: number;
    deviceCount: number;
    failed30d: number;
  };
  /** ai_usage 是 20_ai_usage.sql 才有的表，還沒跑 migration 時是 null */
  ai: {
    budgetUsd: number;
    monthCalls: number;
    monthFailed: number;
    todayCalls: number;
    monthTokens: number;
    monthCostUsd: number;
    byFeature: { key: string; label: string; calls: number; failed: number; costUsd: number }[];
  } | null;
  recentChanges: ActivityEvent[];
}

export default function AdminOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/overview");
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { restore, restoringId } = useRestoreEvent(load);

  if (error) {
    return (
      <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-5 text-[14px] text-rose-200">
        讀不到後台資料，請重新整理再試一次。
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mt-6 space-y-6">
        <div className="admin-pulse h-28 rounded-2xl bg-white/[0.03]" />
        <div className="admin-pulse h-48 rounded-2xl bg-white/[0.03]" />
      </div>
    );
  }

  const { logins, recentChanges, ai } = data;
  /*
    小額要多給幾位小數。toFixed(2) 會把 $0.0012 顯示成「$0.00」—— 在一個專門用來
    盯花費的區塊裡寫「沒花錢」是最不該出的錯。
  */
  const usd = (n: number) => (n > 0 && n < 1 ? n.toFixed(3) : n.toFixed(2));
  // 超過上限時整區轉成琥珀色，跟登入那邊「可疑」的視覺語彙一致
  const overBudget = !!ai && ai.budgetUsd > 0 && ai.monthCostUsd >= ai.budgetUsd;
  const suspicious = logins.failed30d > 0;

  return (
    <div className="pt-6">
      <h1 className="sr-only">後台總覽</h1>

      <section>
        <SectionHead title="登入狀態" href="/admin/logins" />
        {logins.last ? (
          <div className="mt-2">
            <p className="flex items-center gap-2 text-[17px] font-bold text-zinc-100">
              <ShieldIcon size={15} className={suspicious ? "text-amber-300" : "text-emerald-300"} />
              最近一次登入 {relativeTime(logins.last.created_at)}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-zinc-400">
              <LaptopIcon size={13} className="text-zinc-600" />
              <span>{describeDevice(logins.last.user_agent)}</span>
              {logins.last.ip && (
                <>
                  <span aria-hidden className="text-zinc-700">·</span>
                  <span className="admin-nums">{logins.last.ip}</span>
                </>
              )}
            </p>
            <p className="mt-2.5 text-[13px] text-zinc-500">
              30 天內 <span className="admin-nums text-zinc-300">{logins.count30d}</span> 次登入
              <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
              <span className="admin-nums text-zinc-300">{logins.deviceCount}</span> 台裝置
              <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
              <span className={suspicious ? "font-semibold text-amber-300" : ""}>
                <span className="admin-nums">{logins.failed30d}</span> 次失敗
              </span>
            </p>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-zinc-500">還沒有登入紀錄。下次登入就會出現在這裡。</p>
        )}
      </section>

      <hr className="my-7 border-white/[0.06]" />

      {/*
        AI 用量。專案用的是 Gemini 付費層，一天 10,000 次的速率上限實際只用到個位數 ——
        所以這裡盯的是花費而不是次數，估計金額才是會先出事的那個數字。
      */}
      {ai && (
        <>
          <section>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-500">AI 用量</h2>
            {ai.monthCalls === 0 ? (
              <p className="mt-2 text-[13px] text-zinc-500">本月還沒有 AI 呼叫。</p>
            ) : (
              <div className="mt-2">
                <p className="flex items-center gap-2 text-[17px] font-bold text-zinc-100">
                  <SparkleIcon size={15} className={overBudget ? "text-amber-300" : "text-violet-300"} />
                  本月估計 <span className="admin-nums">${usd(ai.monthCostUsd)}</span>
                  {ai.budgetUsd > 0 && (
                    <span className="text-[13px] font-medium text-zinc-500">
                      / 上限 <span className="admin-nums">${usd(ai.budgetUsd)}</span>
                    </span>
                  )}
                </p>

                {ai.budgetUsd > 0 && (
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full ${overBudget ? "bg-amber-400" : "bg-violet-400/70"}`}
                      style={{ width: `${Math.min(100, (ai.monthCostUsd / ai.budgetUsd) * 100)}%` }}
                    />
                  </div>
                )}

                <p className="mt-2.5 text-[13px] text-zinc-500">
                  本月 <span className="admin-nums text-zinc-300">{ai.monthCalls}</span> 次
                  <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
                  今日 <span className="admin-nums text-zinc-300">{ai.todayCalls}</span> 次
                  <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
                  <span className="admin-nums text-zinc-300">{(ai.monthTokens / 1000).toFixed(1)}K</span> tokens
                  {ai.monthFailed > 0 && (
                    <>
                      <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
                      {/* 失敗次數要看得到：被擋下來時也是失敗，只看成功數會以為用量很低 */}
                      <span className="font-semibold text-amber-300">
                        <span className="admin-nums">{ai.monthFailed}</span> 次失敗
                      </span>
                    </>
                  )}
                </p>

                <ul className="mt-3 flex flex-col gap-1.5">
                  {ai.byFeature.map((f) => (
                    <li key={f.key} className="flex items-baseline gap-2 text-[13px]">
                      <span className="text-zinc-400">{f.label}</span>
                      <span aria-hidden className="flex-1 border-b border-dashed border-white/[0.08]" />
                      <span className="admin-nums text-zinc-500">{f.calls} 次</span>
                      {f.failed > 0 && <span className="admin-nums text-amber-300/80">{f.failed} 失敗</span>}
                      <span className="admin-nums w-16 text-right text-zinc-300">${usd(f.costUsd)}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
                  金額依 Gemini 2.5 Flash 的公告費率換算（輸入 $0.30、輸出 $2.50 / 百萬 token），
                  是估計值不是帳單金額。上限由 AI_MONTHLY_BUDGET_USD 設定，超過時 AI 功能會先停用。
                </p>
              </div>
            )}
          </section>

          <hr className="my-7 border-white/[0.06]" />
        </>
      )}

      <section>
        <SectionHead title="最新異動" href="/admin/activity" />
        {recentChanges.length > 0 ? (
          <ul className="mt-1">
            {recentChanges.map((event) => (
              <EventRow key={event.id} event={event} onRestore={restore} restoring={restoringId === event.id} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
            還沒有任何異動紀錄。在旅程裡改一筆東西，它就會出現在這裡。
          </p>
        )}
      </section>
    </div>
  );
}

function SectionHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-500">{title}</h2>
      <Link
        href={href}
        className="admin-focus flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[13px] font-semibold !text-violet-300/90 transition-colors hover:!bg-violet-400/10 hover:!text-violet-200"
      >
        查看全部
        <ArrowRightIcon size={11} />
      </Link>
    </div>
  );
}
