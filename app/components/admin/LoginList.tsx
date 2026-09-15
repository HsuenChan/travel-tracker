"use client";

import { useCallback, useEffect, useState } from "react";
import { App } from "antd";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import EventRow, { type ActivityEvent } from "@/app/components/admin/EventRow";
import EventTable from "@/app/components/admin/EventTable";

export default function LoginList() {
  const { message } = App.useApp();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/logins");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEvents(data.events);
      setNextOffset(data.nextOffset);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const loadMore = async () => {
    if (nextOffset === null) return;
    setLoadingMore(true);
    try {
      const res = await fetchWithAuth(`/api/admin/logins?offset=${nextOffset}`);
      const data = await res.json();
      setEvents((c) => [...c, ...data.events]);
      setNextOffset(data.nextOffset);
    } catch {
      message.error("載入更多失敗");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="pt-6">
      <h1 className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-500">存取紀錄</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
        每一次登入、登出、失敗的嘗試，以及分享連結被打開。點開可以看 IP 與完整的裝置字串。
      </p>

      <div className="mt-5">
        {loading ? (
          <ul aria-hidden className="space-y-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="admin-pulse h-14 rounded-xl bg-white/[0.03]" />
            ))}
          </ul>
        ) : error ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-5 text-[14px] text-rose-200">
            讀不到存取紀錄，請重新整理再試一次。
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] px-5 py-10 text-center">
            <p className="text-[15px] font-semibold text-zinc-300">還沒有存取紀錄</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
              紀錄從這支功能上線後開始累積，下次有人登入或打開分享連結就會出現在這裡。
            </p>
          </div>
        ) : (
          <>
            {isMobile ? (
              <ul>
                {events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
            ) : (
              <EventTable events={events} variant="auth" />
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
