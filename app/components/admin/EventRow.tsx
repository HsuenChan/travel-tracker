"use client";

import { useState } from "react";
import { TRIP_TAB_LABEL } from "@/lib/tripTabs";
import { ActionBadge, DiffValue, absoluteTime, relativeTime } from "@/app/components/admin/parts";
import { ChevronDownIcon, RestoreIcon, ArrowRightIcon } from "@/app/components/Icons";
import { describeDevice } from "@/lib/userAgent";

export interface ActivityEvent {
  id: string;
  /** change：資料異動；auth：登入登出；view：分享連結被打開 */
  kind: "change" | "auth" | "view";
  action: string;
  actor_name: string | null;
  actor_source: string;
  trip_id: string | null;
  trip_name: string | null;
  tab: string | null;
  entity_table: string | null;
  entity_id: string | null;
  entity_label: string | null;
  note: string | null;
  changes: { field: string; label: string; before: unknown; after: unknown }[] | null;
  snapshot: Record<string, unknown> | null;
  restored_from: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export const TAB_LABEL: Record<string, string> = { ...TRIP_TAB_LABEL, trip: "旅程設定" };

/** 新增沒有還原（撤銷新增就是刪除，那件事在 app 裡做），沒有快照的批次操作也還不了 */
export function canRestore(e: ActivityEvent): boolean {
  return e.kind === "change" && e.action !== "create" && e.action !== "restore" && !!e.snapshot;
}

/** 沒有欄位變化、沒有備註的資料異動點開只會是一片空白，那就不給點 */
export function isExpandable(e: ActivityEvent): boolean {
  return (e.changes?.length ?? 0) > 0 || !!e.note || e.kind === "auth" || e.kind === "view";
}

/**
 * 展開後看到的東西：欄位 diff、登入細節、備註。
 * 手機的列與電腦版的表格共用同一份，不然兩邊的 diff 遲早長成兩種樣子。
 */
export function EventDetail({ event }: { event: ActivityEvent }) {
  const changes = event.changes ?? [];
  const isAuth = event.kind === "auth";

  return (
    <>
      {event.note && <p className="mb-2 text-zinc-400">{event.note}</p>}

      {changes.length > 0 && (
        <dl className="space-y-1.5">
          {changes.map((c) => (
            <div key={c.field} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
              <dt className="shrink-0 text-zinc-500 sm:w-20 sm:text-right">{c.label}</dt>
              <dd className="flex min-w-0 flex-1 flex-wrap items-baseline gap-1.5">
                <DiffValue value={c.before} tone="before" />
                <ArrowRightIcon size={11} className="shrink-0 text-zinc-600" />
                <DiffValue value={c.after} tone="after" />
              </dd>
            </div>
          ))}
        </dl>
      )}

      {(isAuth || event.kind === "view") && (
        <dl className="space-y-1 text-zinc-400">
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-right text-zinc-500">時間</dt>
            <dd className="admin-nums">{absoluteTime(event.created_at)}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-right text-zinc-500">IP</dt>
            <dd className="admin-nums">{event.ip ?? "未知"}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-right text-zinc-500">裝置</dt>
            <dd className="min-w-0 break-words">{event.user_agent ?? "未知"}</dd>
          </div>
        </dl>
      )}

      {!isAuth && event.kind !== "view" && changes.length === 0 && !event.note && (
        <p className="text-zinc-500">這次異動沒有記錄到欄位變化。</p>
      )}
    </>
  );
}

export default function EventRow({
  event,
  onRestore,
  restoring,
}: {
  event: ActivityEvent;
  onRestore?: (event: ActivityEvent) => void;
  restoring?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isAuth = event.kind === "auth";
  const expandable = isExpandable(event);

  // 分享瀏覽跟登入一樣是「存取」，看的是裝置與 IP；但標題要放旅程名稱而不是訪客字樣
  const isView = event.kind === "view";

  const meta = isAuth || isView
    ? [describeDevice(event.user_agent), event.ip, relativeTime(event.created_at)]
    : [event.trip_name, event.tab ? TAB_LABEL[event.tab] ?? event.tab : null, relativeTime(event.created_at)];

  const headline = isView
    ? event.trip_name ?? "（未命名旅程）"
    : isAuth
      ? event.actor_name ?? "未知帳號"
      : event.entity_label ?? event.entity_table ?? "（未命名）";

  return (
    <li className="border-b border-white/[0.05] last:border-b-0">
      <div className="flex items-start gap-2 py-3">
        <button
          type="button"
          onClick={() => expandable && setOpen((v) => !v)}
          aria-expanded={expandable ? open : undefined}
          disabled={!expandable}
          className={`admin-focus -mx-2 min-w-0 flex-1 rounded-xl px-2 py-1 text-left transition-colors ${
            expandable ? "cursor-pointer hover:bg-white/[0.03]" : "cursor-default"
          }`}
        >
          <div className="flex items-center gap-2">
            <ActionBadge action={event.action} />
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-zinc-100">
              {headline}
            </span>
            {expandable && (
              <ChevronDownIcon
                size={12}
                className={`shrink-0 text-zinc-600 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
              />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-zinc-500">
            {meta.filter(Boolean).map((m, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden className="text-zinc-700">·</span>}
                <span className={i === meta.length - 1 ? "admin-nums" : ""}>{m}</span>
              </span>
            ))}
            {event.actor_source !== "web" && (
              <span className="ml-1 rounded-full bg-white/[0.06] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                {event.actor_source}
              </span>
            )}
          </div>
        </button>

        {onRestore && canRestore(event) && (
          <button
            type="button"
            onClick={() => onRestore(event)}
            disabled={restoring}
            className="admin-focus mt-0.5 flex shrink-0 items-center gap-1 rounded-full border border-amber-300/25 px-2.5 py-1 text-[12px] font-semibold text-amber-200/90 transition-colors hover:border-amber-300/50 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RestoreIcon size={12} />
            {restoring ? "還原中" : "還原"}
          </button>
        )}
      </div>

      {open && (
        <div className="admin-reveal pb-3 pl-1 text-[13px]">
          <EventDetail event={event} />
        </div>
      )}
    </li>
  );
}
