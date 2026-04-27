"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal, Button, App } from "antd";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { LineBotIcon } from "@/app/components/Icons";

const LINE_BOT_URL = process.env.NEXT_PUBLIC_LINE_BOT_URL ?? "https://line.me/R/ti/p/@your-bot-id";

interface Props {
  open: boolean;
  onClose: () => void;
}

type BindState =
  | { status: "loading" }
  | { status: "bound" }
  | { status: "code"; code: string; expiresIn: number };

const DARK = {
  content: { background: "#18181b", padding: 0, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 },
  header: { background: "#18181b", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px", borderRadius: "16px 16px 0 0" },
  body: { padding: "20px" },
};

export default function LineBotBindModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const [state, setState] = useState<BindState>({ status: "loading" });
  const [unbinding, setUnbinding] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const fetchStatus = useCallback(async () => {
    setState({ status: "loading" });
    const res = await fetchWithAuth("/api/line-bind");
    const data = await res.json();
    if (data.bound) {
      setState({ status: "bound" });
    } else if (data.code) {
      setState({ status: "code", code: data.code, expiresIn: data.expiresIn });
      setCountdown(data.expiresIn);
    }
  }, []);

  useEffect(() => {
    if (open) fetchStatus();
  }, [open, fetchStatus]);

  useEffect(() => {
    if (state.status !== "code" || countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [state.status, countdown]);

  useEffect(() => {
    if (state.status === "code" && countdown === 0) fetchStatus();
  }, [countdown, state.status, fetchStatus]);

  async function handleUnbind() {
    setUnbinding(true);
    const res = await fetchWithAuth("/api/line-bind", { method: "DELETE" });
    if (res.ok) {
      message.success("已解除 LINE 帳號綁定");
      fetchStatus();
    } else {
      message.error("解除綁定失敗");
    }
    setUnbinding(false);
  }

  async function copyCode() {
    if (state.status !== "code") return;
    await navigator.clipboard.writeText(state.code);
    message.success("已複製驗證碼");
  }

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={380}
      centered
      styles={DARK}
      title={
        <div className="flex items-center gap-2 text-zinc-100">
          <LineBotIcon size={16} stroke="currentColor" />
          <span className="font-semibold text-sm">LINE Bot 記帳</span>
        </div>
      }
    >
      {state.status === "loading" && (
        <div className="py-8 text-center text-zinc-500 text-sm">載入中...</div>
      )}

      {state.status === "bound" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-[#06C755]/10 border border-[#06C755]/20 p-4">
            <div className="w-8 h-8 rounded-full bg-[#06C755]/20 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06C755" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-zinc-100 text-sm">LINE 帳號已綁定</div>
              <div className="text-xs text-zinc-400 mt-0.5">可以在 LINE Bot 直接記帳了</div>
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4 space-y-2">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">快速記帳格式</div>
            {[
              "晚餐 500",
              "晚餐 500 JPY",
              "晚餐 500 Eliza",
              "晚餐 500 Eliza 平分Eliza,John",
            ].map((fmt) => (
              <div key={fmt} className="font-mono text-xs bg-black/30 border border-white/[0.06] rounded-lg px-3 py-2 text-zinc-300">
                {fmt}
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4 space-y-3">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">群組使用</div>
            <div className="space-y-2">
              <div className="flex gap-2 text-xs text-zinc-400">
                <span className="text-indigo-400 shrink-0">@mention</span>
                <span>需先 @提及 Bot 才會觸發指令</span>
              </div>
              <div className="flex gap-2 text-xs text-zinc-400">
                <span className="text-zinc-500 shrink-0">·</span>
                <span>記帳、指令回覆皆顯示在群組</span>
              </div>
              <div className="flex gap-2 text-xs text-zinc-400">
                <span className="text-zinc-500 shrink-0">·</span>
                <span>回覆數字選人時不需要 @mention</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              href={LINE_BOT_URL}
              target="_blank"
              type="primary"
              className="flex-1"
              style={{ background: "#06C755", borderColor: "#06C755" }}
            >
              開啟 LINE Bot
            </Button>
            <Button
              danger
              ghost
              onClick={handleUnbind}
              loading={unbinding}
            >
              解除綁定
            </Button>
          </div>
        </div>
      )}

      {state.status === "code" && (
        <div className="space-y-4">
          <div className="text-sm text-zinc-400 space-y-1">
            <div>1. 先將 LINE Bot 加為好友</div>
            <div>2. 傳送以下驗證碼給 Bot 完成綁定</div>
          </div>

          <button
            onClick={copyCode}
            className="w-full rounded-2xl bg-[#06C755]/[0.08] border-2 border-dashed border-[#06C755]/30 py-6 flex flex-col items-center gap-1 hover:bg-[#06C755]/[0.12] hover:border-[#06C755]/50 transition-all group"
          >
            <div className="font-mono text-4xl font-bold tracking-[0.3em] text-[#06C755] group-hover:tracking-[0.4em] transition-all">
              {state.code}
            </div>
            <div className="text-xs text-zinc-500 mt-1">點擊複製</div>
          </button>

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              {countdown > 0
                ? `${minutes}:${String(seconds).padStart(2, "0")} 後過期`
                : "驗證碼已過期"}
            </span>
            <button
              onClick={fetchStatus}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              重新產生
            </button>
          </div>

          <Button
            href={LINE_BOT_URL}
            target="_blank"
            block
            style={{ background: "#06C755", borderColor: "#06C755", color: "#fff" }}
          >
            加入 LINE Bot 好友
          </Button>
        </div>
      )}
    </Modal>
  );
}
