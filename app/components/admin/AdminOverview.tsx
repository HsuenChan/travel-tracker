"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { describeDevice } from "@/lib/userAgent";
import { relativeTime } from "@/app/components/admin/parts";
import EventRow, { type ActivityEvent } from "@/app/components/admin/EventRow";
import { useRestoreEvent } from "@/app/components/admin/useRestoreEvent";
import { ShieldIcon, LaptopIcon, ArrowRightIcon } from "@/app/components/Icons";

interface Overview {
  logins: {
    last: { action: string; ip: string | null; user_agent: string | null; actor_name: string | null; created_at: string } | null;
    count30d: number;
    deviceCount: number;
    failed30d: number;
  };
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

  const { logins, recentChanges } = data;
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
