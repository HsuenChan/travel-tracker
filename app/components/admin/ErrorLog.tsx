"use client";

import { useCallback, useEffect, useState } from "react";
import { relativeTime } from "@/app/components/admin/parts";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { describeDevice } from "@/lib/userAgent";
import { AlertTriangleIcon, ChevronDownIcon } from "@/app/components/Icons";

interface ApiError {
  id: string;
  path: string;
  method: string | null;
  route_path: string | null;
  route_type: string | null;
  message: string;
  stack: string | null;
  digest: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export default function ErrorLog() {
  const [errors, setErrors] = useState<ApiError[] | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/errors");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setErrors(data.errors);
      setNextOffset(data.nextOffset);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (nextOffset === null) return;
    setLoadingMore(true);
    try {
      const res = await fetchWithAuth(`/api/admin/errors?offset=${nextOffset}`);
      const data = await res.json();
      setErrors((c) => [...(c ?? []), ...data.errors]);
      setNextOffset(data.nextOffset);
    } catch {
      // 載更多失敗不用清掉已經讀到的
    } finally {
      setLoadingMore(false);
    }
  };

  const toggle = (id: string) =>
    setOpenIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div className="pt-6">
      <h1 className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-500">異常紀錄</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
        伺服器端未捕捉的例外。點開可以看完整的 stack。
        同一支路由的同一個錯誤 5 分鐘內只記一筆，所以這裡的筆數不是發生次數。
      </p>

      <div className="mt-5">
        {loading ? (
          <ul aria-hidden className="space-y-3">
            {[0, 1, 2].map((i) => <li key={i} className="admin-pulse h-14 rounded-xl bg-white/[0.03]" />)}
          </ul>
        ) : failed ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-5 text-[14px] text-rose-200">
            讀不到異常紀錄，請重新整理再試一次。
          </div>
        ) : errors === null ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] px-5 py-10 text-center">
            <p className="text-[15px] font-semibold text-zinc-300">還沒建立異常紀錄資料表</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">請先執行 supabase/22_api_errors.sql。</p>
          </div>
        ) : errors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] px-5 py-10 text-center">
            <p className="text-[15px] font-semibold text-zinc-300">沒有異常</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
              伺服器目前沒有拋出未捕捉的例外。這一頁空著是好事。
            </p>
          </div>
        ) : (
          <>
            <ul className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              {errors.map((e) => {
                const open = openIds.has(e.id);
                return (
                  <li key={e.id} className="border-b border-white/[0.05] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => toggle(e.id)}
                      aria-expanded={open}
                      className="admin-focus flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <span className="mt-0.5 shrink-0 text-rose-400"><AlertTriangleIcon size={14} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-zinc-100" title={e.message}>
                          {e.message}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-zinc-500">
                          {e.method && (
                            <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[10px] font-bold tracking-wide text-zinc-400">
                              {e.method}
                            </span>
                          )}
                          <span className="admin-nums truncate" title={e.path}>{e.route_path ?? e.path}</span>
                          <span aria-hidden className="text-zinc-700">·</span>
                          <span>{relativeTime(e.created_at)}</span>
                        </span>
                      </span>
                      <ChevronDownIcon
                        size={13}
                        className={`mt-1 shrink-0 text-zinc-600 transition-transform ${open ? "rotate-180" : ""}`}
                      />
                    </button>

                    {open && (
                      <div className="border-t border-white/[0.05] bg-black/20 px-4 py-3">
                        <dl className="flex flex-col gap-1.5 text-[12px]">
                          <Row label="請求路徑">{e.path}</Row>
                          {e.route_path && <Row label="路由檔">{e.route_path}</Row>}
                          {e.route_type && <Row label="類型">{e.route_type}</Row>}
                          {e.digest && <Row label="指紋">{e.digest}</Row>}
                          {e.ip && <Row label="IP">{e.ip}</Row>}
                          {e.user_agent && <Row label="裝置">{describeDevice(e.user_agent)}</Row>}
                        </dl>
                        {e.stack && (
                          <pre className="mt-2.5 max-h-72 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-400">
                            {e.stack}
                          </pre>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
      <dt className="text-zinc-600">{label}</dt>
      <dd className="admin-nums m-0 min-w-0 break-all text-zinc-400">{children}</dd>
    </div>
  );
}
