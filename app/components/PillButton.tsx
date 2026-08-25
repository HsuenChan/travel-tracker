"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "default" | "primary" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  default: "bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white",
  primary: "bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#a855f7] text-white border-none shadow-[0_4px_16px_rgba(139,92,246,0.35)] hover:brightness-110",
  danger: "bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 hover:text-red-300",
};

/** 全站統一的膠囊按鈕：取代散落的手寫 pill 與 antd Button 混用 */
export default function PillButton({
  variant = "default",
  className = "",
  ...rest
}: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full text-[13px] font-medium h-8 px-4 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}
