"use client";

import { useState, useEffect, useCallback } from "react";
import { App } from "antd";
import { PhotoIcon } from "@/app/components/Icons";
import { formatBytes, type StorageStats } from "@/lib/storageUsage";

/**
 * 不在刪除行程時連帶刪檔：同一個 URL 可能被多筆行程共用（複製行程時照片只複製連結），
 * 刪一筆就刪檔會把別人那趟的圖弄破。所以改成孤兒清理。
 */
export default function StorageConsole() {
  const { modal, message } = App.useApp();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/storage", { cache: "no-store" });
      if (!res.ok) { setError(true); return; }
      const data = await res.json();
      setStats(data.stats);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function confirmClean() {
    if (!stats || stats.orphanFiles === 0) return;
    modal.confirm({
      title: `清掉 ${stats.orphanFiles} 個沒有人引用的檔案？`,
      content: `會釋放約 ${formatBytes(stats.orphanBytes)}。只刪沒有任何行程指向、而且已經放超過 24 小時的檔案；刪除無法復原。`,
      okText: "清理", okType: "danger", cancelText: "取消",
      onOk: async () => {
        setCleaning(true);
        try {
          const res = await fetch("/api/admin/storage", { method: "DELETE" });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) { message.error(data.error ?? "清理失敗，請稍後再試"); return; }
          message.success(`已清掉 ${data.removed} 個檔案，釋放 ${formatBytes(data.freedBytes)}`);
          await load();
        } catch {
          message.error("清理失敗，請檢查網路連線");
        } finally {
          setCleaning(false);
        }
      },
    });
  }

  const usedPct = stats ? (stats.totalBytes / stats.limitBytes) * 100 : 0;
  // 撞到上限時上傳會直接失敗，所以提前到八成就提醒
  const tight = usedPct >= 80;

  return (
    <div className="pt-7">
      <h1 className="text-[22px] font-bold tracking-tight text-zinc-100">圖片儲存</h1>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-500">
        行程照片存在 Supabase Storage，免費方案共 1 GB。從行程上移掉一張圖或刪掉整筆行程時，
        資料庫的參照會消失，但檔案仍留在 bucket 裡 —— 那些沒有人引用的檔案可以在這裡一次清掉。
      </p>

      {loading ? (
        <div aria-hidden className="mt-5 admin-pulse h-24 rounded-2xl bg-white/[0.03]" />
      ) : error ? (
        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-5 text-[14px] text-rose-200">
          讀不到儲存用量，請重新整理再試一次。
        </div>
      ) : !stats ? null : (
        <>
          <section className="mt-5">
            <p className="flex flex-wrap items-center gap-2 text-[19px] font-bold text-zinc-100">
              <PhotoIcon size={16} stroke={tight ? "#fcd34d" : "#a78bfa"} />
              <span className="admin-nums">{formatBytes(stats.totalBytes)}</span>
              <span className="text-[13px] font-medium text-zinc-500">
                / 上限 <span className="admin-nums">1 GB</span>
              </span>
            </p>

            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${tight ? "bg-amber-400" : "bg-violet-400/70"}`}
                style={{ width: `${Math.min(100, usedPct)}%` }}
              />
            </div>

            <p className="mt-2.5 text-[13px] text-zinc-500">
              <span className="admin-nums text-zinc-300">{stats.totalFiles}</span> 個檔案
              <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
              已用 <span className="admin-nums text-zinc-300">{usedPct < 0.1 ? "<0.1" : usedPct.toFixed(1)}%</span>
              {stats.orphanFiles > 0 && (
                <>
                  <span aria-hidden className="mx-1.5 text-zinc-700">·</span>
                  <span className="font-semibold text-amber-300">
                    <span className="admin-nums">{stats.orphanFiles}</span> 個沒有人引用
                    （<span className="admin-nums">{formatBytes(stats.orphanBytes)}</span>）
                  </span>
                </>
              )}
            </p>
          </section>

          <section className="mt-6">
            {stats.orphanFiles === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] px-5 py-8 text-center">
                <p className="text-[15px] font-semibold text-zinc-300">沒有可以清理的檔案</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
                  每個檔案都還有行程指向它。剛上傳不到 24 小時的也不會被列入，
                  那段時間它可能只是還沒被按下儲存。
                </p>
              </div>
            ) : (
              <button
                onClick={confirmClean}
                disabled={cleaning}
                className="admin-focus h-11 cursor-pointer rounded-full border border-amber-400/30 bg-amber-400/10 px-5 text-[14px] font-semibold text-amber-200 transition-colors hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cleaning ? "清理中…" : `清掉 ${stats.orphanFiles} 個沒有人引用的檔案`}
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
