"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { App, Select, Checkbox, DatePicker, Input, Button } from "antd";
import type { Dayjs } from "dayjs";
import { LineMessage } from "@/app/components/admin/LineFlexRender";
import { ArrowUpIcon } from "@/app/components/Icons";

/**
 * 後台的 LINE 模擬器。
 *
 * 跑的是 webhook 的同一批函式，所以這裡按「是，新增」真的會寫進 expenses —— 只看排版的預覽
 * 騙得過眼睛，騙不過「確認之後那筆到底有沒有進去」。寫進去的那筆會給一顆刪除，測完就清掉。
 */

type Trip = {
  id: string; name: string;
  start_date: string | null; end_date: string | null;
  currency: string | null; people: string[] | null;
};

type Msg =
  | { from: "me"; text: string }
  | { from: "bot"; content: Record<string, unknown> }
  | { from: "note"; text: string };

const QUICK = ["/trip", "/trip 2026-09-25", "/help", "/info", "/list", "晚餐 500", "計程車 200 JPY 小綠子"];

export default function LineSimulator() {
  const { message: toast, modal } = App.useApp();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState<string | undefined>();
  const [isGroup, setIsGroup] = useState(false);
  const [log, setLog] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string[]>([]);
  const [briefDate, setBriefDate] = useState<Dayjs | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const trip = trips.find((t) => t.id === tripId) ?? null;

  useEffect(() => {
    fetch("/api/admin/line-sim", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { trips: [] }))
      .then((d) => setTrips(d.trips ?? []))
      .catch(() => setTrips([]));
  }, []);

  // block: "nearest" 只捲聊天框自己，不要連整個後台頁面一起捲
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [log]);

  const send = useCallback(async (payload: Record<string, unknown>, echo?: string) => {
    if (!tripId) { toast.warning("請先選一趟行程"); return; }
    setBusy(true);
    if (echo) setLog((l) => [...l, { from: "me", text: echo }]);
    try {
      const res = await fetch("/api/admin/line-sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, isGroup, ...payload }),
      });
      if (!res.ok) { toast.error(`失敗（${res.status}）`); return; }
      const data = await res.json();
      const messages = (data.messages ?? []) as Record<string, unknown>[];
      if (messages.length === 0) {
        setLog((l) => [...l, { from: "note", text: "（bot 沒有回應 —— 在群組裡這代表被靜默忽略）" }]);
      } else {
        setLog((l) => [...l, ...messages.map((m) => ({ from: "bot" as const, content: m }))]);
      }
      if (data.createdExpenseId) {
        setCreated((c) => [...c, data.createdExpenseId]);
        setLog((l) => [...l, { from: "note", text: "✓ 已真的寫入一筆費用" }]);
      }
    } finally {
      setBusy(false);
    }
  }, [tripId, isGroup, toast]);

  function submit() {
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    send({ text: t }, t);
  }

  function removeExpense(id: string) {
    modal.confirm({
      title: "刪除這筆模擬產生的費用？",
      okText: "刪除", okType: "danger", cancelText: "取消",
      onOk: async () => {
        const res = await fetch(`/api/admin/line-sim?expenseId=${id}`, { method: "DELETE" });
        if (!res.ok) { toast.error("刪除失敗"); return; }
        setCreated((c) => c.filter((x) => x !== id));
        toast.success("已刪除");
      },
    });
  }

  // 整頁分左右：標題也留在左欄，右邊那台手機才會從最上面開始，標題旁邊不會空一塊
  return (
    <div className="flex flex-col gap-6 pt-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <h1 className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-500">LINE 模擬器</h1>
        <p className="mt-2 mb-5 text-[13px] leading-relaxed text-zinc-500">
          跑的是 webhook 的同一批函式。按「是，新增」會真的寫進資料庫，測完記得在下面刪掉。
        </p>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Select
              value={tripId}
              onChange={(v) => { setTripId(v); setLog([]); setCreated([]); }}
              placeholder="選一趟行程…"
              showSearch
              optionFilterProp="label"
              style={{ minWidth: 240 }}
              options={trips.map((t) => ({
                value: t.id,
                label: t.start_date ? `${t.name}（${t.start_date}）` : t.name,
              }))}
            />
            {log.length > 0 && <Button size="small" onClick={() => setLog([])}>清空對話</Button>}
          </div>

          <Checkbox checked={isGroup} onChange={(e) => setIsGroup(e.target.checked)}>
            <span className="text-[13px] text-zinc-400">當成群組（認不出的訊息會靜默忽略）</span>
          </Checkbox>

          {trip && (
            <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] leading-relaxed text-zinc-500">
              成員：{trip.people?.length ? trip.people.join("、") : "（無）"}
              <br />
              幣別：{trip.currency ?? "—"}　期間：{trip.start_date ?? "—"} → {trip.end_date ?? "—"}
            </div>
          )}

          <h2 className="mt-6 text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-500">快捷訊息</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {QUICK.map((q) => (
              <Button key={q} size="small" disabled={busy} onClick={() => send({ text: q }, q)}>
                <span className="font-mono text-[12px]">{q}</span>
              </Button>
            ))}
          </div>

          <div className="mt-6 border-t border-white/[0.06] pt-5">
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              推播預覽（不會真的推出去）
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <DatePicker value={briefDate} onChange={setBriefDate} placeholder="留空用出發日" />
              <Button disabled={busy} onClick={() => send({ kind: "brief", date: briefDate?.format("YYYY-MM-DD") })}>
                每日行程
              </Button>
              <Button disabled={busy} onClick={() => send({ kind: "settlement" })}>
                旅程結算
              </Button>
            </div>
          </div>

          {created.length > 0 && (
            <div className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
              <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[0.14em] text-amber-300/80">
                這次模擬寫進去 {created.length} 筆費用
              </h2>
              <div className="flex flex-wrap gap-2">
                {created.map((id) => (
                  <Button key={id} size="small" danger onClick={() => removeExpense(id)}>
                    <span className="font-mono text-[11px]">刪除 {id.slice(0, 8)}…</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
      </div>

      {/*
        聊天區刻意不套 App 的樣式：它模擬的是 LINE，不是這個後台。
        固定成手機的寬高、內部捲動 —— 卡片一多就把頁面撐長的話，看不出一則訊息在真的畫面裡佔多少。
      */}
      <div className="shrink-0 lg:sticky lg:top-20">
          <div className="flex h-[min(740px,calc(100dvh-8rem))] w-[390px] max-w-full flex-col overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#ece7db] shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4">
              {log.length === 0 && (
                <div className="py-16 text-center text-[13px] text-[#8a8375]">
                  選一趟行程，然後在下面打字。試試 <code>晚餐 500</code>
                </div>
              )}
              {log.map((m, i) =>
                m.from === "me" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[250px] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-[#8de055] px-3.5 py-2.5 text-[14px] text-zinc-900 shadow-sm">
                      {m.text}
                    </div>
                  </div>
                ) : m.from === "note" ? (
                  <div key={i} className="text-center text-[11px] text-[#8a8375]">{m.text}</div>
                ) : (
                  <div key={i} className="flex items-start gap-2">
                    <div className="mt-1 h-7 w-7 shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#a78bfa,#3b2a66)]" />
                    <LineMessage message={m.content} onPostback={(data) => send({ postback: data })} />
                  </div>
                )
              )}
              <div ref={endRef} />
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-black/[0.07] bg-[#f4f1ea] px-3 py-2.5">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPressEnter={submit}
                placeholder="輸入訊息…"
                variant="filled"
                style={{ background: "#fff", color: "#18181b", borderRadius: 100 }}
              />
              {/* 送出鈕屬於 LINE 的介面不是後台的，所以照 LINE 的樣子做：綠色圓鈕加一個箭頭 */}
              <button
                type="button"
                onClick={submit}
                disabled={busy || !input.trim()}
                aria-label="送出"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#06C755] text-white transition-opacity hover:opacity-90 disabled:bg-[#c9c5bb] disabled:text-white/70"
              >
                <ArrowUpIcon size={18} stroke="currentColor" />
              </button>
            </div>
          </div>
      </div>
    </div>
  );
}
