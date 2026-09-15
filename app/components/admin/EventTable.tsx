"use client";

import { Fragment, useState } from "react";
import { describeDevice } from "@/lib/userAgent";
import { ActionBadge, absoluteTime, relativeTime } from "@/app/components/admin/parts";
import {
  EventDetail,
  TAB_LABEL,
  canRestore,
  isExpandable,
  type ActivityEvent,
} from "@/app/components/admin/EventRow";
import { ChevronDownIcon, RestoreIcon } from "@/app/components/Icons";

/**
 * 電腦版的事件表格。
 *
 * 同一批事件在手機上是 EventRow 的列、在電腦上是這張表：欄位對齊之後，
 * 「這半天刪了哪些」「哪幾筆是同一趟旅程」用掃的就看得出來，不必逐列重讀。
 * 展開的 diff 與還原都還在原地發生，只是從列變成 colspan 的細節列。
 */
export default function EventTable({
  events,
  variant,
  onRestore,
  restoringId,
}: {
  events: ActivityEvent[];
  variant: "change" | "auth";
  onRestore?: (event: ActivityEvent) => void;
  restoringId?: string | null;
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const showRestore = variant === "change" && !!onRestore;

  const toggle = (id: string) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const headers =
    variant === "auth"
      ? ["動作", "帳號／旅程", "裝置", "IP", "時間"]
      : ["動作", "對象", "旅程", "分頁", "時間", ...(showRestore ? ["還原"] : [])];

  const colWidths =
    variant === "auth"
      ? ["6rem", "auto", "11rem", "10rem", "8rem"]
      : ["5rem", "auto", "9rem", "6rem", "7rem", ...(showRestore ? ["6.5rem"] : [])];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <table className="w-full table-fixed text-left">
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} style={w === "auto" ? undefined : { width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-white/[0.08]">
            {headers.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-600 ${
                  i >= headers.length - (showRestore ? 2 : 1) ? "text-right" : ""
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const open = openIds.has(event.id);
            const expandable = isExpandable(event);
            const isAuth = event.kind === "auth";
            const restorable = showRestore && canRestore(event);

            /*
              分享瀏覽（kind='view'）沒有 entity，要看的是「哪一趟旅程被打開了」。
              少了這一支，它會掉進 change 的分支顯示成「（未命名）」。
            */
            const label = event.kind === "view"
              ? event.trip_name ?? "（未命名旅程）"
              : isAuth
                ? event.actor_name ?? "未知帳號"
                : event.entity_label ?? event.entity_table ?? "（未命名）";

            return (
              <Fragment key={event.id}>
                <tr
                  tabIndex={expandable ? 0 : undefined}
                  aria-expanded={expandable ? open : undefined}
                  onClick={() => expandable && toggle(event.id)}
                  onKeyDown={(e) => {
                    if (!expandable) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(event.id);
                    }
                  }}
                  className={`admin-focus transition-colors ${
                    expandable ? "cursor-pointer hover:bg-white/[0.03]" : ""
                  } ${open ? "" : "border-b border-white/[0.05]"}`}
                >
                  <td className="px-4 py-2.5 align-middle">
                    <ActionBadge action={event.action} />
                  </td>

                  <td className="px-4 py-2.5 align-middle">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13px] font-semibold text-zinc-100" title={label}>
                        {label}
                      </span>
                      {event.actor_source !== "web" && (
                        <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                          {event.actor_source}
                        </span>
                      )}
                      {expandable && (
                        <ChevronDownIcon
                          size={11}
                          className={`shrink-0 text-zinc-600 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                        />
                      )}
                    </div>
                  </td>

                  {isAuth || variant === "auth" ? (
                    <>
                      <Cell title={describeDevice(event.user_agent)}>{describeDevice(event.user_agent)}</Cell>
                      <Cell nums>{event.ip ?? <Blank />}</Cell>
                    </>
                  ) : (
                    <>
                      <Cell title={event.trip_name ?? undefined}>{event.trip_name ?? <Blank />}</Cell>
                      <Cell>{event.tab ? TAB_LABEL[event.tab] ?? event.tab : <Blank />}</Cell>
                    </>
                  )}

                  <td
                    className="admin-nums px-4 py-2.5 text-right align-middle text-[13px] text-zinc-400"
                    title={absoluteTime(event.created_at)}
                  >
                    {relativeTime(event.created_at)}
                  </td>

                  {showRestore && (
                    <td className="px-3 py-2.5 text-right align-middle">
                      {restorable && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestore?.(event);
                          }}
                          disabled={restoringId === event.id}
                          className="admin-focus inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-300/25 px-2.5 py-1 text-[12px] font-semibold text-amber-200/90 transition-colors hover:border-amber-300/50 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <RestoreIcon size={12} />
                          {restoringId === event.id ? "還原中" : "還原"}
                        </button>
                      )}
                    </td>
                  )}
                </tr>

                {open && (
                  <tr className="border-b border-white/[0.05]">
                    <td colSpan={headers.length} className="px-4 pb-3 pt-0">
                      <div className="admin-reveal text-[13px]">
                        <EventDetail event={event} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cell({
  children,
  title,
  nums,
}: {
  children: React.ReactNode;
  title?: string;
  nums?: boolean;
}) {
  return (
    <td
      className={`truncate px-4 py-2.5 align-middle text-[13px] text-zinc-400 ${nums ? "admin-nums" : ""}`}
      title={title}
    >
      {children}
    </td>
  );
}

function Blank() {
  return <span className="text-zinc-700">—</span>;
}
