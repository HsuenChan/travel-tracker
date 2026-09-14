import type { ReactNode } from "react";

/**
 * 「這裡還沒有東西」的統一長相。
 *
 * 行程、費用、伴手禮、裝備四個分頁原本各寫一份，色相、字色、CTA 形狀都長歪過，
 * 所以定義收在這裡：accent 只換 icon 底與背景暈染的色相，其餘一律相同。
 *
 * 這只服務「還沒開始」。被條件篩掉的空清單是另一回事 —— 那要講的是把條件放寬，
 * 不是教人怎麼開始，別套這個元件。
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  accent = "#8b5cf6",
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  /** ghost pill 按鈕；readOnly 時由呼叫端決定不傳 */
  action?: ReactNode;
  /** icon 底與背景暈染的色相，預設專案主色 */
  accent?: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-4 py-16 px-6 rounded-3xl border border-white/5 text-center"
      style={{
        background: `radial-gradient(circle at 50% 50%, color-mix(in oklab, ${accent} 6%, transparent) 0%, transparent 70%)`,
      }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{
          background: `color-mix(in oklab, ${accent} 10%, transparent)`,
          border: `1px solid color-mix(in oklab, ${accent} 20%, transparent)`,
        }}
      >
        {icon}
      </div>
      <div>
        <div className="text-zinc-200 font-medium mb-1">{title}</div>
        {description && (
          <div className="text-zinc-500 text-xs max-w-[260px] mx-auto leading-relaxed">{description}</div>
        )}
      </div>
      {action}
    </div>
  );
}

/** 空狀態專用的 ghost pill，四個分頁的下一步都長這樣 */
export function EmptyStateAction({
  onClick,
  children,
  primary = false,
}: {
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full h-9 px-4 text-[13px] font-semibold transition-all duration-200 cursor-pointer ${primary
        ? "bg-violet-600 border border-violet-500 text-white hover:bg-violet-500 shadow-[0_6px_24px_rgba(139,92,246,0.4)]"
        : "bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white"
        }`}
    >
      {children}
    </button>
  );
}
