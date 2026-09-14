"use client";

import { useState } from "react";
import { App } from "antd";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import type { ActivityEvent } from "@/app/components/admin/EventRow";

/**
 * 還原一筆異動，含確認對話框與結果訊息。
 *
 * 抽成 hook 是因為「還原按鈕長在事件列本身」這條規則對總覽頁一樣成立，
 * 兩個頁面得共用同一份行為，不然確認文案跟錯誤處理遲早各走各的。
 */
export function useRestoreEvent(onDone: () => void | Promise<void>) {
  const { modal, message } = App.useApp();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const restore = (event: ActivityEvent) => {
    const isDelete = event.action === "delete";
    modal.confirm({
      title: isDelete ? "把這筆加回去？" : "回到修改前的內容？",
      content: (
        <div className="text-[13px] leading-relaxed">
          <p className="font-semibold text-zinc-100">{event.entity_label}</p>
          <p className="mt-1 text-zinc-400">
            {isDelete
              ? "會用刪除當下的內容重新建立這筆資料。"
              : `會把 ${event.changes?.length ?? 0} 個欄位寫回修改前的值。`}
          </p>
          <p className="mt-2 text-zinc-500">還原本身也會留下一筆紀錄。</p>
        </div>
      ),
      okText: "還原",
      cancelText: "取消",
      centered: true,
      onOk: async () => {
        setRestoringId(event.id);
        try {
          const res = await fetchWithAuth("/api/admin/restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: event.id }),
          });
          const data = await res.json();
          if (!res.ok) {
            message.error(data.error ?? "還原失敗");
            return;
          }
          if (data.cleared?.length) {
            message.warning(`已還原，但關聯已失效的欄位被清空：${data.cleared.join("、")}`);
          } else {
            message.success("已還原");
          }
          await onDone();
        } catch {
          message.error("還原失敗");
        } finally {
          setRestoringId(null);
        }
      },
    });
  };

  return { restore, restoringId };
}
