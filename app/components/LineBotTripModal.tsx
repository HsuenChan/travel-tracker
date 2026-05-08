"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal, Button, App } from "antd";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { LineBotIcon } from "@/app/components/Icons";

interface Props {
  open: boolean;
  tripId: string;
  tripName: string;
  onClose: () => void;
}

const DARK = {
  content: { background: "#18181b", padding: 0, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 },
  header: { background: "#18181b", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px", borderRadius: "16px 16px 0 0" },
  body: { padding: "20px" },
};

const LINE_BOT_URL = process.env.NEXT_PUBLIC_LINE_BOT_URL ?? "https://line.me/R/ti/p/@your-bot-id";

export default function LineBotTripModal({ open, tripId, tripName, onClose }: Props) {
  const { message, modal } = App.useApp();
  const [token, setToken] = useState<string | null>(null);
  const [linkedChats, setLinkedChats] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    const res = await fetchWithAuth(`/api/trips/${tripId}/line-token`);
    if (res.ok) {
      const data = await res.json();
      setToken(data.token);
      setLinkedChats(data.linked_chats);
    }
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    if (open) fetchToken();
  }, [open, fetchToken]);

  async function copyToken() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    message.success("已複製連結碼");
  }

  function handleReset() {
    modal.confirm({
      title: "重新產生連結碼？",
      content: "舊的連結碼將失效，已連結的聊天室需要重新傳送新的連結碼才能繼續使用。",
      okText: "確認重設",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        setResetting(true);
        const res = await fetchWithAuth(`/api/trips/${tripId}/line-token`, { method: "DELETE" });
        if (res.ok) {
          const data = await res.json();
          setToken(data.token);
          setLinkedChats(0);
          message.success("已重新產生連結碼");
        }
        setResetting(false);
      },
    });
  }

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
      {loading ? (
        <div className="py-8 text-center text-zinc-500 text-sm">載入中...</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4 space-y-2">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">使用步驟</div>
            {[
              { n: "1", text: "將 LINE Bot 加為好友" },
              { n: "2", text: "在 LINE 群組或私聊傳送下方連結碼" },
              { n: "3", text: "Bot 自動連結到此行程，即可開始記帳" },
            ].map(({ n, text }) => (
              <div key={n} className="flex items-start gap-3 py-1">
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-indigo-400 text-[10px] font-bold">{n}</span>
                </div>
                <span className="text-zinc-300 text-sm">{text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={copyToken}
            className="w-full rounded-2xl bg-[#06C755]/[0.08] border-2 border-dashed border-[#06C755]/30 py-6 flex flex-col items-center gap-1 hover:bg-[#06C755]/[0.12] hover:border-[#06C755]/50 transition-colors active:opacity-70"
          >
            <div className="text-xs text-zinc-500 mb-1">{tripName}</div>
            <div className="font-mono text-2xl font-bold tracking-[0.2em] text-[#06C755]">
              {token}
            </div>
            <div className="text-xs text-zinc-500 mt-1">點擊複製</div>
          </button>

          {linkedChats > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span className="text-xs text-indigo-300">已連結 {linkedChats} 個聊天室</span>
            </div>
          )}

          <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4 space-y-1.5">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">記帳格式</div>
            {["晚餐 500", "晚餐 500 JPY", "晚餐 500 Eliza"].map((fmt) => (
              <div key={fmt} className="font-mono text-xs bg-black/30 border border-white/[0.06] rounded-lg px-3 py-2 text-zinc-300">
                {fmt}
              </div>
            ))}
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
              onClick={handleReset}
              loading={resetting}
            >
              重新產生
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
