"use client";

import { forwardRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Typography } from "antd";
import { CalendarIcon, LocationIcon, UsersIcon } from "./Icons";

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
  people?: string[];
  notes?: string | null;
  /** 公開分享頁傳 false，不顯示分帳成員名單 */
  showPeople?: boolean;
  /** 登入版專屬的互動區（成員頭像、分帳綁定），插在 pills 與備註之間 */
  children?: ReactNode;
}

/** 旅程 hero 卡：trips 頁與分享頁共用的視覺（權限差異由呼叫端決定要不要塞 children） */
const TripHero = forwardRef<HTMLDivElement, TripHeroProps>(function TripHero(
  { name, startDate, endDate, countries, people = [], notes, showPeople = true, children },
  ref,
) {
  const accent = getDestinationAccent(countries ?? "");
  const countryList = countries
    ? countries.split(/[,，、]/).map((c) => c.trim()).filter(Boolean)
    : [];
  const duration = startDate && endDate
    ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
    : null;

  return (
    <div
      ref={ref}
      className="rounded-4xl md:mb-8 mb-4 overflow-hidden relative shadow-2xl border border-white/6 px-5 py-6 md:p-8 min-h-[100px] md:min-h-[130px]"
      style={{ background: `linear-gradient(145deg, ${accent.from}17 0%, rgba(139,92,246,0.05) 60%, rgba(9,9,11,0.98) 100%)` }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 85% 0%, ${accent.from}22 0%, transparent 55%)` }}
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
            className="font-display !text-zinc-100 !m-0 !mb-5 !leading-tight !font-black tracking-tight !text-[24px] md:!text-[30px]"
          >
            {name}
          </Typography.Title>

          <div className="flex flex-wrap gap-2.5 items-center">
            {startDate && endDate && (
              <span
                className="rounded-full px-3.5 py-1 text-[13px] font-medium flex items-center gap-1.5"
                style={{
                  background: `${accent.from}17`,
                  border: `1px solid ${accent.from}33`,
                  color: accent.from,
                  boxShadow: `0 0 15px ${accent.from}1a`,
                }}
              >
                <CalendarIcon size={11} />
                {startDate} → {endDate}
              </span>
            )}
            {duration !== null && (
              <span className="bg-zinc-800/80 border border-zinc-700/50 text-zinc-300 rounded-full px-3.5 py-1 text-[13px] font-medium">
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
                }}
              >
                <LocationIcon size={11} />
                {c}
              </span>
            ))}
            {showPeople && people.length > 0 && (
              <span className="bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 rounded-full px-3.5 py-1 text-[13px] font-medium flex items-center gap-1.5">
                <UsersIcon size={11} />
                {people.join("、")}
              </span>
            )}
          </div>

          {children}

          {notes && (
            <div className="bg-white/5 rounded-2xl p-5 mt-6 text-zinc-300 text-[14px] leading-relaxed border border-white/5 shadow-inner overflow-hidden">
              <div className="notes-content" dangerouslySetInnerHTML={{ __html: notes }} />
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
});

export default TripHero;
