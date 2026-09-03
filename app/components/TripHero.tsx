"use client";

import { forwardRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Typography } from "antd";
import { CalendarIcon, LocationIcon, MountainIcon } from "./Icons";
import dayjs from "dayjs";
import { parseCoverPos } from "@/lib/coverPos";

export function getDestinationAccent(countries: string): { from: string; to: string } {
  const c = (countries ?? "").toLowerCase();
  if (/日本|japan/.test(c)) return { from: '#f472b6', to: '#e11d48' };
  if (/韓國|korea/.test(c)) return { from: '#c084fc', to: '#7c3aed' };
  if (/泰國|thai/.test(c)) return { from: '#facc15', to: '#ca8a04' };
  if (/印尼|峇里|bali|indonesia/.test(c)) return { from: '#34d399', to: '#0d9488' };
  if (/越南|vietnam/.test(c)) return { from: '#4ade80', to: '#15803d' };
  if (/台灣|taiwan/.test(c)) return { from: '#f97316', to: '#dc2626' };
  if (/法國|france|paris/.test(c)) return { from: '#818cf8', to: '#4f46e5' };
  if (/義大利|italy/.test(c)) return { from: '#60a5fa', to: '#4338ca' };
  if (/西班牙|spain/.test(c)) return { from: '#fb923c', to: '#dc2626' };
  if (/英國|uk|england/.test(c)) return { from: '#60a5fa', to: '#1d4ed8' };
  if (/美國|usa|america/.test(c)) return { from: '#60a5fa', to: '#dc2626' };
  if (/澳洲|australia/.test(c)) return { from: '#fb923c', to: '#ca8a04' };
  return { from: '#6366f1', to: '#14b8a6' };
}

interface TripHeroProps {
  name?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  countries?: string | null;
  notes?: string | null;
  /** 行程第一張照片：有值時 hero 以照片為背景 */
  coverUrl?: string | null;
  /** 這趟旅程的戶外路段總計；沒有戶外行程時傳 null，pill 不會出現 */
  outdoor?: { legs: number; distance: number; ascent: number } | null;
  /** pills 列尾端靠右的內容（成員頭像） */
  pillsEnd?: ReactNode;
  /** 登入版專屬的互動區，插在 pills 之後（分帳綁定已改為獨立 Modal，目前沒有呼叫端使用） */
  children?: ReactNode;
}

/** 旅程 hero 卡：trips 頁與分享頁共用的視覺（權限差異由呼叫端決定要不要塞 children） */
const TripHero = forwardRef<HTMLDivElement, TripHeroProps>(function TripHero(
  { name, startDate, endDate, countries, notes, coverUrl, outdoor, pillsEnd, children },
  ref,
) {
  const accent = getDestinationAccent(countries ?? "");
  const countryList = countries
    ? countries.split(/[,，、]/).map((c) => c.trim()).filter(Boolean)
    : [];
  const duration = startDate && endDate
    ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
    : null;
  // 旅途中進度：第 N / M 天
  const today = dayjs().format("YYYY-MM-DD");
  const inTrip = !!(startDate && endDate && today >= startDate && today <= endDate);
  const dayIndex = inTrip && startDate
    ? Math.round((new Date(today).getTime() - new Date(startDate).getTime()) / 86400000) + 1
    : null;
  const cover = coverUrl ? parseCoverPos(coverUrl) : null;
  // 照片背景上的 pill 需要玻璃底＋blur 才讀得清（底色淡、靠 blur 補可讀性）
  const pillGlass = cover
    ? { backgroundColor: "rgba(24,24,27,0.35)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }
    : null;

  return (
    <div
      ref={ref}
      className="rounded-4xl md:mb-8 mb-4 overflow-hidden relative shadow-2xl border border-white/6 px-5 py-6 md:p-8 min-h-[100px] md:min-h-[130px]"
      style={{ background: `linear-gradient(145deg, ${accent.from}17 0%, rgba(139,92,246,0.05) 60%, rgba(9,9,11,0.98) 100%)` }}
    >
      {/* 封面照片背景：深色漸層壓底保持文字可讀 */}
      {cover && (
        <>
          <img
            src={cover.clean}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: `center ${cover.pos}%`, filter: "saturate(0.85) brightness(0.9)" }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(160deg, rgba(9,9,11,0.5) 0%, rgba(9,9,11,0.72) 55%, rgba(9,9,11,0.94) 100%)" }}
          />
        </>
      )}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 85% 0%, ${accent.from}${cover ? "14" : "22"} 0%, transparent 55%)` }}
      />

      {name && (
        <motion.div
          className="relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Typography.Title
            level={2}
            className={`font-display !text-zinc-100 !m-0 ${notes ? "!mb-1.5" : "!mb-5"} !leading-tight !font-black tracking-tight !text-[24px] md:!text-[30px]`}
          >
            {name}
          </Typography.Title>

          {notes && (
            <div
              className="notes-content hero-subtitle mb-5 text-[13px] leading-relaxed text-zinc-400 max-w-xl"
              dangerouslySetInnerHTML={{ __html: notes }}
            />
          )}

          <div className="flex flex-wrap gap-2.5 items-center">
            {startDate && endDate && (
              <span
                className="rounded-full px-3.5 py-1 text-[13px] font-medium flex items-center gap-1.5"
                style={{
                  background: `${accent.from}17`,
                  border: `1px solid ${accent.from}33`,
                  color: cover ? "#e4e4e7" : accent.from,
                  boxShadow: `0 0 15px ${accent.from}1a`,
                  ...pillGlass,
                }}
              >
                <CalendarIcon size={11} />
                {startDate} → {endDate}
              </span>
            )}
            {duration !== null && (
              <span className="bg-zinc-800/80 border border-zinc-700/50 text-zinc-300 rounded-full px-3.5 py-1 text-[13px] font-medium" style={pillGlass ?? undefined}>
                {duration} 天
              </span>
            )}
            {countryList.map((c) => (
              <span
                key={c}
                className="rounded-full px-3.5 py-1 text-[13px] font-medium flex items-center gap-1.5"
                style={{
                  background: `${accent.from}12`,
                  border: `1px solid ${accent.from}28`,
                  color: accent.from,
                  boxShadow: `0 0 15px ${accent.from}15`,
                  ...pillGlass,
                }}
              >
                <LocationIcon size={11} />
                {c}
              </span>
            ))}
            {outdoor && outdoor.legs > 0 && (
              <span
                className="bg-zinc-800/80 border border-zinc-700/50 text-zinc-300 rounded-full px-3.5 py-1 text-[13px] font-medium flex items-center gap-1.5 tabular-nums"
                style={pillGlass ?? undefined}
              >
                <MountainIcon size={11} />
                戶外 {outdoor.legs} 段
                {outdoor.distance > 0 && ` · ${Math.round(outdoor.distance * 10) / 10} km`}
                {outdoor.ascent > 0 && ` · ↑${Math.round(outdoor.ascent)} m`}
              </span>
            )}
            {dayIndex !== null && duration !== null && (
              <span
                className="font-display rounded-full px-3.5 py-1 text-[13px] font-bold flex items-center gap-1.5"
                style={{
                  background: "rgba(139,92,246,0.16)",
                  border: "1px solid rgba(139,92,246,0.35)",
                  color: "#c4b5fd",
                }}
              >
                第 {dayIndex} / {duration} 天
              </span>
            )}
            {pillsEnd && <span className="ml-auto flex items-center">{pillsEnd}</span>}
          </div>

          {/* 旅途中進度線 */}
          {dayIndex !== null && duration !== null && duration > 0 && (
            <div className="mt-4 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (dayIndex / duration) * 100)}%`,
                  background: "linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)",
                }}
              />
            </div>
          )}

          {children}
        </motion.div>
      )}
    </div>
  );
});

export default TripHero;
