"use client";

import { ACTION_LABELS } from "@/lib/activityQuery";

/**
 * 後台共用的小零件：動作徽章、相對時間、diff 的值。
 * 三個頁面都要用同一套語彙，分頭各寫一份遲早會長歪。
 */

const ACTION_STYLE: Record<string, { bg: string; text: string; ring: string }> = {
  create:  { bg: "rgba(52,211,153,0.12)",  text: "#6ee7b7", ring: "rgba(52,211,153,0.28)" },
  update:  { bg: "rgba(167,139,250,0.12)", text: "#c4b5fd", ring: "rgba(167,139,250,0.30)" },
  delete:  { bg: "rgba(251,113,133,0.12)", text: "#fda4af", ring: "rgba(251,113,133,0.30)" },
  restore: { bg: "rgba(251,191,36,0.12)",  text: "#fcd34d", ring: "rgba(251,191,36,0.30)" },
  login:   { bg: "rgba(96,165,250,0.12)",  text: "#93c5fd", ring: "rgba(96,165,250,0.30)" },
  logout:  { bg: "rgba(161,161,170,0.10)", text: "#d4d4d8", ring: "rgba(161,161,170,0.26)" },
  login_failed: { bg: "rgba(251,113,133,0.16)", text: "#fda4af", ring: "rgba(251,113,133,0.40)" },
};

export function ActionBadge({ action }: { action: string }) {
  const s = ACTION_STYLE[action] ?? ACTION_STYLE.logout;
  return (
    <span
      // whitespace-nowrap 是必要的：「登入失敗」在窄欄裡會被折成兩行，
      // 而膠囊是 rounded-full + leading-none，第二行會直接撐破外框
      className="shrink-0 whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-bold leading-none"
      style={{ background: s.bg, color: s.text, boxShadow: `inset 0 0 0 1px ${s.ring}` }}
    >
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

/** 一天以內講相對時間，再久就講日期 —— 「45 天前」沒有人在心裡換算得出來 */
export function relativeTime(iso: string): string {
  const then = new Date(iso);
  const diffMs = Date.now() - then.getTime();
  const min = Math.round(diffMs / 60000);

  if (min < 1) return "剛剛";
  if (min < 60) return `${min} 分鐘前`;

  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} 小時前`;

  const sameYear = then.getFullYear() === new Date().getFullYear();
  const d = String(then.getDate()).padStart(2, "0");
  const mo = String(then.getMonth() + 1).padStart(2, "0");
  const hh = String(then.getHours()).padStart(2, "0");
  const mm = String(then.getMinutes()).padStart(2, "0");
  if (hr < 48) return `昨天 ${hh}:${mm}`;
  return sameYear ? `${mo}/${d} ${hh}:${mm}` : `${then.getFullYear()}/${mo}/${d}`;
}

export function absoluteTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** HTML 備註在 diff 裡只會變成一團標籤，先拆成純文字再截斷 */
function plain(value: unknown): string {
  if (value === null || value === undefined || value === "") return "（空）";
  if (Array.isArray(value)) return value.length ? value.join("、") : "（空）";
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return text || "（空）";
}

export function DiffValue({ value, tone }: { value: unknown; tone: "before" | "after" }) {
  const text = plain(value);
  const empty = text === "（空）";
  const truncated = text.length > 140 ? `${text.slice(0, 140)}…` : text;
  return (
    <span
      className={`break-words ${empty ? "italic" : ""}`}
      style={{ color: empty ? "#71717a" : tone === "before" ? "#a1a1aa" : "#e4e4e7" }}
    >
      {truncated}
    </span>
  );
}
