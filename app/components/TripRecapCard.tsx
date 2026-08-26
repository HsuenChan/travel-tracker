"use client";

import { motion } from "framer-motion";
import { SparkleIcon } from "./Icons";

/** 峰終回顧卡：旅程結束後顯示在 hero 下方，用一眼看得完的數字幫旅程收尾 */
export default function TripRecapCard({
  days,
  itemCount,
  locationCount,
}: {
  days: number | null;
  itemCount: number;
  locationCount: number;
}) {
  const stats = [
    ...(days ? [{ label: "天", value: days }] : []),
    ...(itemCount > 0 ? [{ label: "段行程", value: itemCount }] : []),
    ...(locationCount > 0 ? [{ label: "個地點", value: locationCount }] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[24px] border border-violet-500/15 px-5 py-4 mb-4 md:mb-6"
      style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.07) 0%, rgba(255,255,255,0.025) 45%, rgba(9,9,11,0) 100%)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 0% 0%, rgba(168,85,247,0.08) 0%, transparent 55%)" }}
      />
      <div className="relative flex items-center gap-3 flex-wrap">
        <span className="w-9 h-9 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 flex items-center justify-center shrink-0">
          <SparkleIcon size={16} />
        </span>
        <div className="min-w-0">
          <div className="font-display text-zinc-100 text-[15px] font-bold leading-tight">旅程完成</div>
          <div className="text-zinc-400 text-[12px] mt-0.5">回憶收好了，期待下一段旅程</div>
        </div>
        {stats.length > 0 && (
          <div className="ml-auto flex gap-5">
            {stats.map((s) => (
              <div key={s.label} className="text-right">
                <div className="font-money text-zinc-100 text-[17px] font-bold leading-none">{s.value}</div>
                <div className="text-zinc-500 text-[10px] mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
