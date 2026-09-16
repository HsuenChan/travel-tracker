"use client";

import { useCallback, useEffect, useState } from "react";
import { Tooltip } from "antd";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { describeDevice } from "@/lib/userAgent";
import { relativeTime } from "@/app/components/admin/parts";
import EventRow, { type ActivityEvent } from "@/app/components/admin/EventRow";
import { useRestoreEvent } from "@/app/components/admin/useRestoreEvent";
import { ShieldIcon, LaptopIcon, ArrowRightIcon, SparkleIcon, AlertTriangleIcon, HealthIcon, PhotoIcon } from "@/app/components/Icons";
import { formatBytes, type StorageStats } from "@/lib/storageUsage";

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
    byActor: { name: string; calls: number; tokens: number; costUsd: number }[];
  } | null;
  /** api_errors 是 22_api_errors.sql 才有的表，還沒跑 migration 時是 null */
  errors: {
    last: { message: string; route_path: string | null; created_at: string } | null;
    count24h: number;
    count7d: number;
  } | null;
  /** 讀不到 Storage 時是 null */
  storage: StorageStats | null;
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

  const { logins, recentChanges, ai, errors, storage } = data;
  /*
    小額要多給幾位小數。toFixed(2) 會把 $0.0012 顯示成「$0.00」—— 在一個專門用來
    盯花費的區塊裡寫「沒花錢」是最不該出的錯。
  */
  const usd = (n: number) => (n > 0 && n < 1 ? n.toFixed(3) : n.toFixed(2));
  // 超過上限時整區轉成琥珀色，跟登入那邊「可疑」的視覺語彙一致
  const overBudget = !!ai && ai.budgetUsd > 0 && ai.monthCostUsd >= ai.budgetUsd;
  const storagePct = storage ? (storage.totalBytes / storage.limitBytes) * 100 : 0;
  const storageTight = storagePct >= 80;
  const suspicious = logins.failed30d > 0;

  return (
    <div className="pt-6">
      <h1 className="sr-only">後台總覽</h1>

      {/*
        電腦版把四張摘要卡排成一列：各自獨佔一整列會讓首屏要捲好幾次才看得到最新異動，
        而三欄會讓第四張單獨掉到下一行。手機維持上下堆疊。

        刻意不加 items-start：grid 預設的 stretch 會讓同一列的卡一樣高，邊框才對得齊。
      */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-x-4">
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5">
          <SectionHead title="登入狀態" href="/admin/logins" />
          {logins.last ? (
            <CardBody
              headline={
                <>
                  <ShieldIcon size={15} className={`shrink-0 ${suspicious ? "text-amber-300" : "text-emerald-300"}`} />
                  <span className="truncate">{relativeTime(logins.last.created_at)}登入</span>
                </>
              }
            >
              <p className="flex items-center gap-1.5 truncate text-[13px] text-zinc-400">
                <LaptopIcon size={13} className="shrink-0 text-zinc-600" />
                <span className="truncate">
                  {describeDevice(logins.last.user_agent)}
                  {logins.last.ip && <span className="admin-nums text-zinc-500"> · {logins.last.ip}</span>}
                </span>
              </p>
              <p className="text-[13px] text-zinc-500">
                30 天內 <span className="admin-nums text-zinc-300">{logins.count30d}</span> 次
                <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
                <span className="admin-nums text-zinc-300">{logins.deviceCount}</span> 台裝置
                {logins.failed30d > 0 && (
                  <>
                    <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
                    <span className={suspicious ? "font-semibold text-amber-300" : ""}>
                      <span className="admin-nums">{logins.failed30d}</span> 次失敗
                    </span>
                  </>
                )}
              </p>
            </CardBody>
          ) : (
            <CardBody headline={<span className="text-zinc-400">還沒有登入紀錄</span>}>
              <p className="text-[13px] text-zinc-500">下次登入就會出現在這裡</p>
            </CardBody>
          )}
        </section>

        {ai && (
          <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5">
            <SectionHead title="AI 用量" href="/admin/ai" />
                {ai.monthCalls === 0 ? (
                  <CardBody headline={<span className="text-zinc-400">本月沒有呼叫</span>}>
                    <p className="text-[13px] text-zinc-500">用到 AI 功能時會出現在這裡</p>
                  </CardBody>
                ) : (
                  <CardBody
                    headline={
                      <>
                        <SparkleIcon size={15} className={`shrink-0 ${overBudget ? "text-amber-300" : "text-violet-300"}`} />
                        <span className="admin-nums">${usd(ai.monthCostUsd)}</span>
                        {ai.budgetUsd > 0 && (
                          <span className="whitespace-nowrap text-[13px] font-medium text-zinc-500">
                            / 上限 <span className="admin-nums">${usd(ai.budgetUsd)}</span>
                          </span>
                        )}
                      </>
                    }
                    meter={ai.budgetUsd > 0 ? { pct: (ai.monthCostUsd / ai.budgetUsd) * 100, tight: overBudget } : undefined}
                  >
                    <p className="text-[13px] text-zinc-400">本月估計</p>
                    <p className="text-[13px] text-zinc-500">
                      本月 <span className="admin-nums text-zinc-300">{ai.monthCalls}</span> 次
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
                  </CardBody>
                )}
              </section>
        )}

        {storage && (
          <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5">
            <SectionHead title="圖片儲存" href="/admin/storage" />
            <CardBody
              headline={
                <>
                  <PhotoIcon size={15} stroke={storageTight ? "#fcd34d" : "#a78bfa"} />
                  <span className="admin-nums">{formatBytes(storage.totalBytes)}</span>
                  <span className="whitespace-nowrap text-[13px] font-medium text-zinc-500">
                    / 上限 <span className="admin-nums">1 GB</span>
                  </span>
                </>
              }
              meter={{ pct: storagePct, tight: storageTight }}
            >
              <p className="text-[13px] text-zinc-400">
                已用 <span className="admin-nums">{storagePct < 0.1 ? "<0.1" : storagePct.toFixed(1)}%</span>
              </p>
              <p className="text-[13px] text-zinc-500">
                <span className="admin-nums text-zinc-300">{storage.totalFiles}</span> 個檔案
                {storage.orphanFiles > 0 && (
                  <>
                    <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
                    <span className="font-semibold text-amber-300">
                      <span className="admin-nums">{storage.orphanFiles}</span> 個可清理
                    </span>
                  </>
                )}
              </p>
            </CardBody>
          </section>
        )}

        {errors && (
          <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5">
            <SectionHead title="異常" href="/admin/errors" />
            {errors.last ? (
              <CardBody
                headline={
                  <>
                    <AlertTriangleIcon size={15} className="shrink-0 text-rose-400" />
                    <span className="truncate">{relativeTime(errors.last.created_at)}</span>
                  </>
                }
              >
                <p className="truncate text-[13px] text-zinc-400" title={errors.last.message}>
                  {errors.last.message}
                  {errors.last.route_path && (
                    <span className="admin-nums text-zinc-600"> · {errors.last.route_path}</span>
                  )}
                </p>
                <p className="text-[13px] text-zinc-500">
                  {/* 24 小時內有錯就轉紅：那是「現在正在壞」而不是「上週壞過」 */}
                  <span className={errors.count24h > 0 ? "font-semibold text-rose-300" : ""}>
                    24 小時內 <span className="admin-nums">{errors.count24h}</span> 筆
                  </span>
                  <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
                  7 天內 <span className="admin-nums text-zinc-300">{errors.count7d}</span> 筆
                </p>
              </CardBody>
            ) : (
              /* 心電圖折線講的是「還活著」，跟登入的盾牌、AI 的閃光不撞；
                 用翠綠而不是紅，這是好消息不是警報 */
              <CardBody
                headline={
                  <>
                    <HealthIcon size={15} className="shrink-0 text-emerald-300" />
                    沒有異常
                  </>
                }
              >
                <p className="text-[13px] text-zinc-500">7 天內沒有未捕捉的例外</p>
              </CardBody>
            )}
          </section>
        )}
      </div>

      <hr className="my-7 border-white/[0.06]" />

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

/** 每一張卡都掛一次「查看全部」，同一個畫面上會重複五遍；留箭頭就好，說明走 tooltip */
/**
 * 四張卡共用的排版：標題行、量表列、內文。
 *
 * 量表列固定高度，沒有進度條的卡留一個同高的空位 —— 不然有進度條的卡會把後面每一行往下推，
 * 四張並排時每一行都錯開。
 */
function CardBody({
  headline, meter, children,
}: {
  headline: React.ReactNode;
  meter?: { pct: number; tight: boolean };
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2">
      <p className="flex h-6 items-center gap-2 text-[16px] font-bold text-zinc-100">{headline}</p>
      <div className="mt-2.5 h-1.5">
        {meter && (
          <div className="h-full w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${meter.tight ? "bg-amber-400" : "bg-violet-400/70"}`}
              style={{ width: `${Math.min(100, meter.pct)}%` }}
            />
          </div>
        )}
      </div>
      <div className="mt-2.5 space-y-1.5">{children}</div>
    </div>
  );
}

function SectionHead({ title, href }: { title: string; href: string }) {
  const label = `進入${title}頁面`;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-500">{title}</h2>
      <Tooltip title={label} placement="left" trigger={["hover", "click"]}>
        <Link
          href={href}
          aria-label={label}
          className="admin-focus flex h-7 w-7 shrink-0 items-center justify-center rounded-full !text-violet-300/80 transition-colors hover:!bg-violet-400/10 hover:!text-violet-200"
        >
          <ArrowRightIcon size={12} />
        </Link>
      </Tooltip>
    </div>
  );
}
