"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { App } from "antd";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { QUERY_CHIPS } from "@/lib/activityQuery";
import { SearchIcon, CloseIcon, ArrowDownIcon } from "@/app/components/Icons";
import EventRow, { type ActivityEvent } from "@/app/components/admin/EventRow";
import EventTable from "@/app/components/admin/EventTable";
import { useRestoreEvent } from "@/app/components/admin/useRestoreEvent";

const POLL_MS = 20_000;

/**
 * 這一頁只看行程異動。登入／登出／登入失敗是 kind=auth，有自己的「登入」分頁。
 *
 * API 沒收到 kind 就會把兩種都撈回來 —— 漏傳這個參數時，登入紀錄會混進異動清單，
 * 而這一頁的篩選 chips 根本沒有登入相關的選項，篩不掉也解釋不了。
 */
const KIND = "kind=change";

export default function ActivityConsole() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [defaultWindow, setDefaultWindow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 正在讀的東西不准被新事件擠走：新的先排在這裡，等使用者自己決定何時收下
  const [pending, setPending] = useState<ActivityEvent[]>([]);

  const queryRef = useRef(query);
  queryRef.current = query;

  // 表格只在電腦版出現：六欄在 375px 下只能橫捲，手機一律回到 EventRow 的列
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/admin/activity?${KIND}&q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("讀取失敗");
      const data = await res.json();
      setEvents(data.events);
      setNextOffset(data.nextOffset);
      setDefaultWindow(data.defaultWindow);
      setPending([]);
    } catch {
      setError("讀不到異動紀錄，請重新整理再試一次。");
    } finally {
      setLoading(false);
    }
  }, []);

  // 打字停 300ms 才查，順手把查詢寫進網址，這樣一條連結就能把「怎麼找到的」傳給未來的自己
  useEffect(() => {
    const t = setTimeout(() => {
      load(query);
      const url = query ? `/admin/activity?q=${encodeURIComponent(query)}` : "/admin/activity";
      router.replace(url, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [query, load, router]);

  // 背景輪詢只負責「告訴你有新的」，不動畫面上的任何一列
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetchWithAuth(`/api/admin/activity?${KIND}&q=${encodeURIComponent(queryRef.current)}`);
        if (!res.ok) return;
        const data = await res.json();
        setEvents((current) => {
          const known = new Set(current.map((e) => e.id));
          const fresh = (data.events as ActivityEvent[]).filter((e) => !known.has(e.id));
          if (fresh.length) setPending(fresh);
          return current;
        });
      } catch {
        // 輪詢失敗不用打擾使用者，下一輪再試
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const acceptPending = () => {
    setEvents((current) => {
      const known = new Set(current.map((e) => e.id));
      return [...pending.filter((e) => !known.has(e.id)), ...current];
    });
    setPending([]);
  };

  const loadMore = async () => {
    if (nextOffset === null) return;
    setLoadingMore(true);
    try {
      const res = await fetchWithAuth(
        `/api/admin/activity?${KIND}&q=${encodeURIComponent(query)}&offset=${nextOffset}`
      );
      const data = await res.json();
      setEvents((current) => [...current, ...data.events]);
      setNextOffset(data.nextOffset);
    } catch {
      message.error("載入更多失敗");
    } finally {
      setLoadingMore(false);
    }
  };

  const { restore, restoringId } = useRestoreEvent(() => load(query));

  const addChip = (token: string) => {
    setQuery((q) => (q.includes(token) ? q : `${q} ${token}`.trim()));
  };

  return (
    <div className="pt-6">
      <h1 className="sr-only">異動紀錄</h1>

      <div className="relative">
        <SearchIcon
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="找一筆異動：名稱、旅程，或 action:delete"
          aria-label="查詢異動紀錄"
          autoComplete="off"
          className="admin-focus h-14 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] pl-12 pr-11 text-[16px] text-zinc-100 placeholder:text-zinc-600 transition-colors hover:border-white/[0.14] focus:border-violet-400/40"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="清除查詢"
            className="admin-focus absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
          >
            <CloseIcon size={13} />
          </button>
        )}
      </div>

      <div className="chip-row -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {QUERY_CHIPS.map((chip) => {
          const on = query.includes(chip.token);
          return (
            <button
              key={chip.token}
              type="button"
              onClick={() => addChip(chip.token)}
              aria-pressed={on}
              className={`admin-focus shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                on
                  ? "bg-violet-400/15 text-violet-200 ring-1 ring-inset ring-violet-400/30"
                  : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {defaultWindow && !loading && (
        <p className="mt-4 text-[12px] text-zinc-600">顯示最近 24 小時。要看更早的，打個關鍵字或按「近 7 天」。</p>
      )}

      {pending.length > 0 && (
        <button
          type="button"
          onClick={acceptPending}
          className="admin-focus admin-reveal mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/10 py-2 text-[13px] font-semibold text-violet-200 transition-colors hover:bg-violet-400/16"
        >
          <ArrowDownIcon size={12} />
          {pending.length} 筆新異動
        </button>
      )}

      <div className="mt-4">
        {loading ? (
          <ul aria-hidden className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="admin-pulse h-14 rounded-xl bg-white/[0.03]" />
            ))}
          </ul>
        ) : error ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-5 text-[14px] text-rose-200">
            {error}
          </div>
        ) : events.length === 0 ? (
          <EmptyState query={query} />
        ) : (
          <>
            {isMobile ? (
              <ul>
                {events.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onRestore={restore}
                    restoring={restoringId === event.id}
                  />
                ))}
              </ul>
            ) : (
              <EventTable
                events={events}
                variant="change"
                onRestore={restore}
                restoringId={restoringId}
              />
            )}

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
      </div>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] px-5 py-10 text-center">
      <p className="text-[15px] font-semibold text-zinc-300">
        {query ? "這個條件找不到東西" : "最近 24 小時沒有任何異動"}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
        {query
          ? "換個關鍵字，或把條件拿掉一個再試。"
          : "紀錄從這支功能上線後開始累積；在旅程裡改一筆東西，它就會出現在這裡。"}
      </p>
    </div>
  );
}
